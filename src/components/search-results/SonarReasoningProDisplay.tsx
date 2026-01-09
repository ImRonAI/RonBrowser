/**
 * SonarReasoningProDisplay Component
 *
 * Beautiful, transparent presentation of Sonar Reasoning Pro's chain of thought
 * using AI Elements components with streaming support.
 */

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

// AI Elements Components
import { ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtContent, ChainOfThoughtStep, ChainOfThoughtSearchResults, ChainOfThoughtSearchResult, ChainOfThoughtImage } from '@/components/ai-elements/chain-of-thought'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning'
import { Sources, SourcesTrigger, SourcesContent, Source } from '@/components/ai-elements/sources'

// Types
interface Citation {
  id: string
  title: string
  url: string
  snippet?: string
  domain?: string
  relevanceScore?: number
}

interface SearchResult {
  id: string
  query: string
  snippet: string
  url?: string
}

interface ImageData {
  id: string
  url: string
  caption?: string
  base64?: string
  mediaType?: string
}

interface SonarReasoningProDisplayProps {
  query: string
  isStreaming?: boolean
  className?: string
}

interface StreamingState {
  content: string
  reasoning: string
  isReasoningActive: boolean
  searchResults: SearchResult[]
  citations: Citation[]
  images: ImageData[]
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function SonarReasoningProDisplay({
  query,
  isStreaming: initialStreaming = false,
  className
}: SonarReasoningProDisplayProps) {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    content: '',
    reasoning: '',
    isReasoningActive: false,
    searchResults: [],
    citations: [],
    images: []
  })

  const [isStreaming, setIsStreaming] = useState(initialStreaming)
  const [reasoningDuration, setReasoningDuration] = useState<number | undefined>()
  const reasoningStartTime = useRef<number | null>(null)

  // Start streaming when component mounts or query changes
  useEffect(() => {
    if (!query) return

    // Reset state
    setStreamingState({
      content: '',
      reasoning: '',
      isReasoningActive: false,
      searchResults: [],
      citations: [],
      images: []
    })
    setIsStreaming(true)
    setReasoningDuration(undefined)

    // Stream from POST endpoint
    const streamResponse = async () => {
      try {
        const response = await fetch('/api/sonar-reasoning-pro/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: query }],
            reasoning_effort: 'high',
            temperature: 0.2
          })
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('No reader available')
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                setIsStreaming(false)
                continue
              }

              try {
                const parsed = JSON.parse(data)

                switch (parsed.type) {
                  case 'content':
                    setStreamingState(prev => ({
                      ...prev,
                      content: prev.content + parsed.content
                    }))
                    break

                  case 'reasoning_start':
                    reasoningStartTime.current = Date.now()
                    setStreamingState(prev => ({
                      ...prev,
                      isReasoningActive: true
                    }))
                    break

                  case 'reasoning':
                    setStreamingState(prev => ({
                      ...prev,
                      reasoning: parsed.content
                    }))
                    break

                  case 'reasoning_end':
                    if (reasoningStartTime.current) {
                      setReasoningDuration(Date.now() - reasoningStartTime.current)
                    }
                    setStreamingState(prev => ({
                      ...prev,
                      isReasoningActive: false
                    }))
                    break

                  case 'metadata':
                    setStreamingState(prev => ({
                      ...prev,
                      citations: parsed.citations || prev.citations,
                      images: parsed.images || prev.images,
                      searchResults: parsed.search_results || prev.searchResults
                    }))
                    break

                  case 'error':
                    setStreamingState(prev => ({
                      ...prev,
                      error: parsed.error
                    }))
                    setIsStreaming(false)
                    break
                }
              } catch (error) {
                console.error('Error parsing SSE data:', error)
              }
            }
          }
        }
      } catch (error) {
        console.error('Streaming error:', error)
        setStreamingState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
        setIsStreaming(false)
      }
    }

    streamResponse()
  }, [query])

  // Format content with inline citations
  const formatContentWithCitations = (content: string, citations: Citation[]) => {
    if (!citations.length) return content

    // Replace citation markers [1], [2], etc. with styled inline citations
    let formattedContent = content
    citations.forEach((citation, index) => {
      const citationNumber = index + 1
      const pattern = new RegExp(`\\[${citationNumber}\\]`, 'g')
      formattedContent = formattedContent.replace(
        pattern,
        `<sup class="inline-citation" data-citation-id="${citation.id}">[${citationNumber}]</sup>`
      )
    })

    return formattedContent
  }

  return (
    <div className={cn(
      'w-full space-y-4',
      'animate-in fade-in slide-in-from-bottom-2 duration-300',
      className
    )}>
      {/* Error State */}
      {streamingState.error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
        >
          <p className="text-sm text-red-600 dark:text-red-400">
            {streamingState.error}
          </p>
        </motion.div>
      )}

      {/* Reasoning Section - Shows thinking process */}
      {(streamingState.reasoning || streamingState.isReasoningActive) && (
        <Reasoning
          isStreaming={streamingState.isReasoningActive}
          duration={reasoningDuration}
          defaultOpen={streamingState.isReasoningActive}
          autoCollapseDelay={3000}
        >
          <ReasoningTrigger />
          <ReasoningContent>
            {streamingState.reasoning || 'Analyzing your query...'}
          </ReasoningContent>
        </Reasoning>
      )}

      {/* Chain of Thought - Detailed reasoning steps */}
      {streamingState.searchResults.length > 0 && (
        <ChainOfThought defaultOpen={false} className="glass-frosted backdrop-blur-xl">
          <ChainOfThoughtHeader>
            Reasoning Process ({streamingState.searchResults.length} searches)
          </ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            {streamingState.searchResults.map((result, index) => (
              <ChainOfThoughtStep
                key={result.id}
                label={`Search ${index + 1}: ${result.query}`}
                description="Gathering information from multiple sources"
                status={isStreaming ? 'running' : 'complete'}
              >
                <ChainOfThoughtSearchResults>
                  <ChainOfThoughtSearchResult>
                    {result.snippet}
                  </ChainOfThoughtSearchResult>
                  {result.url && (
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-body-xs text-accent dark:text-accent-light hover:underline"
                    >
                      View source →
                    </a>
                  )}
                </ChainOfThoughtSearchResults>
              </ChainOfThoughtStep>
            ))}
          </ChainOfThoughtContent>
        </ChainOfThought>
      )}

      {/* Main Response Content with Inline Citations */}
      {streamingState.content && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          <div
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none prose-inline-citations",
              isStreaming && "animate-pulse"
            )}
            dangerouslySetInnerHTML={{
              __html: formatContentWithCitations(streamingState.content, streamingState.citations)
            }}
          />

          {/* Inline citation hover tooltips */}
          <style>{`
            .prose-inline-citations :global(.inline-citation) {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-width: 1.25rem;
              height: 1.25rem;
              padding: 0 0.25rem;
              margin: 0 0.125rem;
              border-radius: 9999px;
              background: rgb(var(--accent) / 0.1);
              color: rgb(var(--accent));
              font-size: 0.75rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            }

            .prose-inline-citations :global(.inline-citation:hover) {
              background: rgb(var(--accent) / 0.2);
              transform: scale(1.1);
            }

            @media (prefers-color-scheme: dark) {
              .prose-inline-citations :global(.inline-citation) {
                background: rgb(var(--accent-light) / 0.1);
                color: rgb(var(--accent-light));
              }

              .prose-inline-citations :global(.inline-citation:hover) {
                background: rgb(var(--accent-light) / 0.2);
              }
            }
          `}</style>
        </motion.div>
      )}

      {/* Images Section */}
      {streamingState.images.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-4"
        >
          {streamingState.images.map((image) => (
            <ChainOfThoughtImage key={image.id} caption={image.caption}>
              <img
                src={image.url}
                alt={image.caption || 'Search result image'}
                className="w-full h-auto rounded-lg"
              />
            </ChainOfThoughtImage>
          ))}
        </motion.div>
      )}

      {/* Sources Section */}
      {streamingState.citations.length > 0 && (
        <Sources className="mt-6">
          <SourcesTrigger count={streamingState.citations.length} />
          <SourcesContent>
            {streamingState.citations.map((citation, index) => (
              <Source
                key={citation.id}
                href={citation.url}
                title={`[${index + 1}] ${citation.title}`}
                snippet={citation.snippet}
                favicon={citation.domain ? `https://www.google.com/s2/favicons?domain=${citation.domain}&sz=32` : undefined}
              />
            ))}
          </SourcesContent>
        </Sources>
      )}

      {/* Loading State */}
      {isStreaming && !streamingState.content && !streamingState.reasoning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-12"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-accent/20 dark:border-accent-light/20" />
              <motion.div
                className="absolute inset-0 w-12 h-12 rounded-full border-2 border-accent dark:border-accent-light border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <p className="text-sm text-ink-secondary dark:text-ink-inverse-secondary">
              Initializing Sonar Reasoning Pro...
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Export as default for easy importing
// ─────────────────────────────────────────────────────────────────────────────

export default SonarReasoningProDisplay