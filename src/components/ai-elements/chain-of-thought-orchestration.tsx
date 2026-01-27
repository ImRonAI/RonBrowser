/**
 * Chain of Thought Orchestration Component
 *
 * Renders the 70/30 orchestration split view (workflow/swarm/graph)
 * inside the chain-of-thought step.
 */

import { memo } from "react";
import { cn } from "@/utils/cn";
import { WorkflowOrchestrationTask } from "@/components/ai-elements/orchestration-tasks/workflow-orchestration-task";
import { SwarmOrchestrationTask } from "@/components/ai-elements/orchestration-tasks/swarm-orchestration-task";
import { GraphOrchestrationTask } from "@/components/ai-elements/orchestration-tasks/graph-orchestration-task";

interface ChainOfThoughtOrchestrationProps {
  tool: {
    type: string;
    toolCallId: string;
    toolName?: string;
    state: string;
    input?: unknown;
    output?: unknown;
  };
  className?: string;
}

const ORCHESTRATION_TOOLS = ['workflow', 'swarm', 'graph'] as const;
type OrchestrationToolName = typeof ORCHESTRATION_TOOLS[number];

function getOrchestrationToolName(toolName?: string): OrchestrationToolName | null {
  if (!toolName) return null;
  const normalized = toolName.toLowerCase();
  const segments = normalized.split(/[./:\\\s-]+/g).filter(Boolean);
  const match = segments.find((segment) =>
    ORCHESTRATION_TOOLS.includes(segment as OrchestrationToolName)
  );
  return (match as OrchestrationToolName) || null;
}

export const ChainOfThoughtOrchestration = memo(function ChainOfThoughtOrchestration({
  tool,
  className,
}: ChainOfThoughtOrchestrationProps) {
  const toolName = getOrchestrationToolName(tool.toolName);

  if (toolName === "workflow") {
    return (
      <WorkflowOrchestrationTask
        defaultExpanded={true}
        className={cn("w-full", className)}
      />
    );
  }

  if (toolName === "swarm") {
    return (
      <SwarmOrchestrationTask
        defaultExpanded={true}
        className={cn("w-full", className)}
      />
    );
  }

  if (toolName === "graph") {
    return (
      <GraphOrchestrationTask
        defaultExpanded={true}
        className={cn("w-full", className)}
      />
    );
  }

  return null;
});
