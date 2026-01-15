/**
 * HandoffEdge Component
 *
 * Custom edge component for Swarm orchestration with animated particles
 * flowing along the edge path to visualize active handoffs.
 */

import { memo, useMemo } from "react";
import {
  BaseEdge,
  EdgeProps,
  getBezierPath,
  useInternalNode,
  Position,
  type InternalNode,
  type Node,
} from "@xyflow/react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SwarmEdgeData } from "@/components/ai-elements/strands-orchestration/types";

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get handle coordinates by position
 * Adapted from existing edge.tsx pattern
 */
const getHandleCoordsByPosition = (
  node: InternalNode<Node>,
  handlePosition: Position
) => {
  const handleType = handlePosition === Position.Left ? "target" : "source";
  const handle = node.internals.handleBounds?.[handleType]?.find(
    (h) => h.position === handlePosition
  );

  if (!handle) {
    return [0, 0] as const;
  }

  let offsetX = handle.width / 2;
  let offsetY = handle.height / 2;

  switch (handlePosition) {
    case Position.Left:
      offsetX = 0;
      break;
    case Position.Right:
      offsetX = handle.width;
      break;
    case Position.Top:
      offsetY = 0;
      break;
    case Position.Bottom:
      offsetY = handle.height;
      break;
  }

  const x = node.internals.positionAbsolute.x + handle.x + offsetX;
  const y = node.internals.positionAbsolute.y + handle.y + offsetY;

  return [x, y] as const;
};

/**
 * Calculate optimal handle positions for edge connection
 * Supports multi-directional connections for grid layout
 */
const getEdgeParams = (
  source: InternalNode<Node>,
  target: InternalNode<Node>
) => {
  const sourceCenter = {
    x: source.internals.positionAbsolute.x + source.measured.width! / 2,
    y: source.internals.positionAbsolute.y + source.measured.height! / 2,
  };

  const targetCenter = {
    x: target.internals.positionAbsolute.x + target.measured.width! / 2,
    y: target.internals.positionAbsolute.y + target.measured.height! / 2,
  };

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  // Determine optimal handle positions based on relative positions
  let sourcePos: Position;
  let targetPos: Position;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      sourcePos = Position.Right;
      targetPos = Position.Left;
    } else {
      sourcePos = Position.Left;
      targetPos = Position.Right;
    }
  } else {
    // Vertical connection
    if (dy > 0) {
      sourcePos = Position.Bottom;
      targetPos = Position.Top;
    } else {
      sourcePos = Position.Top;
      targetPos = Position.Bottom;
    }
  }

  const [sx, sy] = getHandleCoordsByPosition(source, sourcePos);
  const [tx, ty] = getHandleCoordsByPosition(target, targetPos);

  return { sx, sy, tx, ty, sourcePos, targetPos };
};

// ─────────────────────────────────────────────────────────────────────────────
// Particle Component
// ─────────────────────────────────────────────────────────────────────────────

interface ParticleProps {
  path: string;
  delay?: number;
  duration?: number;
  color?: string;
}

const Particle = memo(function Particle({
  path,
  delay = 0,
  duration = 2,
  color = "#8b5cf6",
}: ParticleProps) {
  return (
    <circle r="3" fill={color} className="opacity-90">
      <animateMotion
        dur={`${duration}s`}
        begin={`${delay}s`}
        path={path}
        repeatCount="indefinite"
      />
      <animate
        attributeName="r"
        values="3;5;3"
        dur={`${duration}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="0;0.9;0.9;0"
        dur={`${duration}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
    </circle>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// HandoffEdge Component
// ─────────────────────────────────────────────────────────────────────────────

export const HandoffEdge = memo(function HandoffEdge({
  id,
  source,
  target,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const edgeData = data as SwarmEdgeData | undefined;
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const { edgePath, labelX, labelY } = useMemo(() => {
    if (!sourceNode || !targetNode) {
      return { edgePath: "", labelX: 0, labelY: 0 };
    }

    const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
      sourceNode,
      targetNode
    );

    const [path, lx, ly] = getBezierPath({
      sourceX: sx,
      sourceY: sy,
      sourcePosition: sourcePos,
      targetX: tx,
      targetY: ty,
      targetPosition: targetPos,
    });

    return { edgePath: path, labelX: lx, labelY: ly };
  }, [sourceNode, targetNode]);

  if (!sourceNode || !targetNode || !edgePath) {
    return null;
  }

  const isActive = edgeData?.isActive || false;
  const isAnimated = edgeData?.isAnimated || false;
  const handoffMessage = edgeData?.handoffMessage;

  return (
    <>
      {/* Base Edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isActive ? "#8b5cf6" : "#475569",
          strokeWidth: isActive ? 2 : 1.5,
          opacity: isActive ? 1 : 0.5,
          transition: "all 0.3s ease",
        }}
        className={cn(
          "transition-all duration-300",
          isActive && "drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]"
        )}
      />

      {/* Animated Particles for Active Handoffs */}
      {isAnimated && (
        <>
          <Particle path={edgePath} delay={0} duration={2} />
          <Particle path={edgePath} delay={0.5} duration={2} />
          <Particle path={edgePath} delay={1} duration={2} />
        </>
      )}

      {/* Handoff Message Label */}
      {handoffMessage && (
        <foreignObject
          x={labelX - 60}
          y={labelY - 15}
          width={120}
          height={30}
          className="pointer-events-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center h-full"
          >
            <div
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-medium",
                "bg-slate-800/90 backdrop-blur-sm border",
                isActive
                  ? "border-violet-500/50 text-violet-300"
                  : "border-slate-600/50 text-slate-400"
              )}
            >
              {handoffMessage}
            </div>
          </motion.div>
        </foreignObject>
      )}

      {/* Glow Effect for Active Edge */}
      {isActive && (
        <defs>
          <filter id={`glow-${id}`}>
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
    </>
  );
});