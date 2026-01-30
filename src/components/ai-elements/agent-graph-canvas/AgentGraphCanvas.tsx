/**
 * AgentGraphCanvas Component
 *
 * Main canvas for visualizing Strands Graph orchestration with deterministic
 * dependency-driven execution. Integrates with orchestrationStore for state
 * synchronization and uses AgentOrchestrationNode for agent visualization.
 *
 * Features:
 * - Dagre hierarchical layout (TB direction)
 * - Custom edges with conditional styling
 * - Stats panel showing execution progress
 * - Control buttons for simulation
 * - Purple glow for actively streaming agents
 * - Smooth animations and transitions
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls as ReactFlowControls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Store and types
import { useOrchestrationStore, selectGraphState, selectActiveAgents, selectStreamingData } from "@/stores/orchestrationStore";
import type {
  StrandsGraphNode,
  StrandsGraphEdge,
  OrchestrationEvent,
} from "@/components/ai-elements/strands-orchestration/types";
import type { GraphNodeData, GraphEdgeData } from "@/components/ai-elements/strands-orchestration/types";

// Custom components
import { GraphNodeComponent } from "@/components/ai-elements/agent-orchestration-node";
import { GraphEdge, DependencyEdge, EdgeMarkers } from "./GraphEdge";
import { GraphStats } from "./GraphStats";
import { GraphControls } from "./GraphControls";
import { useGraphLayout } from "./useGraphLayout";
import { Timeline } from "./Timeline";

// ─────────────────────────────────────────────────────────────────────────────
// Component Props
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentGraphCanvasProps {
  className?: string;
  onNodeClick?: (node: StrandsGraphNode) => void;
  onEdgeClick?: (edge: StrandsGraphEdge) => void;
  onExecutionEvent?: (event: OrchestrationEvent) => void;
  showStats?: boolean;
  showControls?: boolean;
  showTimeline?: boolean;
  showMiniMap?: boolean;
  autoFit?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node and Edge Types
// ─────────────────────────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  "graph-node": GraphNodeComponent,
};

const edgeTypes: EdgeTypes = {
  "graph-edge": GraphEdge as any,
  "dependency-edge": DependencyEdge as any,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function AgentGraphCanvasInner({
  className,
  onNodeClick,
  onEdgeClick,
  onExecutionEvent,
  showStats = false,
  showControls = false,
  showTimeline = false,
  showMiniMap = false,
  autoFit = true,
}: AgentGraphCanvasProps) {
  const { fitView } = useReactFlow();

  // Store state
  const graphState = useOrchestrationStore(selectGraphState);
  const activeAgentIds = useOrchestrationStore(selectActiveAgents);
  const streamingData = useOrchestrationStore(selectStreamingData);
  const { updateNodeStatus, setActiveAgents } = useOrchestrationStore();

  // Local state for simulation
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [, setSimulationStep] = useState(0);
  const [executionEvents, setExecutionEvents] = useState<OrchestrationEvent[]>([]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<GraphEdgeData>>([]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Convert store nodes to React Flow nodes with streaming data
  // ─────────────────────────────────────────────────────────────────────────────

  const processedNodes = useMemo(() => {
    if (!graphState) return [];

    return graphState.nodes.map((node) => {
      const isActive = activeAgentIds.includes(node.id);
      const nodeStreamingData = streamingData.get(node.id);

      return {
        ...node,
        type: "graph-node",
        data: {
          ...node.data,
          isActivelyStreaming: isActive,
          streamingData: nodeStreamingData || undefined,
        },
      } as StrandsGraphNode;
    });
  }, [graphState, activeAgentIds, streamingData]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Apply Dagre layout
  // ─────────────────────────────────────────────────────────────────────────────

  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(
    processedNodes,
    graphState?.edges || [],
    {
      direction: "TB",
      nodesep: 80,
      ranksep: 100,
      nodeWidth: 280,
      nodeHeight: 150,
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Sync layouted nodes and edges to React Flow state
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setNodes(layoutedNodes as Node<GraphNodeData>[]);
    setEdges(layoutedEdges as Edge<GraphEdgeData>[]);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-fit view when nodes change
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoFit && layoutedNodes.length > 0) {
      // Delay to ensure DOM updates
      setTimeout(() => {
        fitView({
          duration: 400,
          padding: 0.2,
        });
      }, 100);
    }
  }, [layoutedNodes, autoFit, fitView]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node as StrandsGraphNode);
      }
    },
    [onNodeClick]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (onEdgeClick) {
        onEdgeClick(edge as StrandsGraphEdge);
      }
    },
    [onEdgeClick]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      console.log("Connection attempt:", connection);
      // Handle new connections if needed
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Simulation Controls
  // ─────────────────────────────────────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    setIsSimulating(true);
    setIsPaused(false);

    // Fire event
    const event: OrchestrationEvent = {
      type: "workflow-started",
      timestamp: Date.now(),
    };
    setExecutionEvents((prev) => [...prev, event]);
    onExecutionEvent?.(event);
  }, [onExecutionEvent]);

  const handlePause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleStep = useCallback(() => {
    // Simulate stepping through nodes
    if (!graphState) return;

    const pendingNodes = graphState.nodes.filter(
      (node) =>
        !graphState.completedNodes.includes(node.id) &&
        !graphState.failedNodes.includes(node.id)
    );

    if (pendingNodes.length > 0) {
      const nextNode = pendingNodes[0];
      updateNodeStatus(nextNode.id, "running");
      setActiveAgents([nextNode.id]);

      // Simulate completion after delay
      setTimeout(() => {
        updateNodeStatus(nextNode.id, "completed");
        setActiveAgents([]);

        const event: OrchestrationEvent = {
          type: "node-completed",
          nodeId: nextNode.id,
          timestamp: Date.now(),
        };
        setExecutionEvents((prev) => [...prev, event]);
        onExecutionEvent?.(event);
      }, 2000);
    }

    setSimulationStep((prev) => prev + 1);
  }, [graphState, updateNodeStatus, setActiveAgents, onExecutionEvent]);

  const handleReset = useCallback(() => {
    setIsSimulating(false);
    setIsPaused(false);
    setSimulationStep(0);
    setExecutionEvents([]);
    setActiveAgents([]);

    // Reset all node statuses
    graphState?.nodes.forEach((node) => {
      updateNodeStatus(node.id, "idle");
    });
  }, [graphState, updateNodeStatus, setActiveAgents]);

  const handleExport = useCallback(() => {
    // Export graph as JSON
    const exportData = {
      nodes: nodes,
      edges: edges,
      graphState: graphState,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agent-graph-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, graphState]);

  const handleFitView = useCallback(() => {
    fitView({
      duration: 400,
      padding: 0.2,
    });
  }, [fitView]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  const canStep = graphState ?
    graphState.nodes.length > graphState.completedNodes.length + graphState.failedNodes.length :
    false;

  return (
    <div className={cn("relative w-full h-full bg-transparent", className)}>
      {/* Edge Markers Definition */}
      <EdgeMarkers />

      {/* Main Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={autoFit}
        defaultEdgeOptions={{
          type: "graph-edge",
          markerEnd: "arrow-default",
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background
          color="rgb(229, 229, 229)"
          gap={16}
          size={1}
          className="opacity-[0.03] dark:opacity-[0.02]"
          style={{ backgroundColor: 'transparent' }}
        />

        {showControls && (
          <ReactFlowControls
            className="!bg-surface-50/90 dark:!bg-surface-800/90 !border-surface-200 dark:!border-surface-700 !shadow-sm"
            showInteractive={false}
          />
        )}

        {showMiniMap && (
          <MiniMap
            className="!bg-surface-50/90 dark:!bg-surface-800/90 !border-surface-200 dark:!border-surface-700"
            maskColor="rgba(250, 250, 250, 0.9) dark:rgba(10, 10, 10, 0.9)"
            nodeColor={(node) => {
              const isActive = activeAgentIds.includes(node.id);
              return isActive ? "#6366F1" : "#A3A3A3";
            }}
          />
        )}
      </ReactFlow>

      {/* Overlays */}
      <AnimatePresence>
        {/* Stats Panel */}
        {showStats && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-4 left-4 z-10 pointer-events-auto"
          >
            <div className="bg-surface-50/90 dark:bg-surface-800/90 backdrop-blur-sm rounded-lg p-3 border border-surface-200 dark:border-surface-700">
              <GraphStats
                graphState={graphState}
                activeAgentIds={activeAgentIds}
              />
            </div>
          </motion.div>
        )}

        {/* Controls Panel */}
        {showControls && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-4 right-4 z-10 pointer-events-auto"
          >
            <div className="bg-surface-50/90 dark:bg-surface-800/90 backdrop-blur-sm rounded-lg p-3 border border-surface-200 dark:border-surface-700">
              <GraphControls
                isRunning={isSimulating}
                isPaused={isPaused}
                canStep={canStep}
                onPlay={handlePlay}
                onPause={handlePause}
                onStep={handleStep}
                onReset={handleReset}
              />
            </div>
          </motion.div>
        )}

        {/* Timeline */}
        {showTimeline && executionEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-4 right-4 z-10 pointer-events-auto"
          >
            <div className="bg-surface-50/90 dark:bg-surface-800/90 backdrop-blur-sm rounded-lg p-3 border border-surface-200 dark:border-surface-700">
              <Timeline
                events={executionEvents}
                maxEvents={10}
              />
            </div>
          </motion.div>
        )}

        {/* Quick Actions - Only show if needed */}
        {(showControls || showStats) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bottom-4 right-4 z-10 flex gap-2"
          >
            <QuickActionButton
              onClick={handleFitView}
              tooltip="Fit View"
            >
              <FitViewIcon className="w-4 h-4" />
            </QuickActionButton>

            <QuickActionButton
              onClick={handleExport}
              tooltip="Export Graph"
            >
              <ExportIcon className="w-4 h-4" />
            </QuickActionButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!graphState && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <GraphIcon className="w-12 h-12 text-surface-400 dark:text-surface-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
              No Graph Loaded
            </h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm">
              Initialize a graph orchestration to visualize agent dependencies and execution flow.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export with Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AgentGraphCanvas(props: AgentGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <AgentGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

interface QuickActionButtonProps {
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
}

function QuickActionButton({ onClick, tooltip, children }: QuickActionButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      title={tooltip}
      className={cn(
        "p-2 rounded-lg",
        "bg-surface-50/90 dark:bg-surface-800/90 backdrop-blur-sm",
        "border border-surface-200 dark:border-surface-700",
        "text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100",
        "transition-colors duration-200",
        "shadow-sm"
      )}
    >
      {children}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function GraphIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5" cy="6" r="3" />
      <path d="M5 9v12" />
      <circle cx="19" cy="6" r="3" />
      <path d="M19 9v12" />
      <line x1="5" y1="6" x2="19" y2="6" />
      <circle cx="12" cy="18" r="3" />
      <path d="M5 18h14" />
    </svg>
  );
}

function FitViewIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function ExportIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}