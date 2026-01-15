/**
 * StepBadge Component
 *
 * Individual step badge for workflow visualization.
 * Shows step number and status with click navigation.
 */

"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { WorkflowTaskStatus } from "@/components/ai-elements/strands-orchestration/types";

// ─────────────────────────────────────────────────────────────────────────────
// Status Styling
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<
  WorkflowTaskStatus,
  {
    bg: string;
    border: string;
    text: string;
    hover: string;
    icon?: string;
  }
> = {
  pending: {
    bg: "bg-slate-800/80",
    border: "border-slate-600",
    text: "text-slate-400",
    hover: "hover:bg-slate-700/80 hover:border-slate-500",
  },
  running: {
    bg: "bg-sky-500/20",
    border: "border-sky-500",
    text: "text-sky-400",
    hover: "hover:bg-sky-500/30",
    icon: "animate-spin",
  },
  completed: {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500",
    text: "text-emerald-400",
    hover: "hover:bg-emerald-500/30",
    icon: "✓",
  },
  error: {
    bg: "bg-rose-500/20",
    border: "border-rose-500",
    text: "text-rose-400",
    hover: "hover:bg-rose-500/30",
    icon: "✕",
  },
  cancelled: {
    bg: "bg-slate-700/80",
    border: "border-slate-500",
    text: "text-slate-400",
    hover: "hover:bg-slate-600/80",
    icon: "—",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface StepBadgeProps {
  stepNumber: number;
  status: WorkflowTaskStatus;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StepBadge({
  stepNumber,
  status,
  isActive = false,
  onClick,
  className,
}: StepBadgeProps) {
  const styles = STATUS_STYLES[status];

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        duration: 0.2,
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center",
        "w-10 h-10 rounded-full",
        "border-2 backdrop-blur-sm",
        "transition-all duration-300",
        "cursor-pointer select-none",
        styles.bg,
        styles.border,
        styles.text,
        styles.hover,
        isActive && "shadow-[0_0_20px_-4px] shadow-violet-500",
        className
      )}
    >
      {/* Step Number or Icon */}
      <span className="text-sm font-bold">
        {status === "running" ? (
          <LoadingSpinner className="w-4 h-4" />
        ) : status === "completed" ? (
          <CheckIcon className="w-4 h-4" />
        ) : status === "error" ? (
          <XIcon className="w-4 h-4" />
        ) : status === "cancelled" ? (
          <MinusIcon className="w-4 h-4" />
        ) : (
          stepNumber
        )}
      </span>

      {/* Active Ring */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-violet-500"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 0 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      )}

      {/* Purple Glow for Active */}
      {isActive && (
        <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-lg animate-pulse" />
      )}

      {/* Tooltip */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className="text-[9px] font-medium text-slate-400 whitespace-nowrap">
          Step {stepNumber}
        </span>
      </div>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}