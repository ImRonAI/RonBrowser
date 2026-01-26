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

export const ChainOfThoughtOrchestration = memo(function ChainOfThoughtOrchestration({
  tool,
  className,
}: ChainOfThoughtOrchestrationProps) {
  const toolName = (tool.toolName || "").toLowerCase();

  if (toolName.includes("workflow")) {
    return (
      <WorkflowOrchestrationTask
        defaultExpanded={true}
        className={cn("w-full", className)}
      />
    );
  }

  if (toolName.includes("swarm")) {
    return (
      <SwarmOrchestrationTask
        defaultExpanded={true}
        className={cn("w-full", className)}
      />
    );
  }

  if (toolName.includes("graph")) {
    return (
      <GraphOrchestrationTask
        defaultExpanded={true}
        className={cn("w-full", className)}
      />
    );
  }

  return null;
});
