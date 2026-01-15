/**
 * Timeline Component
 *
 * Displays execution timeline for orchestration events.
 * Shows a chronological view of agent activations, completions, and errors.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { OrchestrationEvent } from "@/components/ai-elements/strands-orchestration/types";

interface TimelineProps {
  events: OrchestrationEvent[];
  maxEvents?: number;
  className?: string;
}

export const Timeline = memo(function Timeline({
  events,
  maxEvents = 10,
  className,
}: TimelineProps) {
  // Limit events to maxEvents, showing most recent
  const displayEvents = events.slice(-maxEvents);

  const getEventConfig = (type: OrchestrationEvent["type"]) => {
    const configs = {
      "node-started": {
        label: "Started",
        color: "text-sky-300",
        bgColor: "bg-sky-500/20",
        borderColor: "border-sky-500/30",
        icon: PlayIcon,
      },
      "node-completed": {
        label: "Completed",
        color: "text-emerald-300",
        bgColor: "bg-emerald-500/20",
        borderColor: "border-emerald-500/30",
        icon: CheckIcon,
      },
      "node-error": {
        label: "Error",
        color: "text-rose-300",
        bgColor: "bg-rose-500/20",
        borderColor: "border-rose-500/30",
        icon: XIcon,
      },
      "edge-activated": {
        label: "Edge Active",
        color: "text-violet-300",
        bgColor: "bg-violet-500/20",
        borderColor: "border-violet-500/30",
        icon: ArrowIcon,
      },
      "edge-deactivated": {
        label: "Edge Inactive",
        color: "text-slate-400",
        bgColor: "bg-slate-800",
        borderColor: "border-slate-600",
        icon: ArrowIcon,
      },
      "handoff-initiated": {
        label: "Handoff",
        color: "text-amber-300",
        bgColor: "bg-amber-500/20",
        borderColor: "border-amber-500/30",
        icon: HandoffIcon,
      },
      "handoff-completed": {
        label: "Handoff Done",
        color: "text-amber-300",
        bgColor: "bg-amber-500/20",
        borderColor: "border-amber-500/30",
        icon: CheckIcon,
      },
      "context-updated": {
        label: "Context",
        color: "text-purple-300",
        bgColor: "bg-purple-500/20",
        borderColor: "border-purple-500/30",
        icon: ContextIcon,
      },
      "workflow-started": {
        label: "Workflow Start",
        color: "text-indigo-300",
        bgColor: "bg-indigo-500/20",
        borderColor: "border-indigo-500/30",
        icon: PlayIcon,
      },
      "workflow-completed": {
        label: "Workflow Done",
        color: "text-indigo-300",
        bgColor: "bg-indigo-500/20",
        borderColor: "border-indigo-500/30",
        icon: CheckIcon,
      },
      "workflow-error": {
        label: "Workflow Error",
        color: "text-rose-300",
        bgColor: "bg-rose-500/20",
        borderColor: "border-rose-500/30",
        icon: XIcon,
      },
    };

    return configs[type] || {
      label: type,
      color: "text-slate-400",
      bgColor: "bg-slate-800",
      borderColor: "border-slate-600",
      icon: CircleIcon,
    };
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  const getRelativeTime = (timestamp: number, firstTimestamp: number) => {
    const diff = timestamp - firstTimestamp;
    const seconds = Math.floor(diff / 1000);
    const ms = diff % 1000;

    if (seconds === 0) {
      return `+${ms}ms`;
    } else if (seconds < 60) {
      return `+${seconds}.${Math.floor(ms / 100)}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `+${minutes}m ${remainingSeconds}s`;
    }
  };

  const firstTimestamp = displayEvents[0]?.timestamp || Date.now();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
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
          <TimelineIcon className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Execution Timeline
          </span>
        </div>
        <span className="text-[10px] text-slate-500">
          Last {displayEvents.length} events
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700" />

        {/* Events */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {displayEvents.map((event, index) => {
              const config = getEventConfig(event.type);
              const Icon = config.icon;

              return (
                <motion.div
                  key={`${event.type}-${event.timestamp}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="relative flex items-start gap-3"
                >
                  {/* Node */}
                  <div
                    className={cn(
                      "relative z-10 w-8 h-8 rounded-lg flex items-center justify-center",
                      "border transition-all duration-200",
                      config.bgColor,
                      config.borderColor
                    )}
                  >
                    <Icon className={cn("w-4 h-4", config.color)} />
                    {index === displayEvents.length - 1 && (
                      <div className="absolute inset-0 rounded-lg animate-ping opacity-50">
                        <div className={cn("w-full h-full rounded-lg", config.bgColor)} />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-medium", config.color)}>
                          {config.label}
                        </span>
                        {event.nodeId && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {event.nodeId}
                          </span>
                        )}
                        {event.edgeId && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {event.edgeId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-slate-500">
                        <span className="font-mono">
                          {getRelativeTime(event.timestamp, firstTimestamp)}
                        </span>
                        <span className="opacity-50">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Additional data */}
                    {event.data ? (
                      <div className="mt-1 text-[10px] text-slate-400 font-mono">
                        {typeof event.data === "string"
                          ? (event.data as string)
                          : JSON.stringify(event.data as Record<string, unknown>, null, 2)}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Summary */}
      {displayEvents.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Total Duration</span>
            <span className="font-mono">
              {getRelativeTime(
                displayEvents[displayEvents.length - 1].timestamp,
                displayEvents[0].timestamp
              )}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function TimelineIcon({ className }: { className?: string }) {
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
      <path d="M12 2v20" />
      <path d="M8 5l4 4 4-4" />
      <path d="M8 19l4-4 4 4" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
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
      strokeWidth="2.5"
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
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function HandoffIcon({ className }: { className?: string }) {
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
      <path d="M15 12h6" />
      <path d="m18 9 3 3-3 3" />
      <path d="M3 12h6" />
      <path d="m6 15-3-3 3-3" />
    </svg>
  );
}

function ContextIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="7" y="7" width="3" height="9" />
      <rect x="14" y="7" width="3" height="5" />
    </svg>
  );
}

function CircleIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}