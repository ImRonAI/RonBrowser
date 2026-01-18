/**
 * FormationTypeIndicator Component
 *
 * Small badge showing formation type (workflow/swarm/graph) + status indicator.
 * Placed in top-left of canvas to show what orchestration pattern is active.
 */

"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface FormationTypeIndicatorProps {
  type: "workflow" | "swarm" | "graph";
  status: "idle" | "running" | "completed" | "error";
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function FormationTypeIndicator({
  type,
  status,
  className,
}: FormationTypeIndicatorProps) {
  const config = {
    workflow: {
      icon: WorkflowIcon,
      label: "Workflow",
      color: "violet",
    },
    swarm: {
      icon: SwarmIcon,
      label: "Swarm",
      color: "blue",
    },
    graph: {
      icon: GraphIcon,
      label: "Graph",
      color: "emerald",
    },
  }[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 backdrop-blur-sm",
        "bg-surface-50/90 dark:bg-surface-800/90",
        "border-surface-200 dark:border-surface-700",
        className
      )}
    >
      <config.icon
        className={cn(
          "h-4 w-4",
          `text-${config.color}-500`,
          status === "running" && "animate-pulse"
        )}
      />
      <span className="text-xs font-semibold text-ink dark:text-ink-inverse">
        {config.label}
      </span>

      {/* Status Indicator */}
      {status === "running" && (
        <div className="ml-auto flex h-2 w-2">
          <span className="absolute h-2 w-2 animate-ping rounded-full bg-violet-400 opacity-75" />
          <span className="relative h-2 w-2 rounded-full bg-violet-500" />
        </div>
      )}

      {status === "completed" && (
        <svg
          className="ml-auto h-3 w-3 text-emerald-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}

      {status === "error" && (
        <svg
          className="ml-auto h-3 w-3 text-red-500"
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
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function WorkflowIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M10 6.5h4" />
      <path d="M10 17.5h4" />
      <path d="M17.5 10v4" />
    </svg>
  );
}

function SwarmIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="3" />
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <circle cx="6" cy="18" r="2" />
      <path d="M8 6.5l4 4" />
      <path d="M16 8l-4 4" />
      <path d="M8 17.5l4-4" />
      <path d="M16 16l-4-4" />
    </svg>
  );
}

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
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="19" r="2" />
      <circle cx="19" cy="12" r="2" />
      <path d="M7 12h5" />
      <path d="M12 7v5" />
      <path d="M12 14v5" />
      <path d="M14 12h3" />
    </svg>
  );
}
