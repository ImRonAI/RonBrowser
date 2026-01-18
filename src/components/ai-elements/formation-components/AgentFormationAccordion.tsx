/**
 * AgentFormationAccordion Component
 *
 * Main component that wraps formation canvas + subagent panel in split view
 * within CollapsibleAgentTask accordion. Displays workflow/swarm/graph orchestrations.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { CollapsibleAgentTask } from "@/components/ai-elements/chain-of-thought-agent";
import { AgentWorkflowCanvas } from "@/components/ai-elements/agent-workflow-canvas";
import { AgentSwarmCanvas } from "@/components/ai-elements/agent-swarm-canvas";
import { AgentGraphCanvas } from "@/components/ai-elements/agent-graph-canvas/AgentGraphCanvas";
import { SubagentTransparencyPanel } from "./SubagentTransparencyPanel";
import { useOrchestrationStore } from "@/stores/orchestrationStore";
import type {
  WorkflowState,
  SwarmState,
  GraphState,
  AgentStreamingData,
} from "@/components/ai-elements/strands-orchestration/types";
import type { TaskStatus } from "@/components/ai-elements/task";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentFormationAccordionProps {
  formationType: "workflow" | "swarm" | "graph";
  isFormationActive: boolean;
  isFormationComplete: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AgentFormationAccordion({
  formationType,
  isFormationActive,
  isFormationComplete,
  defaultExpanded,
  className,
}: AgentFormationAccordionProps) {
  const {
    workflowState,
    workflowTasks,
    swarmState,
    swarmNodes,
    graphState,
    graphNodes,
    activeAgentIds,
    agentStreamingData,
    getCompletedNodeOutput,
  } = useOrchestrationStore();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // ─── Auto-select first active agent ───
  useEffect(() => {
    if (activeAgentIds.length > 0 && !selectedAgentId) {
      setSelectedAgentId(activeAgentIds[0]);
    } else if (activeAgentIds.length === 0 && isFormationComplete) {
      // Formation complete, keep selection or pick first node
      if (!selectedAgentId) {
        if (formationType === "workflow" && workflowTasks.length > 0) {
          setSelectedAgentId(workflowTasks[0].taskId);
        } else if (formationType === "swarm" && swarmNodes.length > 0) {
          setSelectedAgentId(swarmNodes[0].id);
        } else if (formationType === "graph" && graphNodes.length > 0) {
          setSelectedAgentId(graphNodes[0].id);
        }
      }
    }
  }, [activeAgentIds, selectedAgentId, isFormationComplete, formationType, workflowTasks, swarmNodes, graphNodes]);

  // ─── Cleanup: switch tab if selected agent completes ───
  useEffect(() => {
    if (selectedAgentId && !activeAgentIds.includes(selectedAgentId) && activeAgentIds.length > 0) {
      // Selected agent is no longer active, switch to another active agent
      setSelectedAgentId(activeAgentIds[0]);
    }
  }, [activeAgentIds, selectedAgentId]);

  // ─── Handle node click ───
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedAgentId(nodeId);
    },
    []
  );

  // ─── Get agent name helper ───
  const getAgentName = useCallback(
    (nodeId: string): string => {
      if (formationType === "workflow") {
        const task = workflowTasks.find((t) => t.taskId === nodeId);
        return task?.description || "Task";
      } else if (formationType === "swarm") {
        const node = swarmNodes.find((n) => n.id === nodeId);
        return node?.data.agent.name || "Agent";
      } else if (formationType === "graph") {
        const node = graphNodes.find((n) => n.id === nodeId);
        return node?.data.agent.name || "Agent";
      }
      return "Agent";
    },
    [formationType, workflowTasks, swarmNodes, graphNodes]
  );

  // ─── Get agent description helper ───
  const getAgentDescription = useCallback(
    (nodeId: string): string | undefined => {
      if (formationType === "swarm") {
        const node = swarmNodes.find((n) => n.id === nodeId);
        return node?.data.agent.description;
      } else if (formationType === "graph") {
        const node = graphNodes.find((n) => n.id === nodeId);
        return node?.data.agent.description;
      }
      return undefined;
    },
    [formationType, swarmNodes, graphNodes]
  );

  // ─── Formation status ───
  const formationStatus: TaskStatus = useMemo(() => {
    if (isFormationActive) return "running";
    if (isFormationComplete) {
      // Check if any nodes failed
      if (formationType === "workflow") {
        return workflowTasks.some((t) => t.status === "error") ? "error" : "success";
      } else if (formationType === "swarm") {
        return swarmNodes.some((n) => n.data.status === "error") ? "error" : "success";
      } else if (formationType === "graph") {
        return graphNodes.some((n) => n.data.status === "error") ? "error" : "success";
      }
      return "success";
    }
    return "pending";
  }, [isFormationActive, isFormationComplete, formationType, workflowTasks, swarmNodes, graphNodes]);

  // ─── Formation name ───
  const formationName = useMemo(() => {
    const typeLabel =
      formationType === "workflow"
        ? "Workflow"
        : formationType === "swarm"
          ? "Swarm"
          : "Graph";
    return `${typeLabel} Formation`;
  }, [formationType]);

  // ─── Show tabs only for graph with multiple active nodes ───
  const shouldShowTabs = formationType === "graph" && activeAgentIds.length > 1;

  return (
    <CollapsibleAgentTask
      agentName={formationName}
      status={formationStatus}
      tools={[formationType]}
      defaultExpanded={defaultExpanded ?? (isFormationActive || isFormationComplete)}
      className={className}
    >
      <div className="flex gap-4 h-[600px]">
        {/* Left: Formation Canvas (70%) */}
        <div className="flex-[7] border-r border-surface-200 dark:border-surface-700 pr-4">
          {formationType === "workflow" && (
            <AgentWorkflowCanvas
              onNodeClick={(task) => handleNodeClick(task.taskId)}
              showControls={false}
              showMiniMap={false}
              showStepBadges={false}
              showProgressBar={false}
            />
          )}

          {formationType === "swarm" && (
            <AgentSwarmCanvas
              onNodeClick={(node) => handleNodeClick(node.id)}
              showControls={false}
              showMiniMap={false}
              showHandoffHistory={false}
            />
          )}

          {formationType === "graph" && (
            <AgentGraphCanvas
              onNodeClick={(node) => handleNodeClick(node.id)}
              showControls={false}
              showMiniMap={false}
              showStatsPanel={false}
              showTimeline={false}
            />
          )}
        </div>

        {/* Right: Subagent Panel (30%) */}
        <div className="flex-[3] flex flex-col">
          {/* Tabs (ONLY for graph with multiple active nodes) */}
          {shouldShowTabs && (
            <div className="flex gap-2 mb-3 border-b border-surface-200 dark:border-surface-700 pb-2 overflow-x-auto">
              {activeAgentIds.map((agentId) => {
                const isSelected = agentId === selectedAgentId;
                return (
                  <button
                    key={agentId}
                    onClick={() => setSelectedAgentId(agentId)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors whitespace-nowrap",
                      isSelected
                        ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-b-2 border-violet-500"
                        : "text-ink-muted hover:bg-surface-100 dark:hover:bg-surface-800"
                    )}
                  >
                    <span className="flex h-2 w-2">
                      <span className="absolute h-2 w-2 animate-ping rounded-full bg-violet-400 opacity-75" />
                      <span className="relative h-2 w-2 rounded-full bg-violet-500" />
                    </span>
                    {getAgentName(agentId)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Note: Workflow/Swarm are sequential - no tabs needed */}

          {/* Subagent details */}
          <SubagentTransparencyPanel
            agentId={selectedAgentId}
            mode={isFormationComplete ? "completed" : "live"}
            streamingData={selectedAgentId ? agentStreamingData.get(selectedAgentId) : undefined}
            finalOutput={
              isFormationComplete && selectedAgentId
                ? getCompletedNodeOutput(selectedAgentId) || undefined
                : undefined
            }
            isActive={selectedAgentId ? activeAgentIds.includes(selectedAgentId) : false}
            agentName={selectedAgentId ? getAgentName(selectedAgentId) : undefined}
            agentDescription={selectedAgentId ? getAgentDescription(selectedAgentId) : undefined}
          />
        </div>
      </div>
    </CollapsibleAgentTask>
  );
}
