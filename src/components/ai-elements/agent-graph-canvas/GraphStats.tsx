/**
 * GraphStats Component
 *
 * Displays execution statistics for the agent graph.
 * Shows progress, node counts, and execution status.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { GraphState } from "@/components/ai-elements/strands-orchestration/types";

interface GraphStatsProps {
  graphState: GraphState | null;
  activeAgentIds: string[];
  className?: string;
}

export const GraphStats = memo(function GraphStats({
  graphState,
  activeAgentIds,
  className,
}: GraphStatsProps) {
  if (!graphState) {
    return (
      <div
        className={cn(
          "bg-slate-900/90 backdrop-blur-sm",
          "rounded-xl border border-slate-700",
          "p-4 shadow-xl",
          className
        )}
      >
        <div className="text-sm text-slate-400">No graph loaded</div>
      </div>
    );
  }

  const totalNodes = graphState.nodes.length;
  const completedCount = graphState.completedNodes.length;
  const failedCount = graphState.failedNodes.length;
  const pendingCount = totalNodes - completedCount - failedCount;
  const progress = totalNodes > 0 ? (completedCount / totalNodes) * 100 : 0;

  const statusConfig = {
    created: { label: "Ready", color: "bg-slate-500", pulse: false },
    running: { label: "Running", color: "bg-sky-500", pulse: true },
    completed: { label: "Completed", color: "bg-emerald-500", pulse: false },
    error: { label: "Error", color: "bg-rose-500", pulse: false },
    paused: { label: "Paused", color: "bg-amber-500", pulse: false },
  };

  const status = statusConfig[graphState.status] || statusConfig.created;

  // Calculate elapsed time
  const elapsedTime = graphState.startedAt
    ? graphState.completedAt
      ? graphState.completedAt - graphState.startedAt
      : Date.now() - graphState.startedAt
    : 0;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-slate-900/90 backdrop-blur-sm",
        "rounded-xl border border-slate-700",
        "p-4 shadow-xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GraphIcon className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Graph Stats
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              status.color,
              status.pulse && "animate-pulse"
            )}
          />
          <span className="text-xs font-medium text-slate-400">
            {status.label}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              failedCount > 0 ? "bg-amber-500" : "bg-violet-500"
            )}
          />
        </div>
      </div>

      {/* Node Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatItem
          label="Total"
          value={totalNodes}
          color="text-slate-300"
          bgColor="bg-slate-800"
        />
        <StatItem
          label="Active"
          value={activeAgentIds.length}
          color="text-violet-300"
          bgColor="bg-violet-500/10"
          pulse={activeAgentIds.length > 0}
        />
        <StatItem
          label="Completed"
          value={completedCount}
          color="text-emerald-300"
          bgColor="bg-emerald-500/10"
        />
        <StatItem
          label="Pending"
          value={pendingCount}
          color="text-sky-300"
          bgColor="bg-sky-500/10"
        />
      </div>

      {/* Failed Nodes */}
      {failedCount > 0 && (
        <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg mb-3">
          <div className="flex items-center gap-2">
            <ErrorIcon className="w-3 h-3 text-rose-400" />
            <span className="text-[10px] font-medium text-rose-300">
              {failedCount} failed node{failedCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {/* Timing */}
      {graphState.startedAt && (
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>Elapsed</span>
          <span className="font-mono">{formatTime(elapsedTime)}</span>
        </div>
      )}

      {/* Active Agents */}
      {activeAgentIds.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Active Agents
          </div>
          <div className="flex flex-wrap gap-1">
            {activeAgentIds.map((id) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-1.5 py-0.5 bg-violet-500/20 text-violet-300 rounded text-[9px] font-medium"
              >
                {id}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
});

interface StatItemProps {
  label: string;
  value: number;
  color: string;
  bgColor: string;
  pulse?: boolean;
}

function StatItem({ label, value, color, bgColor, pulse }: StatItemProps) {
  return (
    <div
      className={cn(
        "p-2 rounded-lg",
        bgColor,
        pulse && "animate-pulse"
      )}
    >
      <div className="text-[9px] text-slate-500 uppercase tracking-wider">
        {label}
      </div>
      <div className={cn("text-base font-bold", color)}>{value}</div>
    </div>
  );
}

// Icons
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

function ErrorIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12" y2="16" />
    </svg>
  );
}