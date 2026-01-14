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

import { useMemo, memo } from 'react'
import {
  isToolUIPart,
  getToolName,
  type TextUIPart,
  type ReasoningUIPart,
} from 'ai'
import type { UIMessage } from '@ai-sdk/react'

// Use the parts type from UIMessage to avoid generic constraints
type MessagePart = UIMessage['parts'][number]
import { cn } from '@/utils/cn'
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning'
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput, mapToolPartState } from '@/components/ai-elements/tool'
import { ResponseMarkdown } from '@/components/ai-elements/response'
import { ChainOfThoughtOrchestration } from '@/components/ai-elements/chain-of-thought-orchestration'
// ToolState is used by mapToolPartState return type

// Orchestration tool names to render with special visualization
const ORCHESTRATION_TOOLS = ['workflow', 'swarm', 'graph']

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtMessageProps {
  parts: MessagePart[]
  isStreaming?: boolean
  messageId: string
  className?: string
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
  className
}: ChainOfThoughtMessageProps) {
  // Find last non-text index to determine final text boundary
  const lastNonTextIndex = useMemo(() => {
    let idx = -1
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part.type === 'reasoning' || isToolUIPart(part)) {
        idx = i
      }
    }
    return idx
  }, [parts])

  // Determine if we have final text output (to auto-collapse chain of thought)
  const hasFinalTextOutput = useMemo(() => {
    for (let i = lastNonTextIndex + 1; i < parts.length; i++) {
      const part = parts[i] as TextUIPart
      if (part.type === 'text' && part.text?.trim()) {
        return true
      }
    }
    return false
  }, [parts, lastNonTextIndex])

  // Separate process parts from final text
  const { processParts, finalTextParts } = useMemo(() => {
    const processParts: MessagePart[] = []
    const finalTextParts: TextUIPart[] = []

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i > lastNonTextIndex && part.type === 'text') {
        finalTextParts.push(part as TextUIPart)
      } else if (part.type !== 'step-start') {
        processParts.push(part)
      }
    }

    return { processParts, finalTextParts }
  }, [parts, lastNonTextIndex])

  // Calculate step count for header
  const stepCount = useMemo(() => {
    return processParts.filter(p => p.type === 'reasoning' || isToolUIPart(p)).length
  }, [processParts])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Chain of Thought (wraps all process parts) */}
      {processParts.length > 0 && (
        <ChainOfThought 
          defaultOpen={!hasFinalTextOutput}
          isStreaming={isStreaming && !hasFinalTextOutput}
          autoCollapseDelay={hasFinalTextOutput ? 2000 : 0}
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

      {/* Final Text Output (renders outside chain of thought) */}
      {finalTextParts.map((part, index) => (
        <ResponseMarkdown
          key={`${messageId}-text-${index}`}
          content={part.text}
          isStreaming={isStreaming && index === finalTextParts.length - 1 && part.state === 'streaming'}
        />
      ))}
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
  // Reasoning
  if (part.type === 'reasoning') {
    const reasoningPart = part as ReasoningUIPart
    const isReasoningStreaming = isStreaming && isLast && reasoningPart.state === 'streaming'

    return (
      <ChainOfThoughtStep
        label="Reasoning"
        status={isReasoningStreaming ? 'running' : 'complete'}
      >
        <Reasoning isStreaming={isReasoningStreaming} defaultOpen={isReasoningStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningPart.text}</ReasoningContent>
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

    // Check if this is an orchestration tool (workflow, swarm, graph)
    const isOrchestrationTool = ORCHESTRATION_TOOLS.some(t => 
      toolName.toLowerCase().includes(t)
    )

    if (isOrchestrationTool) {
      return (
        <ChainOfThoughtStep
          label={toolName}
          status={stepStatus}
        >
          <ChainOfThoughtOrchestration
            tool={{
              type: toolPart.type,
              toolCallId: toolPart.toolCallId,
              toolName: toolName,
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
        label={toolName}
        status={stepStatus}
      >
        <Tool defaultOpen={toolState !== 'success'}>
          <ToolHeader
            title={toolName}
            state={toolState}
          />
          <ToolContent>
            {toolPart.input != null && (
              <ToolInput 
                input={toolPart.input as Record<string, unknown>} 
                isStreaming={toolPart.state === 'input-streaming'}
              />
            )}
            {toolPart.state === 'output-available' && toolPart.output != null && (
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

  // Text within process parts (intermediate text)
  if (part.type === 'text') {
    const textPart = part as TextUIPart
    if (!textPart.text?.trim()) return null

    return (
      <ChainOfThoughtStep label="Response" status="complete">
        <ResponseMarkdown
          content={textPart.text}
          isStreaming={isStreaming && isLast && textPart.state === 'streaming'}
        />
      </ChainOfThoughtStep>
    )
  }

  return null
})

export { mapToolPartState }
