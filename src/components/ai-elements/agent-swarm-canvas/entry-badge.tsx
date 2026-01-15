/**
 * EntryBadge Component
 *
 * Visual indicator for entry point agents in the Swarm orchestration.
 * Appears as an overlay badge on top of the node.
 */

import { memo } from "react";
import { useStore } from "@xyflow/react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// EntryBadge Component
// ─────────────────────────────────────────────────────────────────────────────

interface EntryBadgeProps {
  nodeId: string;
  className?: string;
}

export const EntryBadge = memo(function EntryBadge({
  nodeId,
  className,
}: EntryBadgeProps) {
  // Get node position from React Flow store
  const nodePosition = useStore((state) => {
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    return {
      x: node.position.x + (node.measured?.width || 280) / 2,
      y: node.position.y - 10,
    };
  });

  if (!nodePosition) return null;

  return (
    <div
      className="absolute z-30"
      style={{
        transform: `translate(${nodePosition.x}px, ${nodePosition.y}px)`,
        left: 0,
        top: 0,
      }}
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 25,
          delay: 0.2,
        }}
        className={cn("relative -translate-x-1/2", className)}
      >
        {/* Glow Background */}
        <div className="absolute inset-0 bg-violet-500 blur-md opacity-50 rounded-full" />

        {/* Badge */}
        <div
          className={cn(
            "relative px-3 py-1",
            "bg-violet-500 text-white",
            "rounded-full shadow-lg",
            "border border-violet-400/50"
          )}
        >
          <div className="flex items-center gap-1.5">
            {/* Entry Icon */}
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6" />
              <path d="M9 9v6h6" />
            </svg>

            {/* Label */}
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Entry Point
            </span>
          </div>
        </div>

        {/* Pulse Animation */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-violet-500 rounded-full animate-ping opacity-20" />
          <div className="absolute inset-0 bg-violet-500 rounded-full animate-ping opacity-10 animation-delay-500" />
        </div>
      </motion.div>

      {/* Custom Animation Styles */}
      <style>{`
        @keyframes ping {
          0% {
            transform: scale(1);
            opacity: 0.2;
          }
          75%,
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        .animation-delay-500 {
          animation-delay: 500ms;
        }
      `}</style>
    </div>
  );
});