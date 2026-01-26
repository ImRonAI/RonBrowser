/**
 * Agent Formation Diagram for Search Agent
 *
 * Visualizes the search agent's orchestration (swarm/workflow/graph)
 * using existing AI Elements components:
 * - ChainOfThoughtOrchestration (inline compact view)
 * - AgentOrchestrationNode (expandable nodes with streaming)
 * - Canvas (React Flow wrapper)
 */

import { memo, useMemo } from 'react'
import { ChainOfThoughtOrchestration } from '@/components/ai-elements/chain-of-thought-orchestration'
import type { UIMessage } from '@ai-sdk/react'

interface AgentFormationDiagramProps {
  messages: UIMessage[]
  className?: string
}

export const AgentFormationDiagram = memo(function AgentFormationDiagram({
  messages,
  className
}: AgentFormationDiagramProps) {
  // Extract orchestration tool calls from messages
  const orchestrationTools = useMemo(() => {
    const tools: any[] = []

    for (const message of messages) {
      if (message.role === 'assistant') {
        for (const part of message.parts) {
          if (part.type.startsWith('tool-')) {
            const toolName = part.type.replace('tool-', '').toLowerCase()

            // Check if it's an orchestration tool (workflow, swarm, graph)
            if (['workflow', 'swarm', 'graph'].some(t => toolName.includes(t))) {
              tools.push({
                type: part.type,
                toolCallId: (part as any).toolCallId,
                toolName: toolName,
                state: (part as any).state,
                input: (part as any).input,
                output: (part as any).output,
              })
            }
          }
        }
      }
    }

    return tools
  }, [messages])

  if (orchestrationTools.length === 0) return null

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-ink-base dark:text-ink-inverse-base mb-3">
        Agent Formation
      </h3>

      {/* Render each orchestration tool */}
      <div className="space-y-3">
        {orchestrationTools.map((tool, index) => (
          <ChainOfThoughtOrchestration
            key={`${tool.toolCallId}-${index}`}
            tool={tool}
          />
        ))}
      </div>
    </div>
  )
})
