/**
 * useGraphLayout Hook
 *
 * Applies Dagre hierarchical layout to React Flow nodes and edges.
 * Optimized for dependency-driven agent execution visualization.
 */

import { useMemo } from "react";
import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

export interface LayoutOptions {
  direction?: "TB" | "LR" | "BT" | "RL";
  nodeWidth?: number;
  nodeHeight?: number;
  nodesep?: number;
  ranksep?: number;
  marginx?: number;
  marginy?: number;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  direction: "TB",
  nodeWidth: 280,
  nodeHeight: 150,
  nodesep: 80,
  ranksep: 100,
  marginx: 40,
  marginy: 40,
};

/**
 * Apply Dagre layout to nodes and edges
 */
export function useGraphLayout<
  N extends Record<string, unknown> = Record<string, unknown>,
  E extends Record<string, unknown> = Record<string, unknown>
>(
  nodes: Node<N>[],
  edges: Edge<E>[],
  options: LayoutOptions = {}
): { nodes: Node<N>[]; edges: Edge<E>[] } {
  const layoutOptions = { ...DEFAULT_OPTIONS, ...options };

  return useMemo(() => {
    if (nodes.length === 0) {
      return { nodes, edges };
    }

    // Create a new directed graph
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Set graph options
    dagreGraph.setGraph({
      rankdir: layoutOptions.direction,
      nodesep: layoutOptions.nodesep,
      ranksep: layoutOptions.ranksep,
      marginx: layoutOptions.marginx,
      marginy: layoutOptions.marginy,
    });

    // Add nodes to the graph
    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, {
        width: layoutOptions.nodeWidth,
        height: layoutOptions.nodeHeight,
      });
    });

    // Add edges to the graph
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // Run the layout algorithm
    dagre.layout(dagreGraph);

    // Apply the layout to nodes
    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);

      // Dagre gives us the center position, we need to adjust for React Flow
      const x = nodeWithPosition.x - layoutOptions.nodeWidth! / 2;
      const y = nodeWithPosition.y - layoutOptions.nodeHeight! / 2;

      return {
        ...node,
        position: { x, y },
        // Prevent React Flow from overriding our layout
        draggable: true,
        type: node.type || "agent-graph-node",
      };
    });

    // Keep edges as-is (React Flow will handle their positioning)
    const layoutedEdges = edges.map((edge) => ({
      ...edge,
      type: edge.type || "agent-graph-edge",
    }));

    return {
      nodes: layoutedNodes,
      edges: layoutedEdges,
    };
  }, [nodes, edges, layoutOptions]);
}

/**
 * Get layout bounds for viewport fitting
 */
export function getLayoutBounds(nodes: Node[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const x = node.position.x;
    const y = node.position.y;
    const width = (node.width as number) || 280;
    const height = (node.height as number) || 150;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}