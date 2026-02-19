'use client'

import { memo, useMemo } from 'react'
import { getToolName, isDataUIPart, isToolUIPart, type UIMessage } from 'ai'
import { cn } from '@/utils/cn'
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning'
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool'
import { ResponseWithCitations, type Citation } from '@/components/ai-elements/response-with-citations'
import { ThinkingIndicator } from '@/components/ai-elements/loader'

type MessagePart = UIMessage['parts'][number]

type ChainOfThoughtMessageProps = {
  parts: MessagePart[]
  citations?: Citation[]
  isStreaming?: boolean
  messageId?: string
  className?: string
}

type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'
  | 'output-denied'
  | 'approval-requested'
  | 'approval-responded'

function toToolState(value: unknown): ToolState {
  if (typeof value === 'string') {
    if (
      value === 'input-streaming' ||
      value === 'input-available' ||
      value === 'output-available' ||
      value === 'output-error' ||
      value === 'output-denied' ||
      value === 'approval-requested' ||
      value === 'approval-responded'
    ) {
      return value
    }

    if (value === 'running') return 'input-available'
    if (value === 'pending') return 'input-streaming'
    if (value === 'success') return 'output-available'
    if (value === 'error') return 'output-error'
  }

  return 'input-streaming'
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function getPartText(part: MessagePart) {
  if (part.type === 'text') {
    return asText((part as { text?: string }).text)
  }

  return ''
}

function getMergedReasoningText(reasoningParts: Array<MessagePart & { text?: string }>) {
  return reasoningParts.map((part) => asText(part.text)).filter(Boolean).join('')
}

function sanitizeVisibleResponseText(textContent: string, reasoningText: string) {
  if (!textContent || !reasoningText) return textContent

  // Defensive guard for streams that accidentally replay reasoning as text prefix.
  if (textContent.startsWith(reasoningText)) {
    return textContent.slice(reasoningText.length).replace(/^\s+/, '')
  }

  return textContent
}

function getReasoningParts(parts: MessagePart[]) {
  return parts.filter((part) => part.type === 'reasoning') as Array<
    MessagePart & { text?: string }
  >
}

function getToolParts(parts: MessagePart[]) {
  return parts.filter((part) => isToolUIPart(part)) as Array<
    MessagePart & {
      type: string
      state?: string
      input?: unknown
      output?: unknown
      errorText?: string
      toolName?: string
    }
  >
}

function getDataParts(parts: MessagePart[]) {
  return parts.filter((part) => isDataUIPart(part)) as Array<
    MessagePart & { type: string; data?: unknown }
  >
}

export const ChainOfThoughtMessage = memo(function ChainOfThoughtMessage({
  parts,
  citations = [],
  isStreaming = false,
  messageId,
  className,
}: ChainOfThoughtMessageProps) {
  const reasoningParts = useMemo(() => getReasoningParts(parts), [parts])

  const textContent = useMemo(
    () => {
      const visibleText = parts.map((part) => getPartText(part)).filter(Boolean).join('')
      const mergedReasoning = getMergedReasoningText(reasoningParts)
      return sanitizeVisibleResponseText(visibleText, mergedReasoning)
    },
    [parts, reasoningParts],
  )

  const toolParts = useMemo(() => getToolParts(parts), [parts])
  const dataParts = useMemo(() => getDataParts(parts), [parts])

  const hasProcessParts =
    reasoningParts.length > 0 || toolParts.length > 0 || dataParts.length > 0

  return (
    <div className={cn('space-y-3', className)} data-message-id={messageId}>
      {hasProcessParts && (
        <ChainOfThought defaultOpen={isStreaming}>
          <ChainOfThoughtHeader>
            {isStreaming ? 'Working…' : 'Reasoning and tool calls'}
          </ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            {reasoningParts.map((part, index) => {
              const reasoningText = asText(part.text)
              if (!reasoningText.trim()) return null

              return (
                <ChainOfThoughtStep
                  key={`reasoning-${index}`}
                  label={`Reasoning ${index + 1}`}
                  status={isStreaming ? 'active' : 'complete'}
                >
                  <Reasoning defaultOpen={isStreaming} isStreaming={isStreaming}>
                    <ReasoningTrigger />
                    <ReasoningContent>{reasoningText}</ReasoningContent>
                  </Reasoning>
                </ChainOfThoughtStep>
              )
            })}

            {toolParts.map((part, index) => {
              const state = toToolState(part.state)
              const toolType = typeof part.type === 'string' ? part.type : 'dynamic-tool'
              const toolName =
                (typeof part.toolName === 'string' && part.toolName) ||
                getToolName(part as any) ||
                `tool-${index + 1}`

              return (
                <ChainOfThoughtStep
                  key={`tool-${index}-${toolName}`}
                  label={`Tool: ${toolName}`}
                  status={state.startsWith('output-') ? 'complete' : 'active'}
                >
                  <Tool>
                    {toolType === 'dynamic-tool' ? (
                      <ToolHeader type={toolType as 'dynamic-tool'} toolName={toolName} state={state} />
                    ) : (
                      <ToolHeader type={toolType as any} state={state} />
                    )}
                    <ToolContent>
                      {part.input !== undefined && <ToolInput input={part.input as any} />}
                      {(part.output !== undefined || part.errorText) && (
                        <ToolOutput
                          output={(part.output as any) ?? null}
                          errorText={part.errorText as any}
                        />
                      )}
                    </ToolContent>
                  </Tool>
                </ChainOfThoughtStep>
              )
            })}

            {dataParts.map((part, index) => (
              <ChainOfThoughtStep
                key={`data-${index}-${part.type}`}
                label={part.type.replace(/^data-/, '').replace(/-/g, ' ') || 'Data event'}
                status={isStreaming ? 'active' : 'complete'}
              >
                <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs">
                  {safeJson(part.data)}
                </pre>
              </ChainOfThoughtStep>
            ))}
          </ChainOfThoughtContent>
        </ChainOfThought>
      )}

      {textContent.trim() ? (
        <ResponseWithCitations
          className="prose prose-sm max-w-none dark:prose-invert"
          citations={citations}
          content={textContent}
          isStreaming={isStreaming}
        />
      ) : (
        isStreaming && <ThinkingIndicator text="Thinking…" />
      )}
    </div>
  )
})
