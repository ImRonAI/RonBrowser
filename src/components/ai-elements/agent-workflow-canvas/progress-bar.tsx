/**
 * WorkflowProgressBar Component
 *
 * Full-width segmented progress indicator for workflow execution.
 * Shows completion status for each task in the workflow.
 */

"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { WorkflowTask } from "@/components/ai-elements/strands-orchestration/types";

// ─────────────────────────────────────────────────────────────────────────────
// Status Colors
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  pending: {
    bg: "bg-slate-700/50",
    border: "border-slate-600",
    text: "text-slate-400",
  },
  running: {
    bg: "bg-sky-500",
    border: "border-sky-400",
    text: "text-white",
    glow: "shadow-[0_0_12px_-2px_rgba(14,165,233,0.5)]",
  },
  completed: {
    bg: "bg-emerald-500",
    border: "border-emerald-400",
    text: "text-white",
  },
  error: {
    bg: "bg-rose-500",
    border: "border-rose-400",
    text: "text-white",
  },
  cancelled: {
    bg: "bg-slate-600",
    border: "border-slate-500",
    text: "text-slate-300",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface WorkflowProgressBarProps {
  tasks: WorkflowTask[];
  currentStep: number;
  progress: number;
  className?: string;
}

export function WorkflowProgressBar({
  tasks,
  currentStep,
  progress,
  className,
}: WorkflowProgressBarProps) {
  if (!tasks || tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;
  const progressPercentage = Math.round(progress * 100);

  return (
    <div
      className={cn(
        "px-6 py-4 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Workflow Progress
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Step {currentStep} of {totalCount}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs font-medium text-emerald-400">
              {completedCount} completed
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-200">
            {progressPercentage}%
          </span>
        </div>
      </div>

      {/* Segmented Progress Bar */}
      <div className="relative">
        {/* Background Track */}
        <div className="absolute inset-0 h-8 bg-slate-800/50 rounded-lg" />

        {/* Segments Container */}
        <div className="relative flex gap-1 h-8 p-1">
          <AnimatePresence mode="sync">
            {tasks.map((task, index) => {
              const status = STATUS_COLORS[task.status] || STATUS_COLORS.pending;
              const isActive = task.status === "running";
              const segmentWidth = `${100 / totalCount}%`;

              return (
                <motion.div
                  key={task.taskId}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="relative flex-1"
                  style={{ width: segmentWidth }}
                >
                  {/* Segment */}
                  <div
                    className={cn(
                      "h-full rounded border transition-all duration-300",
                      status.bg,
                      status.border,
                      'glow' in status && status.glow,
                      isActive && "animate-pulse"
                    )}
                  >
                    {/* Step Number Label */}
                    <div className="flex items-center justify-center h-full">
                      <span
                        className={cn(
                          "text-[10px] font-bold",
                          status.text
                        )}
                      >
                        {index + 1}
                      </span>
                    </div>

                    {/* Active Indicator */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.2, 0.4, 0.2] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <div className="h-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      </motion.div>
                    )}
                  </div>

                  {/* Connector Line */}
                  {index < tasks.length - 1 && (
                    <div
                      className={cn(
                        "absolute top-1/2 -right-1 w-1 h-0.5 -translate-y-1/2 z-10",
                        task.status === "completed"
                          ? "bg-emerald-500"
                          : "bg-slate-700"
                      )}
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Overall Progress Overlay */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      </div>

      {/* Task Details (optional) */}
      {tasks.some((t) => t.status === "running") && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          {tasks
            .filter((t) => t.status === "running")
            .map((task) => (
              <div
                key={task.taskId}
                className="flex items-center gap-2 text-xs"
              >
                <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
                <span className="text-slate-400">Running:</span>
                <span className="text-slate-200 font-medium">
                  {task.description}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}