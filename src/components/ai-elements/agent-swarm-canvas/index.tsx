/**
 * AgentSwarmCanvas Component
 *
 * Visualizes Strands Swarm orchestration with dynamic handoff-based execution.
 * Features a 3-column grid layout with animated handoff edges and history panel.
 *
 * Key Features:
 * - 3-column grid layout (120px horizontal, 150px vertical spacing)
 * - Dynamic handoff edges with particle animation
 * - Multiple simultaneous active agents support
 * - Entry point indicators
 * - Handoff history panel at bottom
 */

import { useEffect, useCallback, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type OnConnect,
  type ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { SwarmNodeComponent } from "@/components/ai-elements/agent-orchestration-node";
import { HandoffEdge } from "./handoff-edge";
import { HandoffHistory } from "./handoff-history";
import { EntryBadge } from "./entry-badge";
import {
  useOrchestrationStore,
  selectSwarmState,
  selectActiveAgents,
  selectStreamingData,
} from "@/stores/orchestrationStore";
import type {
  StrandsSwarmNode,
  HandoffMessage,
  SwarmNodeData,
} from "@/components/ai-elements/strands-orchestration/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GRID_SPACING_X = 120; // Horizontal spacing between columns
const GRID_SPACING_Y = 150; // Vertical spacing between rows
const NODE_WIDTH = 280; // From AgentOrchestrationNode
const NODE_HEIGHT = 100; // Estimated initial height
const COLUMNS = 3; // Number of columns in grid

// Custom node and edge types
const nodeTypes = {
  "swarm-node": SwarmNodeComponent,
};

const edgeTypes = {
  "handoff-edge": HandoffEdge,
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout Calculation
// ─────────────────────────────────────────────────────────────────────────────

function calculateNodePosition(index: number): { x: number; y: number } {
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);

  return {
    x: column * (NODE_WIDTH + GRID_SPACING_X),
    y: row * (NODE_HEIGHT + GRID_SPACING_Y),
  };
}

function layoutSwarmNodes(nodes: StrandsSwarmNode[]): StrandsSwarmNode[] {
  return nodes.map((node, index) => {
    const position = calculateNodePosition(index);
    return {
      ...node,
      position,
      data: {
        ...node.data,
        // Preserve all existing data
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentSwarmCanvas Component
// ─────────────────────────────────────────────────────────────────────────────

interface AgentSwarmCanvasProps {
  className?: string;
  onNodeClick?: (node: StrandsSwarmNode) => void;
  onHandoffClick?: (handoff: HandoffMessage) => void;
  showStatusPanel?: boolean;
  showControls?: boolean;
  showMiniMap?: boolean;
  showHandoffHistory?: boolean;
  showEntryBadges?: boolean;
}

function AgentSwarmCanvasInner({
  className,
  onNodeClick,
  onHandoffClick,
  showStatusPanel = false,
  showControls = false,
  showMiniMap = false,
  showHandoffHistory = false,
  showEntryBadges = false,
}: AgentSwarmCanvasProps) {
  const { fitView } = useReactFlow();
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Store subscriptions
  const swarmState = useOrchestrationStore(selectSwarmState);
  const activeAgentIds = useOrchestrationStore(selectActiveAgents);
  const streamingData = useOrchestrationStore(selectStreamingData);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Layout and sync nodes with store
  useEffect(() => {
    if (!swarmState) return;

    // Layout nodes in grid
    const layoutedNodes = layoutSwarmNodes(swarmState.nodes);

    // Enhance nodes with streaming data and active status
    const enhancedNodes = layoutedNodes.map((node) => {
      const isActive = activeAgentIds.includes(node.id);
      const nodeStreamingData = streamingData.get(node.id);

      return {
        ...node,
        data: {
          ...node.data,
          isActivelyStreaming: isActive,
          streamingData: nodeStreamingData,
        },
        // Add visual indicators for active agents
        className: cn(
          node.className,
          isActive && "ring-2 ring-violet-500 ring-offset-2 ring-offset-slate-900"
        ),
      };
    });

    setNodes(enhancedNodes);
  }, [swarmState, activeAgentIds, streamingData, setNodes]);

  // Sync edges with store
  useEffect(() => {
    if (!swarmState) return;

    // Enhance edges with animation for active handoffs
    const enhancedEdges = swarmState.edges.map((edge) => {
      const isHandoffActive =
        activeAgentIds.includes(edge.source) &&
        activeAgentIds.includes(edge.target);

      return {
        ...edge,
        type: "handoff-edge",
        data: {
          ...edge.data,
          isActive: isHandoffActive,
          isAnimated: isHandoffActive,
        },
        animated: isHandoffActive,
      };
    });

    setEdges(enhancedEdges);
  }, [swarmState, activeAgentIds, setEdges]);

  // Auto-fit view on initial load
  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 100);
    }
  }, [nodes.length, fitView]);

  // Handle node clicks
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node as StrandsSwarmNode);
      }
    },
    [onNodeClick]
  );

  // Handle edge connections (not used in swarm, but required for ReactFlow)
  const handleConnect = useCallback<OnConnect>(() => {
    // Swarm edges are created dynamically through handoffs, not manual connections
  }, []);

  // Handoff history
  const handoffs = swarmState?.handoffs || [];

  return (
    <div className={cn("relative h-full w-full bg-transparent", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        connectionMode={"loose" as ConnectionMode}
        fitView
        attributionPosition="bottom-left"
        className="bg-transparent"
      >
        {/* Background Grid */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgb(229, 229, 229)"
          className="opacity-[0.03] dark:opacity-[0.02]"
          style={{ backgroundColor: 'transparent' }}
        />

        {/* Controls */}
        {showControls && (
          <Controls
            className="bg-surface-50/90 dark:bg-surface-800/90 border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden [&>button]:bg-surface-50 dark:[&>button]:bg-surface-800 [&>button]:border-surface-200 dark:[&>button]:border-surface-700 [&>button]:text-surface-600 dark:[&>button]:text-surface-400 [&>button:hover]:bg-surface-100 dark:[&>button:hover]:bg-surface-700 [&>button:hover]:text-surface-900 dark:[&>button:hover]:text-surface-100"
          />
        )}

        {/* Mini Map */}
        {showMiniMap && (
          <MiniMap
            className="bg-surface-50/90 dark:bg-surface-800/90 border border-surface-200 dark:border-surface-700 rounded-lg"
            nodeColor={(node) => {
              const swarmNode = node as StrandsSwarmNode;
              if (activeAgentIds.includes(swarmNode.id)) {
                return "#6366F1"; // Indigo for active
              }
              switch (swarmNode.data.status) {
                case "completed":
                  return "#059669"; // Success green
                case "error":
                  return "#DC2626"; // Danger red
                case "running":
                  return "#0284C7"; // Info blue
                case "handoff":
                  return "#8B5CF6"; // Purple
                default:
                  return "#A3A3A3"; // Gray
              }
            }}
            maskColor="rgba(250, 250, 250, 0.9) dark:rgba(10, 10, 10, 0.9)"
          />
        )}

        {/* Status Panel */}
        {showStatusPanel && (
          <Panel position="top-left" className="bg-surface-50/90 dark:bg-surface-800/90 backdrop-blur-sm rounded-lg p-3 border border-surface-200 dark:border-surface-700 min-w-[200px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  Swarm Status
                </span>
                {swarmState?.status === "running" && (
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-accent-light opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-indigo"></span>
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-surface-500 dark:text-surface-400">Agents:</span>
                  <span className="text-surface-900 dark:text-surface-100">{nodes.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-surface-500 dark:text-surface-400">Active:</span>
                  <span className="text-accent-indigo font-semibold">{activeAgentIds.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-surface-500 dark:text-surface-400">Handoffs:</span>
                  <span className="text-surface-900 dark:text-surface-100">{swarmState?.handoffCount || 0}</span>
                </div>
                {swarmState?.maxHandoffs && (
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-500 dark:text-surface-400">Max:</span>
                    <span className="text-surface-900 dark:text-surface-100">{swarmState.maxHandoffs}</span>
                  </div>
                )}
              </div>

              {/* Active Agents List */}
              {activeAgentIds.length > 0 && (
                <div className="pt-2 border-t border-surface-200 dark:border-surface-700">
                  <span className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider block mb-1">
                    Active Agents
                  </span>
                  <div className="space-y-1">
                    {activeAgentIds.map((id) => {
                      const node = nodes.find((n) => n.id === id);
                      if (!node) return null;
                      const nodeData = node.data as SwarmNodeData;
                      return (
                        <div key={id} className="flex items-center gap-2">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-accent-indigo animate-pulse" />
                          <span className="text-xs text-surface-900 dark:text-surface-100 truncate">
                            {nodeData.agent.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* Entry Point Badges */}
        {showEntryBadges && nodes.map((node) =>
          node.data.isEntryPoint ? (
            <EntryBadge key={`entry-${node.id}`} nodeId={node.id} />
          ) : null
        )}
      </ReactFlow>

      {/* Handoff History Panel */}
      <AnimatePresence>
        {showHandoffHistory && handoffs.length > 0 && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: isHistoryExpanded ? 0 : "calc(100% - 48px)" }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 z-20"
          >
            <HandoffHistory
              handoffs={handoffs}
              isExpanded={isHistoryExpanded}
              onToggleExpand={() => setIsHistoryExpanded(!isHistoryExpanded)}
              onHandoffClick={onHandoffClick}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Export with Provider
function AgentSwarmCanvas(props: AgentSwarmCanvasProps) {
  return (
    <ReactFlowProvider>
      <AgentSwarmCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

// Named and default exports for flexible import styles
export { AgentSwarmCanvas };
export default AgentSwarmCanvas;