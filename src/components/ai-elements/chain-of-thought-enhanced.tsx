/**
 * Enhanced Chain of Thought Component
 *
 * Integrates search visualization directly into Chain of Thought steps.
 * Automatically detects and renders search tool calls with rich visuals.
 */

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'
import { ChainOfThoughtSearch } from './chain-of-thought-search'
import { Sources, SourcesTrigger, SourcesContent, Source } from './sources'
import { SearchStreamProcessor } from '@/utils/search-stream-parser'
import type { SearchProvider, SearchResult } from './chain-of-thought-search'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChainOfThoughtStepData {
  id: string
  type: 'thinking' | 'search' | 'action' | 'result'
  label: string
  description?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  searchData?: {
    provider: SearchProvider
    query: string
    results: SearchResult[]
    duration?: number
    error?: string
  }
  actionData?: {
    tool: string
    args: any
    result?: any
  }
  content?: React.ReactNode
  timestamp: number
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtEnhanced
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtEnhancedProps {
  steps: ChainOfThoughtStepData[]
  defaultOpen?: boolean
  showSources?: boolean
  className?: string
  onResultClick?: (result: SearchResult) => void
  onExpandPreview?: (result: SearchResult) => void
}

export function ChainOfThoughtEnhanced({
  steps,
  defaultOpen = true,
  showSources = true,
  className,
  onResultClick,
  onExpandPreview
}: ChainOfThoughtEnhancedProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Collect all search results for sources
  const allSearchResults = useMemo(() => {
    const results: SearchResult[] = []
    const seen = new Set<string>()

    steps.forEach(step => {
      if (step.type === 'search' && step.searchData?.results) {
        step.searchData.results.forEach(result => {
          if (!seen.has(result.url)) {
            seen.add(result.url)
            results.push(result)
          }
        })
      }
    })

    return results
  }, [steps])

  return (
    <div className={cn(
      'rounded-xl border border-surface-200 dark:border-surface-700',
      'overflow-hidden',
      className
    )}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between',
          'px-4 py-3',
          'bg-surface-50 dark:bg-surface-800',
          'hover:bg-surface-100 dark:hover:bg-surface-700',
          'transition-colors duration-200'
        )}
      >
        <div className="flex items-center gap-2">
          <BrainIcon className="w-4 h-4 text-accent dark:text-accent-light" />
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            Chain of Thought
          </span>
          {steps.some(s => s.status === 'running') && (
            <span className="text-label text-accent dark:text-accent-light">
              Processing...
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {showSources && allSearchResults.length > 0 && (
            <Sources>
              <SourcesTrigger count={allSearchResults.length} />
              <SourcesContent>
                {allSearchResults.map((result) => (
                  <Source
                    key={result.id}
                    href={result.url}
                    title={result.title}
                    snippet={result.snippet}
                    favicon={result.favicon}
                  />
                ))}
              </SourcesContent>
            </Sources>
          )}

          <ChevronIcon
            className={cn(
              'w-4 h-4 text-ink-muted dark:text-ink-inverse-muted',
              'transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {steps.map((step, index) => (
                <ChainOfThoughtStepEnhanced
                  key={step.id}
                  step={step}
                  isLast={index === steps.length - 1}
                  onResultClick={onResultClick}
                  onExpandPreview={onExpandPreview}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtStepEnhanced
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtStepEnhancedProps {
  step: ChainOfThoughtStepData
  isLast?: boolean
  onResultClick?: (result: SearchResult) => void
  onExpandPreview?: (result: SearchResult) => void
}

function ChainOfThoughtStepEnhanced({
  step,
  isLast = false,
  onResultClick,
  onExpandPreview
}: ChainOfThoughtStepEnhancedProps) {
  const icon = getStepIcon(step.type)

  return (
    <div className="flex gap-3">
      {/* Status indicator */}
      <div className="flex flex-col items-center">
        <StepStatusIndicator status={step.status} icon={icon} />
        {!isLast && (
          <div className="w-px flex-1 bg-surface-200 dark:bg-surface-700 mt-2" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-body-sm font-medium text-ink dark:text-ink-inverse">
              {step.label}
            </h4>
            {step.description && (
              <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary mt-0.5">
                {step.description}
              </p>
            )}
          </div>

          {step.status === 'running' && (
            <span className="text-label text-accent dark:text-accent-light">
              Running...
            </span>
          )}
        </div>

        {/* Render search results */}
        {step.type === 'search' && step.searchData && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="mt-3"
          >
            <ChainOfThoughtSearch
              provider={step.searchData.provider}
              query={step.searchData.query}
              results={step.searchData.results}
              isSearching={step.status === 'running'}
              duration={step.searchData.duration}
              error={step.searchData.error}
              onResultClick={onResultClick}
              onExpandPreview={onExpandPreview}
            />
          </motion.div>
        )}

        {/* Render custom content */}
        {step.content && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="mt-2"
          >
            {step.content}
          </motion.div>
        )}

        {/* Render action data */}
        {step.type === 'action' && step.actionData && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="mt-2"
          >
            <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800">
              <div className="flex items-center gap-2 text-body-xs">
                <ToolIcon className="w-3.5 h-3.5 text-ink-muted dark:text-ink-inverse-muted" />
                <code className="font-mono text-accent dark:text-accent-light">
                  {step.actionData.tool}
                </code>
              </div>
              {step.actionData.args && (
                <pre className="mt-2 text-body-xs text-ink-secondary dark:text-ink-inverse-secondary overflow-x-auto">
                  {JSON.stringify(step.actionData.args, null, 2)}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StepStatusIndicator
// ─────────────────────────────────────────────────────────────────────────────

function StepStatusIndicator({
  status,
  icon
}: {
  status: 'pending' | 'running' | 'complete' | 'error'
  icon?: React.ReactNode
}) {
  const config = {
    pending: { bg: 'bg-surface-200 dark:bg-surface-700', color: 'text-ink-muted' },
    running: { bg: 'bg-accent/10 dark:bg-accent-light/10', color: 'text-accent dark:text-accent-light' },
    complete: { bg: 'bg-green-100 dark:bg-green-900/30', color: 'text-green-600 dark:text-green-400' },
    error: { bg: 'bg-red-100 dark:bg-red-900/30', color: 'text-red-600 dark:text-red-400' },
  }

  const { bg, color } = config[status]

  return (
    <div className={cn(
      'w-6 h-6 rounded-full flex items-center justify-center',
      bg
    )}>
      {status === 'running' ? (
        <Loader size={12} />
      ) : status === 'complete' ? (
        <CheckIcon className={cn('w-3 h-3', color)} />
      ) : status === 'error' ? (
        <XIcon className={cn('w-3 h-3', color)} />
      ) : icon ? (
        <span className={cn('w-3 h-3', color)}>{icon}</span>
      ) : (
        <div className={cn('w-2 h-2 rounded-full bg-current', color)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Processing Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useChainOfThoughtStream(stream: ReadableStream | null) {
  const [steps, setSteps] = useState<ChainOfThoughtStepData[]>([])
  const processor = useMemo(() => new SearchStreamProcessor(), [])

  useEffect(() => {
    if (!stream) return

    const reader = stream.getReader()
    const decoder = new TextDecoder()

    async function processStream() {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value)
          const lines = text.split('\n')

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim()
              if (data === '[DONE]') continue

              try {
                const event = JSON.parse(data)
                processEvent(event)
              } catch (e) {
                console.error('Failed to parse SSE event:', e)
              }
            }
          }
        }
      } catch (error) {
        console.error('Stream processing error:', error)
      }
    }

    function processEvent(event: any) {
      // Handle tool calls (search starts)
      if (event.tool_calls) {
        event.tool_calls.forEach((toolCall: any) => {
          const searchCall = processor.processToolCall(toolCall)
          if (searchCall) {
            const step: ChainOfThoughtStepData = {
              id: searchCall.toolCallId,
              type: 'search',
              label: `Searching ${searchCall.provider}`,
              description: searchCall.query,
              status: 'running',
              searchData: {
                provider: searchCall.provider,
                query: searchCall.query,
                results: [],
              },
              timestamp: searchCall.timestamp,
            }
            setSteps(prev => [...prev, step])
          }
        })
      }

      // Handle tool results (search completes)
      if (event.tool_results) {
        event.tool_results.forEach((toolResult: any) => {
          const searchResult = processor.processToolResult(toolResult)
          if (searchResult) {
            setSteps(prev =>
              prev.map(step =>
                step.id === searchResult.toolCallId
                  ? {
                      ...step,
                      status: searchResult.error ? 'error' : 'complete',
                      searchData: {
                        ...step.searchData!,
                        results: searchResult.results,
                        duration: searchResult.duration,
                        error: searchResult.error,
                      },
                    }
                  : step
              )
            )
          }
        })
      }

      // Handle thinking/reasoning steps
      if (event.thinking || event.reasoning) {
        const step: ChainOfThoughtStepData = {
          id: `thinking-${Date.now()}`,
          type: 'thinking',
          label: 'Analyzing',
          description: event.thinking || event.reasoning,
          status: 'complete',
          timestamp: Date.now(),
        }
        setSteps(prev => [...prev, step])
      }
    }

    processStream()

    return () => {
      reader.cancel()
      processor.clear()
    }
  }, [stream, processor])

  return { steps, processor }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getStepIcon(type: ChainOfThoughtStepData['type']): React.ReactNode {
  switch (type) {
    case 'thinking':
      return <BrainIcon className="w-3 h-3" />
    case 'search':
      return <SearchIcon className="w-3 h-3" />
    case 'action':
      return <ToolIcon className="w-3 h-3" />
    case 'result':
      return <CheckIcon className="w-3 h-3" />
    default:
      return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function ToolIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}