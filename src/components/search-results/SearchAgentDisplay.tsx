/**
 * SearchAgentDisplay - AI Elements implementation for Search Agent
 *
 * Displays streaming agent responses with:
 * - Chain of thought reasoning with nested thinking blocks
 * - Search results with inline citations
 * - Recursive subagent formations using Canvas/Node/Edge
 * - Task components for individual agent transparency
 * - Code execution results with images
 * - Full hierarchical agent orchestration tree
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought'
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput, mapToolPartState } from '@/components/ai-elements/tool'
import { ResponseMarkdown } from '@/components/ai-elements/response'
import { ResponseWithCitations } from '@/components/ai-elements/response-with-citations'
import { SourcesGrid } from './SourcesGrid'
import type { SourceData } from './SourceCard'
import { AgentFormationAccordion } from '@/components/ai-elements/formation-components/AgentFormationAccordion'
import { useOrchestrationStore } from '@/stores/orchestrationStore'
import { useSearchStore } from '@/stores/searchStore'

interface Citation {
  number: string
  url: string
  title: string
  snippet?: string
  quote?: string
}

interface SearchAgentDisplayProps {
  query: string
  sessionId?: string
}

type ToolExecution = {
  id: string
  name: string
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  input?: unknown
  output?: unknown
  errorText?: string
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
    .map((item, index) => {
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
        quote: item.quote,
      }
    })
    .filter((item): item is Citation => Boolean(item && item.url))
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
      const type = item.type || 'web'

      return {
        id: item.id || `source-${index}-${domain}`,
        url,
        title,
        snippet,
        domain,
        type,
        favicon: item.favicon,
      } as SourceData
    })
    .filter((item): item is SourceData => Boolean(item))
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

function citationsToSources(citations: Citation[]): SourceData[] {
  return citations.map((citation, index) => ({
    id: `citation-${index + 1}`,
    url: citation.url,
    title: citation.title,
    snippet: citation.snippet || citation.quote || '',
    domain: getDomainFromUrl(citation.url),
    type: 'web',
  }))
}

export function SearchAgentDisplay({ query, sessionId = 'search-default' }: SearchAgentDisplayProps) {
  const [answerText, setAnswerText] = useState('')
  const [reasoningText, setReasoningText] = useState('')
  const [citations, setCitations] = useState<Citation[]>([])
  const [sources, setSources] = useState<SourceData[]>([])
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const clearSearch = useSearchStore((state) => state.clearSearch)
  const goToChat = useSearchStore((state) => state.goToChat)
  const goToFullResults = useSearchStore((state) => state.goToFullResults)
  const updateQuickResult = useSearchStore((state) => state.updateQuickResult)
  const setIsStreamingStore = useSearchStore((state) => state.setIsStreaming)

  // Connect to orchestrationStore for 70/30 split visualization
  const {
    workflowTasks,
    swarmNodes,
    graphNodes,
    activeAgentIds,
    agentStreamingData
  } = useOrchestrationStore()

  const hasOrchestration = workflowTasks.length > 0 || swarmNodes.length > 0 || graphNodes.length > 0
  const formationType: 'workflow' | 'swarm' | 'graph' =
    workflowTasks.length > 0 ? 'workflow' :
    swarmNodes.length > 0 ? 'swarm' :
    'graph'

  const mergedSources = useMemo(() => {
    if (sources.length > 0) return sources
    if (citations.length > 0) return citationsToSources(citations)
    return []
  }, [sources, citations])

  const resetState = useCallback(() => {
    setAnswerText('')
    setReasoningText('')
    setCitations([])
    setSources([])
    setToolExecutions([])
    setError(null)
  }, [])

  const upsertToolExecution = useCallback((toolCallId: string, update: Partial<ToolExecution>) => {
    setToolExecutions((prev) => {
      const index = prev.findIndex((tool) => tool.id === toolCallId)
      if (index === -1) {
        return [
          ...prev,
          {
            id: toolCallId,
            name: update.name || toolCallId,
            state: update.state || 'input-streaming',
            input: update.input,
            output: update.output,
            errorText: update.errorText,
          },
        ]
      }

      const next = [...prev]
      next[index] = {
        ...next[index],
        ...update,
        name: update.name || next[index].name,
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!query) return
    updateQuickResult({
      query,
      answer: answerText,
      isAnswerComplete: Boolean(answerText) && !isStreaming,
      sources: mergedSources,
      relatedQueries: [],
    })
  }, [query, answerText, mergedSources, isStreaming, updateQuickResult])

  useEffect(() => {
    if (!query) return
    setIsStreamingStore(isStreaming)
  }, [query, isStreaming, setIsStreamingStore])

  useEffect(() => {
    if (!query) return

    const fetchSearchResults = async () => {
      setIsStreaming(true)
      resetState()

      try {
        const response = await fetch('http://localhost:8765/api/search-agent/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            session_id: sessionId,
          }),
        })

        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body available')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        const handleToolOutput = (output: any) => {
          const citationsRaw = output?.citations || output?.sources || output?.links
          const citationsFromOutput = normalizeCitations(citationsRaw)
          if (citationsFromOutput.length > 0) {
            setCitations((prev) => mergeCitations(prev, citationsFromOutput))
          }

          const sourcesRaw = output?.sources || output?.search_results || output?.results
          const sourcesFromOutput = normalizeSources(sourcesRaw)
          if (sourcesFromOutput.length > 0) {
            setSources((prev) => {
              const existingUrls = new Set(prev.map((source) => source.url))
              const merged = [...prev]
              for (const source of sourcesFromOutput) {
                if (!existingUrls.has(source.url)) {
                  merged.push(source)
                }
              }
              return merged
            })
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith(':')) continue
            if (!line.startsWith('data: ')) continue

            const data = line.slice(6).trim()
            if (!data || data === '[DONE]') continue

            try {
              const event = JSON.parse(data)

              switch (event.type) {
                case 'text-start':
                  break

                case 'text-delta':
                  setAnswerText((prev) => prev + (event.delta || ''))
                  break

                case 'text-end':
                  break

                case 'reasoning-start':
                  break

                case 'reasoning-delta':
                  setReasoningText((prev) => prev + (event.delta || ''))
                  break

                case 'reasoning-end':
                  break

                case 'tool-input-start':
                  if (event.toolCallId) {
                    upsertToolExecution(event.toolCallId, {
                      name: event.toolName || event.toolCallId,
                      state: 'input-streaming',
                    })
                  }
                  break

                case 'tool-input-available':
                  if (event.toolCallId) {
                    upsertToolExecution(event.toolCallId, {
                      name: event.toolName || event.toolCallId,
                      state: 'input-available',
                      input: event.input,
                    })
                  }
                  if (event.input) handleToolOutput(event.input)
                  break

                case 'tool-output-available':
                  if (event.toolCallId) {
                    upsertToolExecution(event.toolCallId, {
                      state: 'output-available',
                      output: event.output,
                    })
                  }
                  if (event.output) handleToolOutput(event.output)
                  break

                case 'tool-output-error':
                  if (event.toolCallId) {
                    upsertToolExecution(event.toolCallId, {
                      state: 'output-error',
                      errorText: event.errorText,
                    })
                  }
                  setError(event.errorText || 'Tool error')
                  break

                case 'source-url': {
                  const url = event.url || event.sourceId || ''
                  if (url) {
                    const incoming = normalizeCitations([{ url }])
                    setCitations((prev) => mergeCitations(prev, incoming))
                  }
                  break
                }

                case 'source-document': {
                  const url = event.sourceId || event.url || ''
                  const title = event.title || getDomainFromUrl(url)
                  if (url) {
                    const incoming = normalizeCitations([{ url, title }])
                    setCitations((prev) => mergeCitations(prev, incoming))
                  }
                  break
                }

                case 'abort':
                  setError(event.reason || 'Stream aborted')
                  break

                case 'workflow_visualization':
                  // TODO: Properly integrate with orchestrationStore
                  // The backend needs to send structured orchestration events:
                  // - workflow-task-start/update for WorkflowState
                  // - swarm-handoff for SwarmState
                  // - graph-node-start/complete for GraphState
                  // Then call useOrchestrationStore().initWorkflowOrchestration(state)
                  console.warn('Received workflow_visualization event - orchestration store integration needed', event)
                  break

                case 'error':
                  setError(event.errorText || 'An error occurred')
                  break

                case 'finish':
                  setIsStreaming(false)
                  break

                default:
                  break
              }
            } catch (parseError) {
              console.error('Failed to parse SSE event:', parseError)
            }
          }
        }

        setIsStreaming(false)
      } catch (err) {
        console.error('Search agent error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setIsStreaming(false)
      }
    }

    fetchSearchResults()
  }, [query, sessionId, retryToken, resetState, upsertToolExecution])

  const hasChainOfThought = Boolean(
    reasoningText ||
    isStreaming ||
    toolExecutions.length > 0 ||
    workflowParts.length > 0
  )
  const stepCount =
    (reasoningText || isStreaming ? 1 : 0) +
    toolExecutions.length +
    workflowParts.length

  return (
    <div className="max-w-5xl mx-auto px-5 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={clearSearch}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:text-white/90 hover:border-white/30 transition"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="text-xs text-white/40">
          {isStreaming ? 'Streaming response' : 'Response ready'}
        </div>
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Search</p>
        <h1 className="text-2xl font-medium text-white/90">{query}</h1>
        <div className="flex items-center justify-center gap-3 text-xs text-white/40">
          <button
            onClick={() => setRetryToken((value) => value + 1)}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-white/70 hover:text-white/90 hover:border-white/30 transition"
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>

      {hasChainOfThought && (
        <ChainOfThought defaultOpen isStreaming={isStreaming} autoCollapseDelay={0}>
          <ChainOfThoughtHeader>
            {isStreaming
              ? 'Processing...'
              : `Chain of Thought (${stepCount} step${stepCount === 1 ? '' : 's'})`}
          </ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            {(reasoningText || isStreaming) && (
              <ChainOfThoughtStep
                label="Reasoning"
                status={isStreaming ? 'running' : 'complete'}
              >
                <Reasoning className="w-full" isStreaming={isStreaming}>
                  <ReasoningTrigger />
                  <ReasoningContent>
                    {reasoningText ? (
                      <ResponseMarkdown
                        content={reasoningText}
                        isStreaming={isStreaming}
                        className="text-sm text-white/80"
                      />
                    ) : (
                      <div className="text-sm text-white/40">Thinking...</div>
                    )}
                  </ReasoningContent>
                </Reasoning>
              </ChainOfThoughtStep>
            )}

            {toolExecutions.map((tool) => {
              const toolState = mapToolPartState(tool.state)
              const stepStatus =
                toolState === 'success'
                  ? 'complete'
                  : toolState === 'error'
                    ? 'error'
                    : 'running'
              const toolInput =
                tool.input && typeof tool.input === 'object'
                  ? (tool.input as Record<string, unknown>)
                  : tool.input != null
                    ? { value: tool.input }
                    : undefined

              return (
                <ChainOfThoughtStep
                  key={tool.id}
                  label={tool.name}
                  status={stepStatus}
                >
                  <Tool defaultOpen={toolState !== 'success'}>
                    <ToolHeader title={tool.name} state={toolState} />
                    <ToolContent>
                      {toolInput && (
                        <ToolInput
                          input={toolInput}
                          isStreaming={tool.state === 'input-streaming'}
                        />
                      )}
                      {tool.state === 'output-available' && tool.output != null && (
                        <ToolOutput output={tool.output} />
                      )}
                      {tool.state === 'output-error' && tool.errorText && (
                        <ToolOutput errorText={tool.errorText} />
                      )}
                    </ToolContent>
                  </Tool>
                </ChainOfThoughtStep>
              )
            })}
          </ChainOfThoughtContent>
        </ChainOfThought>
      )}

      <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
        <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
          {answerText ? (
            <div className="prose prose-invert max-w-none text-white/80">
              <ResponseWithCitations
                content={answerText}
                citations={citations.map((citation) => ({
                  number: citation.number,
                  title: citation.title,
                  url: citation.url,
                  snippet: citation.snippet,
                }))}
                isStreaming={isStreaming}
              />
              {isStreaming && (
                <span className="inline-block w-0.5 h-5 bg-purple-400 ml-0.5 animate-pulse" />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-10 text-white/40 text-sm">
              <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-3" />
              Generating answer…
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/70">
              Sources ({mergedSources.length})
            </h2>
          </div>
          {mergedSources.length > 0 ? (
            <SourcesGrid sources={mergedSources} />
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/40">
              Sources will appear here as they stream in.
            </div>
          )}
        </div>

      {/* 70/30 Orchestration Visualization */}
      {hasOrchestration && (
        <div className="mt-6">
          <AgentFormationAccordion
            formationType={formationType}
            isFormationActive={isStreaming}
            isFormationComplete={!isStreaming}
            defaultExpanded={true}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          onClick={() => {
            updateQuickResult({
              query,
              answer: answerText,
              isAnswerComplete: Boolean(answerText) && !isStreaming,
              sources: mergedSources,
              relatedQueries: [],
            })
            goToChat()
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-teal-500/20 transition hover:-translate-y-0.5"
        >
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
          Let's Chat
        </button>
        <button
          onClick={goToFullResults}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-purple-500/20 transition hover:-translate-y-0.5"
        >
          Full Results
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="glass-card rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          <div className="font-medium">Search error</div>
          <div className="mt-1 text-red-100/80">{error}</div>
        </div>
      )}
    </div>
  )
}

export default SearchAgentDisplay
