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
import { ChainOfThoughtOrchestration } from '@/components/ai-elements/chain-of-thought-orchestration'
import { initOrchestrationFromToolInput } from '@/utils/orchestration-stream'
import { extractSearchQuery, extractSearchResults, getSearchProvider } from '@/utils/search-tool-utils'
// ToolState is used by mapToolPartState return type

const ORCHESTRATION_KEYWORDS = ['workflow', 'swarm', 'graph'] as const

function isOrchestrationToolName(toolName?: string) {
  if (!toolName) return false
  const normalized = toolName.toLowerCase()
  if (ORCHESTRATION_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return true
  }

  // Handle namespaced tool names (e.g. "strands_tools.workflow", "mcp:swarm")
  const segments = normalized.split(/[./:\\|\\s-]+/g).filter(Boolean)
  return segments.some((segment) => ORCHESTRATION_KEYWORDS.includes(segment as typeof ORCHESTRATION_KEYWORDS[number]))
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
  const { processParts, finalTextParts, citations } = useMemo(() => {
    const processParts: MessagePart[] = []
    const finalTextParts: TextUIPart[] = []
    const citations: Citation[] = []

    for (const part of parts) {
      if (part.type === 'text') {
        const textPart = part as TextUIPart
        if (textPart.text?.trim()) {
          finalTextParts.push(textPart)
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

    return { processParts, finalTextParts, citations }
  }, [parts])

  const hasFinalTextOutput = finalTextParts.length > 0
  const resolvedCitations = citationsOverride && citationsOverride.length > 0
    ? citationsOverride
    : citations

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

      if (toolPart.state === 'input-available' || toolPart.state === 'output-available') {
        const payload = toolPart.input ?? toolPart.output
        const didInit = initOrchestrationFromToolInput(toolName, payload)
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
                />
              ))}
            </ChainOfThoughtContent>
          </ChainOfThought>
        )}

        {/* Final Text Output (inside same bubble, below reasoning) */}
        {finalTextParts.length > 0 && (
          <div className="p-6">
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
}

const PartRenderer = memo(function PartRenderer({ part, isLast, isStreaming }: PartRendererProps) {
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

    return (
      <ChainOfThoughtStep
        label="Reasoning"
        status={isReasoningStreaming ? 'running' : 'complete'}
      >
        <Reasoning isStreaming={isReasoningStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>
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
    const isOrchestrationTool = isOrchestrationToolName(toolName)

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
              toolName: toolName || 'tool',
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
