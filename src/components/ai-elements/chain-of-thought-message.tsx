/**
 * Chain of Thought Message Renderer
 *
 * Maps AI SDK UIMessage parts to AI Elements components.
 * Wraps all process parts (reasoning, tools) in ONE ChainOfThought container.
 * Final text renders OUTSIDE the ChainOfThought.
 * 
 * Inspired by ron-ai-web reference implementation.
 */

'use client'

import { useMemo, memo, useEffect, useRef, useCallback } from 'react'
import {
  isDataUIPart,
  isToolUIPart,
  getToolName,
  type TextUIPart,
  type ReasoningUIPart,
} from 'ai'
import type { UIMessage } from '@ai-sdk/react'
import {
  usePreviewStore, 
  isBrowserTool, 
  isProjectTool, 
  isDevServerCommand 
} from '@/stores/previewStore'

// Use the parts type from UIMessage to avoid generic constraints
type MessagePart = UIMessage['parts'][number]
import { cn } from '@/utils/cn'
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought'
import { ChainOfThoughtSearch } from '@/components/ai-elements/chain-of-thought-search'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning'
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput, mapToolPartState } from '@/components/ai-elements/tool'
import { ResponseMarkdown } from '@/components/ai-elements/response'
import { ResponseWithCitations, type Citation } from '@/components/ai-elements/response-with-citations'
// Plan and Queue components temporarily removed from rendering - see git history for reintegration
// import {
//   Plan,
//   PlanContent,
//   PlanDescription,
//   PlanFooter,
//   PlanHeader,
//   PlanTitle,
//   PlanTrigger,
// } from '@/components/ai-elements/plan'
// import {
//   Queue,
//   QueueItem,
//   QueueItemContent,
//   QueueItemDescription,
//   QueueItemIndicator,
//   QueueList,
//   QueueSection,
//   QueueSectionContent,
//   QueueSectionLabel,
//   QueueSectionTrigger,
// } from '@/components/ai-elements/queue'
import { Sources, SourcesContent, SourcesTrigger, Source } from '@/components/ai-elements/sources'
import { ChainOfThoughtOrchestration } from '@/components/ai-elements/chain-of-thought-orchestration'
import { initOrchestrationFromToolInput } from '@/utils/orchestration-stream'
import { extractSearchQuery, extractSearchResults, getSearchProvider } from '@/utils/search-tool-utils'
// ToolState is used by mapToolPartState return type

const ORCHESTRATION_KEYWORDS = ['workflow', 'swarm', 'graph'] as const
type OrchestrationToolName = typeof ORCHESTRATION_KEYWORDS[number]

type PlanStep = {
  id?: string
  title: string
  description?: string
  status?: 'pending' | 'running' | 'complete'
}

type PlanData = {
  title?: string
  description?: string
  steps?: PlanStep[]
  footer?: string
}

type QueueItemData = {
  id?: string
  title: string
  description?: string
  completed?: boolean
}

type QueueData = {
  label?: string
  items: QueueItemData[]
}

type UsageData = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
}

const PLAN_TAG = /<plan>([\s\S]*?)<\/plan>/gi
const QUEUE_TAG = /<queue>([\s\S]*?)<\/queue>/gi

function parseJsonBlock(raw: string) {
  try {
    return JSON.parse(raw.trim())
  } catch {
    return null
  }
}

function normalizePlanData(raw: any): PlanData | null {
  if (!raw || typeof raw !== 'object') return null
  const stepsRaw = Array.isArray(raw.steps || raw.items) ? (raw.steps || raw.items) : []
  const steps = stepsRaw
    .map((step: any, index: number) => {
      if (!step) return null
      const title = String(step.title || step.name || step.task || `Step ${index + 1}`)
      return {
        id: step.id ? String(step.id) : undefined,
        title,
        description: step.description ? String(step.description) : undefined,
        status: step.status,
      } as PlanStep
    })
    .filter(Boolean) as PlanStep[]

  return {
    title: raw.title ? String(raw.title) : raw.name ? String(raw.name) : 'Plan',
    description: raw.description ? String(raw.description) : undefined,
    steps: steps.length > 0 ? steps : undefined,
    footer: raw.footer ? String(raw.footer) : undefined,
  }
}

function normalizeQueueData(raw: any): QueueData | null {
  if (!raw || typeof raw !== 'object') return null
  const itemsRaw = Array.isArray(raw.items || raw.tasks || raw.todos)
    ? raw.items || raw.tasks || raw.todos
    : []
  const items = itemsRaw
    .map((item: any, index: number) => {
      if (!item) return null
      const title = String(item.title || item.name || item.task || `Item ${index + 1}`)
      return {
        id: item.id ? String(item.id) : undefined,
        title,
        description: item.description ? String(item.description) : undefined,
        completed: Boolean(item.completed || item.done),
      } as QueueItemData
    })
    .filter(Boolean) as QueueItemData[]

  if (items.length === 0) return null
  return {
    label: raw.label ? String(raw.label) : raw.title ? String(raw.title) : 'Queue',
    items,
  }
}

function normalizeUsageData(raw: unknown): UsageData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, any>
  const usage: UsageData = {}

  const toNumber = (value: unknown) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return undefined
    return Number.isFinite(value) ? value : undefined
  }

  const inputTokens = toNumber(data.inputTokens)
  const outputTokens = toNumber(data.outputTokens)
  const totalTokens = toNumber(data.totalTokens)

  const reasoningTokens =
    toNumber(data.reasoningTokens) ??
    toNumber(data.reasoning_tokens) ??
    toNumber(data.completion_tokens_details?.reasoning_tokens)

  if (inputTokens !== undefined) usage.inputTokens = inputTokens
  if (outputTokens !== undefined) usage.outputTokens = outputTokens
  if (totalTokens !== undefined) usage.totalTokens = totalTokens
  if (reasoningTokens !== undefined) usage.reasoningTokens = reasoningTokens

  return Object.keys(usage).length > 0 ? usage : null
}

// Plan and Queue extraction disabled - will be reintegrated after fix
// function extractStructuredBlocks(
//   text: string,
//   plans: PlanData[],
//   queues: QueueData[]
// ) {
//   let output = text
//   output = output.replace(PLAN_TAG, (match, json) => {
//     const parsed = parseJsonBlock(json)
//     const plan = normalizePlanData(parsed)
//     if (plan) {
//       plans.push(plan)
//       return ''
//     }
//     return match
//   })
//   output = output.replace(QUEUE_TAG, (match, json) => {
//     const parsed = parseJsonBlock(json)
//     const queue = normalizeQueueData(parsed)
//     if (queue) {
//       queues.push(queue)
//       return ''
//     }
//     return match
//   })
//   return output
// }

function getOrchestrationToolName(toolName?: string): OrchestrationToolName | null {
  if (!toolName) return null
  const normalized = toolName.toLowerCase()
  const segments = normalized.split(/[./:\\|\\s-]+/g).filter(Boolean)
  const match = segments.find((segment) =>
    ORCHESTRATION_KEYWORDS.includes(segment as OrchestrationToolName)
  )
  return (match as OrchestrationToolName) || null
}

function isOrchestrationToolName(toolName?: string) {
  return Boolean(getOrchestrationToolName(toolName))
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtMessageProps {
  parts: MessagePart[]
  isStreaming?: boolean
  messageId: string
  className?: string
  citations?: Citation[]
}

// Tool part type with all possible states
type AnyToolUIPart = {
  type: string
  toolCallId: string
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  input?: unknown
  output?: unknown
  errorText?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component - Memoized
// ─────────────────────────────────────────────────────────────────────────────

export const ChainOfThoughtMessage = memo(function ChainOfThoughtMessage({
  parts,
  isStreaming,
  messageId,
  className,
  citations: citationsOverride
}: ChainOfThoughtMessageProps) {
  const processedToolCallsRef = useRef(new Set<string>())

  // Separate process parts from final text and extract citations
  const { processParts, finalTextParts, citations, usage } = useMemo(() => {
    const processParts: MessagePart[] = []
    const finalTextParts: TextUIPart[] = []
    const citations: Citation[] = []
    let usage: UsageData | null = null
    // Plan and Queue extraction disabled - will be reintegrated after fix
    // const plans: PlanData[] = []
    // const queues: QueueData[] = []

    for (const part of parts) {
      // Plan and Queue data extraction disabled
      // if (isDataUIPart(part)) {
      //   if (part.type === 'data-plan') {
      //     const plan = normalizePlanData((part as any).data)
      //     if (plan) plans.push(plan)
      //   }
      //   if (part.type === 'data-queue') {
      //     const queue = normalizeQueueData((part as any).data)
      //     if (queue) queues.push(queue)
      //   }
      //   continue
      // }
      if (isDataUIPart(part)) {
        if (part.type === 'data-usage') {
          const normalized = normalizeUsageData((part as any).data)
          if (normalized) usage = normalized
        }
        // Skip data-plan and data-queue parts for now
        continue
      }

      if (part.type === 'text') {
        const textPart = part as TextUIPart
        if (textPart.text) {
          // extractStructuredBlocks disabled - Plan/Queue extraction removed
          // const cleaned = extractStructuredBlocks(textPart.text, plans, queues)
          const cleaned = textPart.text
          if (cleaned.trim()) {
            finalTextParts.push({ ...textPart, text: cleaned })
          }
        }
        continue
      }

      if (part.type === 'reasoning' || isToolUIPart(part)) {
        processParts.push(part)
      }

      // Extract citations from perplexity_search_api tool outputs
      if (isToolUIPart(part) && part.state === 'output-available') {
        const toolName = getToolName(part)
        if (toolName === 'perplexity_search_api' && (part as any).output) {
          const output = (part as any).output
          // Extract flat_results from tool output
          const flatResults = output.flat_results || []
          flatResults.forEach((result: any, index: number) => {
            citations.push({
              number: String(index + 1),
              title: result.title || 'Untitled',
              url: result.url || '',
              snippet: result.snippet
            })
          })
        }
      }
    }

    return { processParts, finalTextParts, citations, usage }
  }, [parts])

  const hasFinalTextOutput = finalTextParts.length > 0
  const resolvedCitations = citationsOverride && citationsOverride.length > 0
    ? citationsOverride
    : citations
  // Plan and Queue data extraction disabled - will be reintegrated after fix
  // const resolvedPlans = plans
  // const resolvedQueues = queues
  // const hasStructuredBlocks = resolvedPlans.length > 0 || resolvedQueues.length > 0
  const hasStructuredBlocks = false

  // Calculate step count for header
  const stepCount = useMemo(() => {
    return processParts.filter(p => p.type === 'reasoning' || isToolUIPart(p)).length
  }, [processParts])

  const hasOrchestrationTools = useMemo(() => {
    return processParts.some((part) => {
      if (!isToolUIPart(part)) return false
      return isOrchestrationToolName(getToolName(part))
    })
  }, [processParts])

  // Auto-trigger preview panel when browser/project tools are detected
  const { openBrowserPreview, openProjectPreview, updateBrowserPreview } = usePreviewStore()
  
  useEffect(() => {
    // Scan through parts for browser/project tools
    for (const part of parts) {
      if (!isToolUIPart(part)) continue
      
      const toolName = getToolName(part)
      const toolPart = part as AnyToolUIPart
      
      // Handle browser tools
      if (isBrowserTool(toolName)) {
        // Extract data from tool output
        if (toolPart.state === 'output-available' && toolPart.output) {
          const output = toolPart.output as Record<string, unknown>
          
          // Check for screenshot in output
          const screenshot = output.screenshot || output.image || output.base64
          const url = output.url || output.current_url || (toolPart.input as Record<string, unknown>)?.url
          const title = output.title || output.page_title
          
          if (screenshot || url) {
            openBrowserPreview({
              url: typeof url === 'string' ? url : undefined,
              screenshot: typeof screenshot === 'string' ? screenshot : undefined,
              title: typeof title === 'string' ? title : undefined,
              isLive: false,
            })
          }
        } else if (toolPart.state === 'input-available' || toolPart.state === 'input-streaming') {
          // Tool is running - show loading state
          const input = toolPart.input as Record<string, unknown>
          if (input?.url) {
            updateBrowserPreview({
              url: typeof input.url === 'string' ? input.url : undefined,
            })
          }
        }
      }
      
      // Handle project tools
      if (isProjectTool(toolName) || (toolName === 'shell' && isDevServerCommand(toolPart.input))) {
        const input = toolPart.input as Record<string, unknown>
        
        if (toolPart.state === 'input-available' || toolPart.state === 'input-streaming') {
          openProjectPreview({
            name: typeof input?.command === 'string' ? input.command.split(' ')[0] : 'Dev Server',
            status: 'starting',
          })
        } else if (toolPart.state === 'output-available') {
          const output = toolPart.output as Record<string, unknown>
          // Look for URL in output (e.g., dev server started at localhost:3000)
          let devUrl: string | undefined
          if (typeof output?.url === 'string') {
            devUrl = output.url
          } else if (typeof output?.output === 'string') {
            // Parse output for localhost URLs
            const urlMatch = output.output.match(/https?:\/\/localhost:\d+/)
            if (urlMatch) {
              devUrl = urlMatch[0]
            }
          }
          
          openProjectPreview({
            url: devUrl,
            status: devUrl ? 'running' : 'stopped',
          })
        }
      }
    }
  }, [parts, openBrowserPreview, openProjectPreview, updateBrowserPreview])

  // Initialize orchestration store from tool input (workflow/swarm/graph)
  useEffect(() => {
    for (const part of parts) {
      if (!isToolUIPart(part)) continue
      const toolPart = part as AnyToolUIPart
      const toolName = getToolName(part)
      const toolCallId = toolPart.toolCallId

      if (!toolName || !toolCallId) continue
      if (processedToolCallsRef.current.has(toolCallId)) continue

      if (toolPart.state === 'input-available') {
        const payload = toolPart.input
        const didInit = payload != null && initOrchestrationFromToolInput(toolName, payload)
        if (didInit) {
          processedToolCallsRef.current.add(toolCallId)
        }
      }
    }
  }, [parts])

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Message bubble with reasoning at top */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* Chain of Thought at top of bubble */}
        {processParts.length > 0 && (
          <ChainOfThought
            defaultOpen={hasOrchestrationTools || !hasFinalTextOutput}
            isStreaming={isStreaming && !hasFinalTextOutput}
            autoCollapseDelay={hasOrchestrationTools ? 0 : hasFinalTextOutput ? 2000 : 0}
          >
            <ChainOfThoughtHeader>
              {isStreaming && !hasFinalTextOutput
                ? 'Processing...'
                : `Thought Process (${stepCount} step${stepCount !== 1 ? 's' : ''})`
              }
            </ChainOfThoughtHeader>
            <ChainOfThoughtContent>
              {processParts.map((part, index) => (
                <PartRenderer
                  key={`${messageId}-part-${index}`}
                  part={part}
                  isLast={index === processParts.length - 1}
                  isStreaming={isStreaming}
                  reasoningTokens={usage?.reasoningTokens}
                />
              ))}
            </ChainOfThoughtContent>
          </ChainOfThought>
        )}

        {/* Plan and Queue components temporarily disabled - will be reintegrated after fix */}
        {/* {hasStructuredBlocks && (
          <div className={cn('px-6 pt-5', finalTextParts.length === 0 && 'pb-4')}>
            <div className="space-y-4">
              {resolvedPlans.map((plan, planIndex) => (
                <Plan key={`${messageId}-plan-${planIndex}`} defaultOpen>
                  ...
                </Plan>
              ))}
              {resolvedQueues.map((queue, queueIndex) => (
                <Queue key={`${messageId}-queue-${queueIndex}`}>
                  ...
                </Queue>
              ))}
            </div>
          </div>
        )} */}

        {/* Final Text Output (inside same bubble, below reasoning) */}
        {finalTextParts.length > 0 && (
          <div className={cn('p-6', hasStructuredBlocks && 'pt-4')}>
            {finalTextParts.map((part, index) => (
              <ResponseWithCitations
                key={`${messageId}-text-${index}`}
                content={part.text}
                citations={resolvedCitations}
                isStreaming={isStreaming && index === finalTextParts.length - 1 && part.state === 'streaming'}
              />
            ))}
          </div>
        )}

        {resolvedCitations.length > 0 && (
          <div className={cn('px-6 pb-6', finalTextParts.length === 0 && !hasStructuredBlocks && 'pt-4')}>
            <Sources>
              <SourcesTrigger count={resolvedCitations.length} />
              <SourcesContent>
                {resolvedCitations.map((citation, index) => (
                  <Source key={`${messageId}-source-${index}`} href={citation.url}>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        [{index + 1}] {citation.title}
                      </p>
                      {citation.snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {citation.snippet}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground/80">
                        {(() => {
                          try {
                            return new URL(citation.url).hostname
                          } catch {
                            return citation.url
                          }
                        })()}
                      </p>
                    </div>
                  </Source>
                ))}
              </SourcesContent>
            </Sources>
          </div>
        )}
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Part Renderer - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface PartRendererProps {
  part: MessagePart
  isLast: boolean
  isStreaming?: boolean
  reasoningTokens?: number
}

const PartRenderer = memo(function PartRenderer({ part, isLast, isStreaming, reasoningTokens }: PartRendererProps) {
  const { openBrowserPreview } = usePreviewStore()

  const handleSearchPreview = useCallback(
    (result: { url?: string; title?: string }) => {
      if (!result.url) return
      openBrowserPreview({
        url: result.url,
        title: result.title,
        isLive: true,
      })
    },
    [openBrowserPreview]
  )

  // Reasoning
  if (part.type === 'reasoning') {
    const reasoningPart = part as ReasoningUIPart
    const isReasoningStreaming = isStreaming && isLast && reasoningPart.state === 'streaming'
    const formattedReasoningTokens =
      typeof reasoningTokens === 'number'
        ? new Intl.NumberFormat('en-US').format(Math.round(reasoningTokens))
        : null

    return (
      <ChainOfThoughtStep
        label="Reasoning"
        status={isReasoningStreaming ? 'running' : 'complete'}
      >
        <Reasoning isStreaming={isReasoningStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>
            {formattedReasoningTokens && (
              <div className="mb-2 text-[11px] text-muted-foreground">
                Reasoning tokens: {formattedReasoningTokens}
              </div>
            )}
            <ResponseMarkdown
              content={reasoningPart.text}
              isStreaming={isReasoningStreaming}
            />
          </ReasoningContent>
        </Reasoning>
      </ChainOfThoughtStep>
    )
  }

  // Tool
  if (isToolUIPart(part)) {
    const toolPart = part as AnyToolUIPart
    const toolName = getToolName(part)
    const toolState = mapToolPartState(toolPart.state)
    const stepStatus = toolState === 'success' ? 'complete' : toolState === 'error' ? 'error' : 'running'
    const isToolStreaming = toolPart.state === 'input-streaming' || toolPart.state === 'input-available'
    const searchProvider = getSearchProvider(toolName)
    const searchQuery = searchProvider ? extractSearchQuery(toolPart.input) : null
    const searchResults = searchProvider
      ? extractSearchResults(toolPart.output, searchProvider)
      : []
    const shouldShowSearch = Boolean(searchProvider)
    const hasToolOutput = toolPart.output != null || toolPart.errorText != null
    const shouldKeepOpen = toolState !== 'success' || shouldShowSearch || hasToolOutput
    const orchestrationName = getOrchestrationToolName(toolName)
    const isOrchestrationTool = Boolean(orchestrationName)

    if (isOrchestrationTool) {
      return (
        <ChainOfThoughtStep
          label={toolName || 'Tool'}
          status={stepStatus}
        >
          <ChainOfThoughtOrchestration
            tool={{
              type: toolPart.type,
              toolCallId: toolPart.toolCallId,
              toolName: orchestrationName || toolName || 'tool',
              state: toolPart.state,
              input: toolPart.input,
              output: toolPart.output,
            }}
          />
        </ChainOfThoughtStep>
      )
    }

    // Regular tool rendering
    return (
      <ChainOfThoughtStep
        label={toolName || 'Tool'}
        status={stepStatus}
      >
        <Tool
          isStreaming={isToolStreaming}
          defaultOpen={shouldKeepOpen}
        >
          <ToolHeader
            title={toolName || 'Tool'}
            state={toolState}
          />
          <ToolContent>
            {toolPart.input != null && (
              <ToolInput 
                input={toolPart.input as Record<string, unknown>} 
                isStreaming={isToolStreaming}
              />
            )}
            {shouldShowSearch && searchProvider && (
              <ChainOfThoughtSearch
                provider={searchProvider}
                query={searchQuery || toolName || 'Search'}
                results={searchResults}
                isSearching={isToolStreaming}
                error={toolPart.state === 'output-error' ? toolPart.errorText : undefined}
                onResultClick={handleSearchPreview}
                onExpandPreview={handleSearchPreview}
              />
            )}
            {!shouldShowSearch && toolPart.state === 'output-available' && toolPart.output != null && (
              <ToolOutput output={toolPart.output} />
            )}
            {toolPart.state === 'output-error' && toolPart.errorText && (
              <ToolOutput errorText={toolPart.errorText} />
            )}
          </ToolContent>
        </Tool>
      </ChainOfThoughtStep>
    )
  }

  return null
})

export { mapToolPartState }
