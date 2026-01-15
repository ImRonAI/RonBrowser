/**
 * HandoffHistory Component
 *
 * Bottom panel showing handoff trace/history in the Swarm orchestration.
 * Displays a scrollable list of handoff events with timestamps and context.
 */

import { memo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { HandoffMessage } from "@/components/ai-elements/strands-orchestration/types";

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function ChevronUpIcon({ className }: { className?: string }) {
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
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
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

function ClockIcon({ className }: { className?: string }) {
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
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function getRelativeTime(timestamp: number, firstTimestamp: number): string {
  const diff = timestamp - firstTimestamp;
  const seconds = Math.floor(diff / 1000);
  const ms = diff % 1000;
  return `+${seconds}.${ms.toString().padStart(3, "0")}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HandoffItem Component
// ─────────────────────────────────────────────────────────────────────────────

interface HandoffItemProps {
  handoff: HandoffMessage;
  index: number;
  firstTimestamp: number;
  isLatest: boolean;
  onClick?: (handoff: HandoffMessage) => void;
}

const HandoffItem = memo(function HandoffItem({
  handoff,
  index,
  firstTimestamp,
  isLatest,
  onClick,
}: HandoffItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3",
        "hover:bg-slate-800/50 transition-colors cursor-pointer",
        isLatest && "bg-violet-500/5 border-l-2 border-violet-500"
      )}
      onClick={() => onClick?.(handoff)}
    >
      {/* Index Badge */}
      <div
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
          isLatest
            ? "bg-violet-500 text-white"
            : "bg-slate-700 text-slate-400"
        )}
      >
        {index + 1}
      </div>

      {/* Handoff Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-slate-200 truncate">
            {handoff.fromAgent}
          </span>
          <ArrowRightIcon className="w-3 h-3 text-slate-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-violet-400 truncate">
            {handoff.toAgent}
          </span>
        </div>

        {handoff.message && (
          <p className="text-xs text-slate-400 line-clamp-2 mb-1">
            {handoff.message}
          </p>
        )}

        {handoff.context && Object.keys(handoff.context).length > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="px-1.5 py-0.5 bg-slate-800 rounded">
              {Object.keys(handoff.context).length} context vars
            </span>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="flex-shrink-0 text-right">
        <div className="text-[10px] text-slate-500">
          {formatTimestamp(handoff.timestamp)}
        </div>
        <div className="text-[9px] text-slate-600">
          {getRelativeTime(handoff.timestamp, firstTimestamp)}
        </div>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// HandoffHistory Component
// ─────────────────────────────────────────────────────────────────────────────

interface HandoffHistoryProps {
  handoffs: HandoffMessage[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onHandoffClick?: (handoff: HandoffMessage) => void;
}

export const HandoffHistory = memo(function HandoffHistory({
  handoffs,
  isExpanded,
  onToggleExpand,
  onHandoffClick,
}: HandoffHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstTimestamp = handoffs[0]?.timestamp || Date.now();

  // Auto-scroll to bottom when new handoffs are added
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [handoffs.length, isExpanded]);

  return (
    <div
      className={cn(
        "bg-slate-900/95 backdrop-blur-sm border-t border-slate-700",
        "transition-all duration-300",
        isExpanded ? "h-64" : "h-12"
      )}
    >
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className={cn(
          "w-full px-4 h-12 flex items-center justify-between",
          "hover:bg-slate-800/50 transition-colors",
          "border-b border-slate-700/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-200">
              Handoff History
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-slate-800 rounded-full text-xs font-medium text-slate-400">
              {handoffs.length} handoff{handoffs.length !== 1 ? "s" : ""}
            </span>

            {handoffs.length > 0 && (
              <span className="text-xs text-slate-500">
                Latest: {handoffs[handoffs.length - 1].toAgent}
              </span>
            )}
          </div>
        </div>

        <ChevronUpIcon
          className={cn(
            "w-4 h-4 text-slate-400 transition-transform",
            !isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Handoff List */}
      {isExpanded && (
        <div
          ref={scrollRef}
          className="h-[calc(100%-48px)] overflow-y-auto custom-scrollbar"
        >
          {handoffs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-slate-500">No handoffs yet</p>
            </div>
          ) : (
            <div className="py-2">
              {handoffs.map((handoff, index) => (
                <HandoffItem
                  key={`${handoff.timestamp}-${index}`}
                  handoff={handoff}
                  index={index}
                  firstTimestamp={firstTimestamp}
                  isLatest={index === handoffs.length - 1}
                  onClick={onHandoffClick}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
      `}</style>
    </div>
  );
});