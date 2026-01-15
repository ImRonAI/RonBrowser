/**
 * AgentWorkflowCanvas Component
 *
 * Visualizes Strands Workflow orchestration with sequential linear execution.
 * Features vertical task layout with step badges and segmented progress bar.
 */

"use client";

import { useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  Connection,
  NodeTypes,
  EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { cn } from "@/lib/utils";
import { WorkflowNodeComponent } from "@/components/ai-elements/agent-orchestration-node";
import { useOrchestrationStore } from "@/stores/orchestrationStore";
import type { WorkflowTask } from "@/components/ai-elements/strands-orchestration/types";

import { WorkflowEdge } from "./workflow-edge";
import { WorkflowProgressBar } from "./progress-bar";
import { StepBadge } from "./step-badge";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VERTICAL_SPACING = 120; // Space between nodes
const NODE_WIDTH = 280;
const CANVAS_PADDING = 100;

// Custom node and edge types
const nodeTypes: NodeTypes = {
  workflow: WorkflowNodeComponent as any, // Cast to avoid type issues
};

const edgeTypes: EdgeTypes = {
  workflow: WorkflowEdge as any,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface AgentWorkflowCanvasProps {
  className?: string;
  onNodeClick?: (task: WorkflowTask) => void;
  onTaskComplete?: (taskId: string) => void;
  showStepBadges?: boolean;
  showControls?: boolean;
  showMiniMap?: boolean;
  showProgressBar?: boolean;
}

function AgentWorkflowCanvasInner({
  className,
  onNodeClick,
  showStepBadges = false,
  showControls = false,
  showMiniMap = false,
  showProgressBar = false,
}: AgentWorkflowCanvasProps) {
  const {
    workflowTasks,
    activeAgentIds,
    agentStreamingData,
  } = useOrchestrationStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // ─── Generate Nodes from Workflow Tasks ───
  const generateNodes = useCallback(() => {
    if (!workflowTasks || workflowTasks.length === 0) return [];

    return workflowTasks.map((task, index): Node => {
      const yPosition = CANVAS_PADDING + index * VERTICAL_SPACING;
      const isActive = activeAgentIds.includes(task.taskId);
      const streamingData = agentStreamingData.get(task.taskId);

      return {
        id: task.taskId,
        type: "workflow",
        position: {
          x: CANVAS_PADDING + NODE_WIDTH / 2,
          y: yPosition,
        },
        data: {
          ...task,
          stepNumber: index + 1,
          isActivelyStreaming: isActive,
          streamingData,
        },
      };
    });
  }, [workflowTasks, activeAgentIds, agentStreamingData]);

  // ─── Generate Sequential Edges ───
  const generateEdges = useCallback(() => {
    if (!workflowTasks || workflowTasks.length <= 1) return [];

    return workflowTasks.slice(0, -1).map((task, index): Edge => {
      const nextTask = workflowTasks[index + 1];
      const isActive = task.status === "completed" && nextTask.status === "running";

      return {
        id: `${task.taskId}-${nextTask.taskId}`,
        source: task.taskId,
        target: nextTask.taskId,
        type: "workflow",
        data: {
          isActive,
          stepFrom: index + 1,
          stepTo: index + 2,
        },
      };
    });
  }, [workflowTasks]);

  // ─── Update Nodes and Edges when Workflow Changes ───
  useEffect(() => {
    const newNodes = generateNodes();
    const newEdges = generateEdges();

    setNodes(newNodes);
    setEdges(newEdges);
  }, [generateNodes, generateEdges, setNodes, setEdges]);

  // ─── Handle Node Click ───
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const task = workflowTasks.find((t) => t.taskId === node.id);
      if (task && onNodeClick) {
        onNodeClick(task);
      }
    },
    [workflowTasks, onNodeClick]
  );

  // ─── Calculate Progress ───
  const progress = useMemo(() => {
    if (!workflowTasks || workflowTasks.length === 0) return 0;

    const completedTasks = workflowTasks.filter(
      (t) => t.status === "completed"
    ).length;

    return completedTasks / workflowTasks.length;
  }, [workflowTasks]);

  // ─── Current Step ───
  const currentStep = useMemo(() => {
    if (!workflowTasks || workflowTasks.length === 0) return 0;

    const runningIndex = workflowTasks.findIndex(
      (t) => t.status === "running"
    );

    if (runningIndex !== -1) return runningIndex + 1;

    const completedCount = workflowTasks.filter(
      (t) => t.status === "completed"
    ).length;

    return completedCount;
  }, [workflowTasks]);

  // Prevent new connections (sequential only)
  const onConnect = useCallback((_connection: Connection) => {
    // Workflow is sequential, no manual connections allowed
    return false;
  }, []);

  return (
    <div className={cn("relative h-full w-full bg-transparent", className)}>
      {/* Step Badges Overlay - Hidden by default for clean look */}
      {showStepBadges && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          {workflowTasks.map((task, index) => (
            <StepBadge
              key={task.taskId}
              stepNumber={index + 1}
              status={task.status}
              isActive={activeAgentIds.includes(task.taskId)}
              onClick={() => {
                const node = nodes.find((n) => n.id === task.taskId);
                if (node && onNodeClick) {
                  onNodeClick(task);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          maxZoom: 1.5,
          minZoom: 0.5,
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
        defaultEdgeOptions={{
          animated: false,
          type: "workflow",
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          className="opacity-[0.03] dark:opacity-[0.02]"
          color="rgb(229, 229, 229)"
          style={{ backgroundColor: 'transparent' }}
        />

        {showControls && (
          <Controls
            className="!bg-surface-50/90 dark:!bg-surface-800/90 !border-surface-200 dark:!border-surface-700 !shadow-sm [&>button]:!bg-surface-50 dark:[&>button]:!bg-surface-800 [&>button]:!border-surface-200 dark:[&>button]:!border-surface-700 [&>button]:!text-surface-600 dark:[&>button]:!text-surface-400 [&>button:hover]:!bg-surface-100/80 dark:[&>button:hover]:!bg-surface-700/80"
            position="top-right"
          />
        )}

        {showMiniMap && (
          <MiniMap
            className="!bg-surface-50/90 dark:!bg-surface-800/90 !border-surface-200 dark:!border-surface-700"
            nodeColor={(node) => {
              const task = workflowTasks.find((t) => t.taskId === node.id);
              if (!task) return "#A3A3A3";
              if (task.status === "completed") return "#059669";
              if (task.status === "running") return "#0284C7";
              if (task.status === "error") return "#DC2626";
              return "#A3A3A3";
            }}
            maskColor="rgba(250, 250, 250, 0.9) dark:rgba(10, 10, 10, 0.9)"
          />
        )}
      </ReactFlow>

      {/* Progress Bar - Hidden by default for clean look */}
      {showProgressBar && (
        <WorkflowProgressBar
          tasks={workflowTasks}
          currentStep={currentStep}
          progress={progress}
          className="absolute bottom-0 left-0 right-0 z-10"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export with Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AgentWorkflowCanvas(props: AgentWorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <AgentWorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}