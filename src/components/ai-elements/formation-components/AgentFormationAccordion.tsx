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
import { useOrchestrationStore, type CompletedNodeOutput } from "@/stores/orchestrationStore";
import type { TaskStatus } from "@/components/ai-elements/task";
import type {
  AgentResult,
  HandoffMessage,
  StrandsGraphEdge,
  StrandsGraphNode,
  StrandsSwarmNode,
  WorkflowTask,
} from "@/components/ai-elements/strands-orchestration/types";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentFormationAccordionProps {
  formationType: "workflow" | "swarm" | "graph";
  isFormationActive: boolean;
  isFormationComplete: boolean;
  title?: string;
  description?: string;
  defaultExpanded?: boolean;
  className?: string;
  onWorkflowNodeClick?: (task: WorkflowTask) => void;
  onSwarmNodeClick?: (node: StrandsSwarmNode) => void;
  onSwarmHandoff?: (handoff: HandoffMessage) => void;
  onGraphNodeClick?: (node: StrandsGraphNode) => void;
  onGraphEdgeClick?: (edge: StrandsGraphEdge) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AgentFormationAccordion({
  formationType,
  isFormationActive,
  isFormationComplete,
  title,
  description,
  defaultExpanded,
  className,
  onWorkflowNodeClick,
  onSwarmNodeClick,
  onSwarmHandoff,
  onGraphNodeClick,
  onGraphEdgeClick,
}: AgentFormationAccordionProps) {
  const {
    workflowTasks,
    swarmNodes,
    graphNodes,
    activeAgentIds,
    agentStreamingData,
  } = useOrchestrationStore((state) => ({
    workflowTasks: state.workflowTasks,
    swarmNodes: state.swarmNodes,
    graphNodes: state.graphNodes,
    activeAgentIds: state.activeAgentIds,
    agentStreamingData: state.agentStreamingData,
  }));

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"single" | "all">("single");
  const effectiveActiveAgentIds = useMemo(() => {
    const derived =
      formationType === "workflow"
        ? workflowTasks
            .filter((task) => task.status === "running")
            .map((task) => task.taskId)
        : formationType === "swarm"
          ? swarmNodes
              .filter((node) => node.data.status === "running" || node.data.status === "handoff")
              .map((node) => node.id)
          : graphNodes
              .filter((node) => node.data.status === "running" || node.data.status === "handoff")
              .map((node) => node.id);

    return Array.from(new Set([...activeAgentIds, ...derived]));
  }, [activeAgentIds, formationType, workflowTasks, swarmNodes, graphNodes]);

  // ─── Auto-select first active agent ───
  useEffect(() => {
    if (effectiveActiveAgentIds.length > 0 && !selectedAgentId) {
      setSelectedAgentId(effectiveActiveAgentIds[0]);
    } else if (effectiveActiveAgentIds.length === 0 && isFormationComplete) {
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
  }, [effectiveActiveAgentIds, selectedAgentId, isFormationComplete, formationType, workflowTasks, swarmNodes, graphNodes]);

  // ─── Cleanup: switch tab if selected agent completes ───
  useEffect(() => {
    if (
      selectedAgentId &&
      !effectiveActiveAgentIds.includes(selectedAgentId) &&
      effectiveActiveAgentIds.length > 0
    ) {
      // Selected agent is no longer active, switch to another active agent
      setSelectedAgentId(effectiveActiveAgentIds[0]);
    }
  }, [effectiveActiveAgentIds, selectedAgentId]);

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

  const getAgentMeta = useCallback(
    (nodeId: string): { model?: string; prompt?: string; tools?: string[] } => {
      if (formationType === "workflow") {
        const task = workflowTasks.find((t) => t.taskId === nodeId);
        if (!task) return {};
        const modelSettings = task.modelSettings || {};
        const modelId =
          typeof modelSettings.model_id === "string"
            ? modelSettings.model_id
            : typeof modelSettings.modelId === "string"
              ? modelSettings.modelId
              : undefined;
        return {
          model: formatModelLabel(task.modelProvider, modelId),
          prompt: task.systemPrompt,
          tools: task.tools,
        };
      }
      if (formationType === "swarm") {
        const node = swarmNodes.find((n) => n.id === nodeId);
        const agent = node?.data.agent;
        if (!agent) return {};
        return {
          model: formatModelLabel(agent.modelProvider, agent.modelId),
          prompt: agent.systemPrompt,
          tools: agent.tools,
        };
      }
      if (formationType === "graph") {
        const node = graphNodes.find((n) => n.id === nodeId);
        const agent = node?.data.agent;
        if (!agent) return {};
        return {
          model: formatModelLabel(agent.modelProvider, agent.modelId),
          prompt: agent.systemPrompt,
          tools: agent.tools,
        };
      }
      return {};
    },
    [formationType, workflowTasks, swarmNodes, graphNodes]
  );

  const getAgentResult = useCallback(
    (nodeId: string): AgentResult | undefined => {
      if (formationType === "workflow") {
        return workflowTasks.find((task) => task.taskId === nodeId)?.result;
      }
      if (formationType === "swarm") {
        return swarmNodes.find((node) => node.id === nodeId)?.data.result;
      }
      if (formationType === "graph") {
        return graphNodes.find((node) => node.id === nodeId)?.data.result;
      }
      return undefined;
    },
    [formationType, workflowTasks, swarmNodes, graphNodes]
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
    return title || `${typeLabel} Formation`;
  }, [formationType, title]);

  // ─── Show tabs only for graph with multiple active nodes ───
  const shouldShowTabs = formationType === "graph" && effectiveActiveAgentIds.length > 1;
  useEffect(() => {
    if (!shouldShowTabs && viewMode === "all") {
      setViewMode("single");
    }
  }, [shouldShowTabs, viewMode]);

  const selectedResult = useMemo(() => {
    if (!selectedAgentId) return undefined;
    return getAgentResult(selectedAgentId);
  }, [selectedAgentId, getAgentResult]);

  const finalOutput = useMemo(() => toCompletedOutput(selectedResult), [selectedResult]);
  const panelMode = isFormationComplete && finalOutput ? "completed" : "live";

  return (
    <CollapsibleAgentTask
      agentName={formationName}
      agentDescription={description}
      status={formationStatus}
      tools={[formationType]}
      defaultExpanded={defaultExpanded ?? (isFormationActive || isFormationComplete)}
      className={className}
    >
      <div className="flex flex-col md:flex-row min-h-[520px] md:h-[560px] rounded-xl border border-surface-200/60 dark:border-surface-700/60 overflow-hidden bg-surface-0/60 dark:bg-surface-900/40">
        {/* Left: Formation Canvas (70%) */}
        <div className="flex-[7] min-h-[320px] md:min-h-0 border-b md:border-b-0 md:border-r border-surface-200/60 dark:border-surface-700/60 bg-surface-50/70 dark:bg-surface-900/50 p-3 md:p-4">
          {formationType === "workflow" && (
            <AgentWorkflowCanvas
              onNodeClick={(task) => {
                handleNodeClick(task.taskId);
                onWorkflowNodeClick?.(task);
              }}
              showControls={false}
              showMiniMap={false}
              showStepBadges={false}
              showProgressBar={false}
            />
          )}

          {formationType === "swarm" && (
            <AgentSwarmCanvas
              onNodeClick={(node) => {
                handleNodeClick(node.id);
                onSwarmNodeClick?.(node);
              }}
              onHandoffClick={onSwarmHandoff}
              showControls={false}
              showMiniMap={false}
              showHandoffHistory={false}
            />
          )}

          {formationType === "graph" && (
            <AgentGraphCanvas
              onNodeClick={(node) => {
                handleNodeClick(node.id);
                onGraphNodeClick?.(node);
              }}
              onEdgeClick={onGraphEdgeClick}
              showControls={false}
              showMiniMap={false}
              showStats={false}
              showTimeline={false}
            />
          )}
        </div>

        {/* Right: Subagent Panel (30%) */}
        <div className="flex-[3] flex flex-col p-4 md:p-5 bg-surface-0/80 dark:bg-surface-850/80">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">
                Active Agents
              </span>
              <span className="text-xs text-ink-muted/70 dark:text-ink-inverse-muted/70">
                {effectiveActiveAgentIds.length}
              </span>
            </div>
            {shouldShowTabs && (
              <button
                onClick={() =>
                  setViewMode(viewMode === "all" ? "single" : "all")
                }
                className="rounded-full border border-surface-200 px-2.5 py-1 text-[11px] font-medium text-ink-muted transition hover:bg-surface-100 dark:border-surface-700 dark:text-ink-inverse-muted dark:hover:bg-surface-800"
              >
                {viewMode === "all" ? "Single view" : "View all"}
              </button>
            )}
          </div>
          {/* Tabs (ONLY for graph with multiple active nodes) */}
          {shouldShowTabs && viewMode === "single" && (
            <div className="flex gap-2 mb-3 border-b border-surface-200 dark:border-surface-700 pb-2 overflow-x-auto">
              {effectiveActiveAgentIds.map((agentId) => {
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
          {shouldShowTabs && viewMode === "all" ? (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {effectiveActiveAgentIds.map((agentId) => {
                const agentResult = getAgentResult(agentId);
                const agentOutput = toCompletedOutput(agentResult);
                const agentMode =
                  isFormationComplete && agentOutput ? "completed" : "live";
                return (
                  <SubagentTransparencyPanel
                    key={agentId}
                    agentId={agentId}
                    mode={agentMode}
                    streamingData={agentStreamingData.get(agentId)}
                    finalOutput={agentOutput}
                    isActive={effectiveActiveAgentIds.includes(agentId)}
                    agentName={getAgentName(agentId)}
                    agentDescription={getAgentDescription(agentId)}
                    agentModel={getAgentMeta(agentId).model}
                    agentPrompt={getAgentMeta(agentId).prompt}
                    agentTools={getAgentMeta(agentId).tools}
                    className="h-auto"
                  />
                );
              })}
            </div>
          ) : (
            <SubagentTransparencyPanel
              agentId={selectedAgentId}
              mode={panelMode}
              streamingData={
                selectedAgentId ? agentStreamingData.get(selectedAgentId) : undefined
              }
              finalOutput={finalOutput}
              isActive={
                selectedAgentId ? effectiveActiveAgentIds.includes(selectedAgentId) : false
              }
              agentName={selectedAgentId ? getAgentName(selectedAgentId) : undefined}
              agentDescription={
                selectedAgentId ? getAgentDescription(selectedAgentId) : undefined
              }
              agentModel={selectedAgentId ? getAgentMeta(selectedAgentId).model : undefined}
              agentPrompt={selectedAgentId ? getAgentMeta(selectedAgentId).prompt : undefined}
              agentTools={selectedAgentId ? getAgentMeta(selectedAgentId).tools : undefined}
            />
          )}
        </div>
      </div>
    </CollapsibleAgentTask>
  );
}

function toCompletedOutput(result?: AgentResult): CompletedNodeOutput | undefined {
  if (!result) return undefined;

  return {
    status: result.status,
    content: result.content,
    duration: result.metrics?.latencyMs ?? undefined,
    tokenUsage: {
      input: result.metrics?.inputTokens,
      output: result.metrics?.outputTokens,
    },
  };
}

function formatModelLabel(provider?: string, modelId?: string): string | undefined {
  if (!provider && !modelId) return undefined;
  if (provider && modelId) return `${provider} · ${modelId}`;
  return provider || modelId;
}
