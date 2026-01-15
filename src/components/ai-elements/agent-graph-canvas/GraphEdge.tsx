/**
 * GraphEdge Component
 *
 * Custom edge component for agent dependency visualization.
 * Shows conditional relationships and data flow between agents.
 */

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { GraphEdgeData } from "@/components/ai-elements/strands-orchestration/types";

export const GraphEdge = memo(function GraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}: EdgeProps) {
  // Use bezier path for better visual flow
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as GraphEdgeData | undefined;
  const isConditional = edgeData?.isConditional || false;
  const isActive = edgeData?.isActive || false;
  const condition = edgeData?.condition;

  return (
    <>
      {/* Main edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={cn(
          "transition-all duration-300",
          isActive && "animate-pulse"
        )}
        style={{
          stroke: isActive
            ? "#8b5cf6" // Violet for active
            : isConditional
            ? "#f59e0b" // Amber for conditional
            : "#64748b", // Slate for normal
          strokeWidth: selected ? 2.5 : isActive ? 2 : 1.5,
          strokeDasharray: isConditional ? "5,5" : undefined,
          opacity: isActive ? 1 : 0.6,
        }}
      />

      {/* Animated flow indicator for active edges */}
      {isActive && (
        <BaseEdge
          id={`${id}-flow`}
          path={edgePath}
          className="pointer-events-none"
          style={{
            stroke: "#8b5cf6",
            strokeWidth: 3,
            strokeDasharray: "10,10",
            opacity: 0.4,
            animation: "flow 2s linear infinite",
          }}
        />
      )}

      {/* Condition label */}
      {condition && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              "absolute pointer-events-auto",
              "px-2 py-1 rounded-md text-[10px] font-medium",
              "bg-slate-800/90 backdrop-blur-sm",
              "border transition-all duration-200",
              isActive
                ? "border-violet-500/50 text-violet-300"
                : "border-amber-500/30 text-amber-300",
              "hover:scale-105"
            )}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <div className="flex items-center gap-1">
              <ConditionIcon className="w-3 h-3" />
              <span>{condition.label}</span>
            </div>
            {condition.expression && (
              <div className="text-[9px] text-slate-400 mt-0.5 font-mono">
                {condition.expression}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Add flow animation keyframes via style tag */}
      <style>{`
        @keyframes flow {
          from {
            stroke-dashoffset: 20;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </>
  );
});

/**
 * Dependency edge - simplified version for standard dependencies
 */
export const DependencyEdge = memo(function DependencyEdge(
  props: EdgeProps
) {
  const [edgePath] = getStraightPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  });

  const edgeData = props.data as GraphEdgeData | undefined;

  return (
    <BaseEdge
      {...props}
      path={edgePath}
      className="transition-all duration-300"
      style={{
        stroke: edgeData?.isActive ? "#8b5cf6" : "#475569",
        strokeWidth: props.selected ? 2 : 1.5,
        opacity: edgeData?.isActive ? 1 : 0.5,
      }}
    />
  );
});

/**
 * Marker definitions for arrow heads
 */
export function EdgeMarkers() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        {/* Default arrow marker */}
        <marker
          id="arrow-default"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill="#64748b"
            className="transition-colors"
          />
        </marker>

        {/* Active arrow marker */}
        <marker
          id="arrow-active"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill="#8b5cf6"
            className="transition-colors"
          />
        </marker>

        {/* Conditional arrow marker */}
        <marker
          id="arrow-conditional"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill="#f59e0b"
            className="transition-colors"
          />
        </marker>
      </defs>
    </svg>
  );
}

// Icon component
function ConditionIcon({ className }: { className?: string }) {
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
      <path d="M3 12h18" />
      <path d="M3 6h18" />
      <path d="M3 18h18" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}