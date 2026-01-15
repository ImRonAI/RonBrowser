/**
 * WorkflowEdge Component
 *
 * Simple sequential edge for workflow visualization.
 * Shows straight lines between workflow steps with subtle animations.
 */

"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getStraightPath,
} from "@xyflow/react";
import { cn } from "@/lib/utils";


// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const WorkflowEdge = memo(function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const edgeData = data as { isActive?: boolean; stepFrom?: number; stepTo?: number } | undefined;
  const isActive = edgeData?.isActive || false;
  const stepFrom = edgeData?.stepFrom;
  const stepTo = edgeData?.stepTo;

  return (
    <>
      {/* Main Edge Path */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={cn(
          "transition-all duration-300",
          isActive
            ? "stroke-violet-500 stroke-[2.5]"
            : "stroke-slate-600 stroke-[1.5]"
        )}
        style={{
          strokeDasharray: isActive ? "0" : "4 4",
          animation: isActive ? "dash 1s linear infinite" : undefined,
        }}
      />

      {/* Active Glow Effect */}
      {isActive && (
        <path
          d={edgePath}
          className="stroke-violet-500/30 stroke-[8] blur-lg animate-pulse"
          fill="none"
          pointerEvents="none"
        />
      )}

      {/* Step Label (optional) */}
      {stepFrom && stepTo && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              "absolute px-2 py-0.5 text-[9px] font-bold rounded-full",
              "bg-slate-800/80 border backdrop-blur-sm",
              "transition-all duration-300 pointer-events-none",
              isActive
                ? "border-violet-500/50 text-violet-400"
                : "border-slate-700 text-slate-500"
            )}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {stepFrom} → {stepTo}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Flow Indicator Dots */}
      {isActive && (
        <g className="animate-flow">
          <circle
            className="fill-violet-400"
            r="3"
            style={{
              offsetPath: `path('${edgePath}')`,
              offsetDistance: "0%",
              animation: "flow 2s linear infinite",
            }}
          />
          <circle
            className="fill-violet-400"
            r="3"
            style={{
              offsetPath: `path('${edgePath}')`,
              offsetDistance: "33%",
              animation: "flow 2s linear infinite 0.66s",
            }}
          />
          <circle
            className="fill-violet-400"
            r="3"
            style={{
              offsetPath: `path('${edgePath}')`,
              offsetDistance: "66%",
              animation: "flow 2s linear infinite 1.33s",
            }}
          />
        </g>
      )}

      {/* Add CSS animations via style tag */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes dash {
            to {
              stroke-dashoffset: -8;
            }
          }

          @keyframes flow {
            to {
              offset-distance: 100%;
            }
          }

          .animate-flow circle {
            offset-path: path('${edgePath}');
          }
        `
      }} />
    </>
  );
});