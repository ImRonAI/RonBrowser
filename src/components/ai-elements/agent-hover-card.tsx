/**
 * AgentHoverCard Component
 *
 * Displays detailed agent information on hover including:
 * - Agent name and description
 * - Available tools list
 * - System prompt (scrollable for long prompts)
 * - Model information
 *
 * Uses Radix UI HoverCard primitive with custom styling.
 */

"use client";

import { cn } from "@/lib/utils";
import * as HoverCard from "@radix-ui/react-hover-card";
import { motion } from "framer-motion";
import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// AgentHoverCard Component
// ─────────────────────────────────────────────────────────────────────────────

interface AgentHoverCardProps {
  agentName: string;
  agentDescription?: string;
  availableTools: string[];
  prompt: string;
  modelId: string;
  className?: string;
  children: React.ReactNode; // The trigger element (usually the node)
}

export function AgentHoverCard({
  agentName,
  agentDescription,
  availableTools,
  prompt,
  modelId,
  className,
  children,
}: AgentHoverCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncatePrompt = prompt.length > 150;
  const displayPrompt = isExpanded || !shouldTruncatePrompt
    ? prompt
    : `${prompt.slice(0, 150)}...`;

  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        {children}
      </HoverCard.Trigger>

      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="center"
          sideOffset={8}
          className={cn(
            "z-50 max-w-[320px]",
            "bg-slate-900/95 backdrop-blur-md",
            "border border-slate-700/50",
            "rounded-lg shadow-lg",
            "p-4",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
            className
          )}
        >
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {/* Header */}
            <div className="flex items-start gap-2">
              <AgentIcon className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-100 truncate">
                  {agentName}
                </h4>
                {agentDescription && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                    {agentDescription}
                  </p>
                )}
              </div>
            </div>

            <div className="h-px bg-slate-700/50" />

            {/* Tools List */}
            {availableTools.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <ToolIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Tools ({availableTools.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {availableTools.slice(0, 6).map((tool) => (
                    <span
                      key={tool}
                      className="px-2 py-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/20"
                    >
                      {tool}
                    </span>
                  ))}
                  {availableTools.length > 6 && (
                    <span className="px-2 py-1 text-[10px] font-medium text-slate-500">
                      +{availableTools.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Model Info */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <ModelIcon className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Model
                </span>
              </div>
              <div className="px-2 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded">
                <code className="text-[11px] font-mono text-sky-300">
                  {modelId}
                </code>
              </div>
            </div>

            {/* System Prompt */}
            {prompt && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <PromptIcon className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Prompt
                  </span>
                </div>
                <div
                  className={cn(
                    "px-2 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded",
                    "text-[10px] text-slate-300 leading-relaxed",
                    shouldTruncatePrompt && !isExpanded && "max-h-[80px] overflow-hidden"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {displayPrompt}
                  </p>
                  {shouldTruncatePrompt && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="text-violet-400 hover:text-violet-300 text-[9px] font-medium mt-1 transition-colors"
                    >
                      {isExpanded ? "Show Less" : "Show More"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          <HoverCard.Arrow className="fill-slate-800" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function AgentIcon({ className }: { className?: string }) {
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
      <path d="M12 8V4H8" />
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function ToolIcon({ className }: { className?: string }) {
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
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ModelIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="9" y1="15" x2="15" y2="9" />
    </svg>
  );
}

function PromptIcon({ className }: { className?: string }) {
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
    </svg>
  );
}
