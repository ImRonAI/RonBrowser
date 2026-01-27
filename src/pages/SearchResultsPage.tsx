/**
 * Search Results Page
 *
 * Page component that displays search results using the SearchLayout component.
 * Fetches live results from sonar-reasoning-pro API.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { UIMessage } from '@ai-sdk/react'
import { SearchLayout } from '@/components/search-results'
import { useSearchStore } from '@/stores/searchStore'
import type {
  SearchResponse,
  UniversalResult,
} from '@/pages/types/search'
import type { Citation } from '@/components/ai-elements/response-with-citations'
import { AnimatePresence, motion } from 'framer-motion'
import { SearchChat } from '@/components/search-results/SearchChat'
import { List, MessageCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

type MessagePart = UIMessage['parts'][number]

type ToolExecution = {
  id: string
  name: string
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  input?: unknown
  output?: unknown
  errorText?: string
}

type SourceData = {
  id: string
  url: string
  title: string
  snippet: string
  domain?: string
  type?: string
  favicon?: string
}

function buildSearchAgentParts({
  answerText,
  reasoningText,
  toolExecutions,
  isStreaming,
}: {
  answerText: string
  reasoningText: string
  toolExecutions: ToolExecution[]
  isStreaming: boolean
}): MessagePart[] {
  const parts: MessagePart[] = []

  if (reasoningText || isStreaming) {
    parts.push({
      type: 'reasoning',
      text: reasoningText || 'Thinking...',
      state: isStreaming ? 'streaming' : 'done',
    } as MessagePart)
  }

  toolExecutions.forEach((tool) => {
    parts.push({
      type: 'dynamic-tool',
      toolName: tool.name,
      toolCallId: tool.id,
      state: tool.state,
      input: tool.input,
      output: tool.output,
      errorText: tool.errorText,
    } as MessagePart)
  })

  const finalText = answerText || (isStreaming ? 'Generating answer...' : '')
  if (finalText) {
    parts.push({
      type: 'text',
      text: finalText,
      state: isStreaming ? 'streaming' : 'done',
    } as MessagePart)
  }

  return parts
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function normalizeCitations(raw: any): Citation[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((item, index): Citation | null => {
      if (!item) return null
      if (typeof item === 'string') {
        const url = item
        return {
          number: String(index + 1),
          url,
          title: getDomainFromUrl(url),
          snippet: undefined,
        }
      }

      const url = item.url || item.link || item.source || ''
      const title = item.title || item.name || getDomainFromUrl(url)
      const snippet = item.snippet || item.description || item.quote
      const number = item.number ? String(item.number) : String(index + 1)

      return {
        number,
        url,
        title,
        snippet,
      }
    })
    .filter((item): item is Citation => Boolean(item && item.url))
}

function mergeCitations(existing: Citation[], incoming: Citation[]): Citation[] {
  if (incoming.length === 0) return existing

  const seen = new Map<string, Citation>()
  for (const citation of existing) {
    seen.set(citation.url, citation)
  }
  for (const citation of incoming) {
    if (!seen.has(citation.url)) {
      seen.set(citation.url, citation)
    }
  }

  return Array.from(seen.values()).map((citation, index) => ({
    ...citation,
    number: String(index + 1),
  }))
}

function normalizeSources(raw: any): SourceData[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((item, index) => {
      if (!item) return null
      const url = item.url || item.link || item.source || ''
      if (!url) return null

      const title = item.title || item.name || getDomainFromUrl(url)
      const snippet = item.snippet || item.description || item.quote || ''
      const domain = item.domain || getDomainFromUrl(url)

      return {
        id: item.id || `source-${index}-${domain}`,
        url,
        title,
        snippet,
        domain,
        type: item.type || 'web',
        favicon: item.favicon,
      } as SourceData
    })
    .filter((item): item is SourceData => Boolean(item))
}

function sourcesToWebResults(sources: SourceData[]): UniversalResult[] {
  return sources.map((source, index) => ({
    id: source.id || `web-${index}`,
    type: 'web',
    title: source.title || source.url,
    url: source.url,
    snippet: source.snippet || '',
    favicon: source.favicon,
    domain: source.domain,
  }))
}

function mergeResults(existing: UniversalResult[], incoming: UniversalResult[]): UniversalResult[] {
  if (incoming.length === 0) return existing
  const seen = new Set(existing.map((result) => result.url || result.id))
  const merged = [...existing]
  for (const result of incoming) {
    const key = result.url || result.id
    if (!seen.has(key)) {
      merged.push(result)
      seen.add(key)
    }
  }
  return merged
}

function normalizeToolOutput(
  output: any,
  existingCitations: Citation[],
  existingResults: UniversalResult[]
): { citations: Citation[]; results: UniversalResult[] } {
  const citationsRaw = output?.citations || output?.sources || output?.links
  const incomingCitations = normalizeCitations(citationsRaw)
  const nextCitations = mergeCitations(existingCitations, incomingCitations)

  const sourcesRaw = output?.sources || output?.search_results || output?.results || output?.items
  const sources = normalizeSources(sourcesRaw)
  const incomingResults = sourcesToWebResults(sources)
  const nextResults = mergeResults(existingResults, incomingResults)

  return { citations: nextCitations, results: nextResults }
}

function citationsToWebResults(citationList: Citation[]): UniversalResult[] {
  return citationList.map((citation, index) => ({
    id: `citation-${index + 1}`,
    type: 'web',
    title: citation.title || citation.url,
    url: citation.url,
    snippet: citation.snippet || '',
    domain: getDomainFromUrl(citation.url),
  }))
}

export function SearchResultsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [reasoningText, setReasoningText] = useState('')
  const [citations, setCitations] = useState<Citation[]>([])
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([])
  const [isAgentStreaming, setIsAgentStreaming] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  
  // View State
  const [viewMode, setViewMode] = useState<'results' | 'chat'>('results')
  const [chatContext, setChatContext] = useState<UniversalResult | null>(null)

  const { query: storeQuery, clearSearch } = useSearchStore()

  // Use the query from the store if available, otherwise use the mock data query
  const searchQuery = storeQuery || 'artificial intelligence and machine learning'

  const upsertToolExecution = useCallback((toolCallId: string, update: Partial<ToolExecution>) => {
    setToolExecutions((prev) => {
      const next = [...prev]
      const index = next.findIndex((tool) => tool.id === toolCallId)
      if (index === -1) {
        next.push({
          id: toolCallId,
          name: update.name || toolCallId,
          state: update.state || 'input-streaming',
          input: update.input,
          output: update.output,
          errorText: update.errorText,
        })
      } else {
        next[index] = {
          ...next[index],
          ...update,
          name: update.name || next[index].name,
        }
      }
      return next
    })
  }, [])

  const agentState = useMemo(() => ({
    parts: buildSearchAgentParts({
      answerText,
      reasoningText,
      toolExecutions,
      isStreaming: isAgentStreaming,
    }),
    citations,
    isStreaming: isAgentStreaming,
    error: agentError,
  }), [answerText, reasoningText, toolExecutions, isAgentStreaming, citations, agentError])

  // Fetch search results on mount and when query changes
  useEffect(() => {
    if (!searchQuery) return

    const fetchResults = async () => {
      setIsLoading(true)
      setIsAgentStreaming(true)
      setAgentError(null)
      setError(null)
      setSearchResponse(null)
      setAnswerText('')
      setReasoningText('')
      setCitations([])
      setToolExecutions([])

      try {
        const response = await fetch('http://localhost:8765/api/search-agent/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery,
            session_id: 'search-page'
          })
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        let content = ''
        let localCitations: Citation[] = []
        let localResults: UniversalResult[] = []

        while (reader) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break

              try {
                const parsed = JSON.parse(data)

                switch (parsed.type) {
                  case 'content': {
                    const delta = parsed.content || ''
                    content += delta
                    setAnswerText((prev) => prev + delta)
                    break
                  }

                  case 'text-start':
                    break

                  case 'text-delta': {
                    const delta = parsed.delta || ''
                    content += delta
                    setAnswerText((prev) => prev + delta)
                    break
                  }

                  case 'text-end':
                    break

                  case 'reasoning-start':
                    break

                  case 'reasoning-delta': {
                    const delta = parsed.delta || ''
                    setReasoningText((prev) => prev + delta)
                    break
                  }

                  case 'reasoning-end':
                    break

                  case 'tool-input-start':
                    if (parsed.toolCallId) {
                      upsertToolExecution(parsed.toolCallId, {
                        name: parsed.toolName || parsed.toolCallId,
                        state: 'input-streaming',
                      })
                    }
                    break

                  case 'tool-input-available':
                    if (parsed.toolCallId) {
                      upsertToolExecution(parsed.toolCallId, {
                        name: parsed.toolName || parsed.toolCallId,
                        state: 'input-available',
                        input: parsed.input,
                      })
                    }
                    if (parsed.input) {
                      const outputData = normalizeToolOutput(parsed.input, localCitations, localResults)
                      localCitations = outputData.citations
                      localResults = outputData.results
                      setCitations(localCitations)
                    }
                    break

                  case 'tool-output-available':
                    if (parsed.toolCallId) {
                      upsertToolExecution(parsed.toolCallId, {
                        name: parsed.toolName,
                        state: 'output-available',
                        output: parsed.output,
                      })
                    }
                    if (parsed.output) {
                      const outputData = normalizeToolOutput(parsed.output, localCitations, localResults)
                      localCitations = outputData.citations
                      localResults = outputData.results
                      setCitations(localCitations)
                    }
                    break

                  case 'tool-output-error':
                    if (parsed.toolCallId) {
                      upsertToolExecution(parsed.toolCallId, {
                        name: parsed.toolName,
                        state: 'output-error',
                        errorText: parsed.errorText,
                      })
                    }
                    setAgentError(parsed.errorText || 'Tool error')
                    break

                  case 'source-url': {
                    const url = parsed.url || parsed.sourceId || ''
                    if (url) {
                      const incoming = normalizeCitations([{ url }])
                      localCitations = mergeCitations(localCitations, incoming)
                      setCitations(localCitations)
                    }
                    break
                  }

                  case 'source-document': {
                    const url = parsed.sourceId || parsed.url || ''
                    const title = parsed.title || getDomainFromUrl(url)
                    if (url) {
                      const incoming = normalizeCitations([{ url, title }])
                      localCitations = mergeCitations(localCitations, incoming)
                      setCitations(localCitations)
                    }
                    break
                  }

                  case 'finish':
                    if (Array.isArray(parsed.citations)) {
                      const incoming = normalizeCitations(parsed.citations)
                      localCitations = mergeCitations(localCitations, incoming)
                      setCitations(localCitations)
                    }
                    setIsAgentStreaming(false)
                    break

                  case 'metadata':
                    if (Array.isArray(parsed.citations)) {
                      const incoming = normalizeCitations(parsed.citations)
                      localCitations = mergeCitations(localCitations, incoming)
                      setCitations(localCitations)
                    }
                    break

                  case 'error':
                    setAgentError(parsed.errorText || parsed.error || 'Search error')
                    break

                  default:
                    break
                }
              } catch (e) {
                console.error('Parse error:', e)
              }
            }
          }
        }

        const finalResults = localResults.length > 0 ? localResults : citationsToWebResults(localCitations)
        // Build SearchResponse from streamed data
        setSearchResponse({
          id: `search-${Date.now()}`,
          query: searchQuery,
          timestamp: Date.now(),
          isComplete: true,
          totalCount: finalResults.length,
          duration: 0,
          sonarReasoning: {
            reasoning: content,
            chainOfThought: {
              steps: []
            },
            confidence: 0.85,
            qualityScore: 0.9,
            sources: localCitations.map((c, i) => ({
              id: `source-${i}`,
              url: c.url || '',
              title: c.title || '',
              snippet: c.snippet || '',
              relevanceScore: 0.9,
              type: 'web',
              domain: c.url ? new URL(c.url).hostname : ''
            })),
            summary: content.substring(0, 200),
            relatedQueries: [],
            modelUsed: 'sonar-reasoning-pro',
            tokensUsed: 0
          },
          results: finalResults
        })
        setIsLoading(false)
        setIsAgentStreaming(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setAgentError(err instanceof Error ? err.message : 'Unknown error')
        setIsLoading(false)
        setIsAgentStreaming(false)
      }
    }

    fetchResults()
  }, [searchQuery])

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleResultClick = (result: UniversalResult) => {
    console.log('Result clicked:', result)
    // In a real app, this would open the result
  }

  const handleFilterChange = () => {
    console.log('Filters changed')
  }

  const handleBackToHome = () => {
    clearSearch()
  }

  const handleChatClick = (result: UniversalResult) => {
    setChatContext(result)
    setViewMode('chat')
  }

  return (
    <div className="min-h-screen bg-surface-0 dark:bg-surface-900">
      {/* Page Header */}
      <div className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Back button */}
              <button
                onClick={handleBackToHome}
                className="p-2 rounded-lg text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                title="Back to Home"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <svg 
                  className="w-6 h-6 text-accent dark:text-accent-light" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                  />
                </svg>
                <div>
                  <h1 className="text-2xl font-bold text-ink dark:text-ink-inverse">
                    Search Results
                  </h1>
                  <p className="text-sm text-ink-muted dark:text-ink-inverse-muted mt-1">
                    Query: <span className="font-medium text-ink dark:text-ink-inverse">"{searchQuery}"</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-surface-200/50 dark:bg-surface-700/50 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('results')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === 'results'
                      ? "bg-surface-0 dark:bg-surface-800 text-ink dark:text-ink-inverse shadow-sm"
                      : "text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse"
                  )}
                >
                  <List className="w-4 h-4" />
                  Results
                </button>
                <button
                  onClick={() => setViewMode('chat')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === 'chat'
                      ? "bg-surface-0 dark:bg-surface-800 text-ink dark:text-ink-inverse shadow-sm"
                      : "text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse"
                  )}
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat
                </button>
              </div>

              <div className="w-px h-8 bg-surface-200 dark:bg-surface-700 mx-1" />

              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isLoading 
                    ? 'bg-surface-200 dark:bg-surface-700 text-ink-muted dark:text-ink-inverse-muted cursor-not-allowed'
                    : 'bg-surface-100 dark:bg-surface-800 text-ink dark:text-ink-inverse hover:bg-surface-200 dark:hover:bg-surface-700'
                  }
                `}
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Layout */}
      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {viewMode === 'results' ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
            >
              <SearchLayout
                searchResponse={searchResponse}
                searchQuery={searchQuery}
                isLoading={isLoading}
                error={error}
                agentState={agentState}
                onResultClick={handleResultClick}
                onFilterChange={handleFilterChange}
                onChatClick={handleChatClick}
              />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="h-[calc(100vh-80px)]" // Adjust based on header height
            >
              <SearchChat
                searchResult={{
                  query: searchQuery,
                  answer: answerText,
                  sources: citations.map(c => ({
                    id: c.url,
                    url: c.url,
                    title: c.title || c.url,
                    snippet: c.snippet || '',
                    domain: getDomainFromUrl(c.url),
                    type: 'web',
                    favicon: undefined
                  }))
                }}
                onBack={() => setViewMode('results')}
                initialContext={chatContext}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default SearchResultsPage
