/**
 * SubagentTransparencyPanel Component
 *
 * Right-side panel (30%) showing selected subagent's chain of thought, tool calls, and outputs.
 * Displays live streaming data during execution or final output after completion.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircleIcon, XCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type {
  AgentStreamingData,
  AIChainOfThoughtStep,
  AIToolExecution,
  CompletedNodeOutput,
} from "@/stores/orchestrationStore";

// ─────────────────────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface SubagentTransparencyPanelProps {
  agentId: string | null;
  mode: "live" | "completed";
  streamingData?: AgentStreamingData;
  finalOutput?: CompletedNodeOutput;
  isActive: boolean;
  agentName?: string;
  agentDescription?: string;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SubagentTransparencyPanel({
  agentId,
  mode,
  streamingData,
  finalOutput,
  isActive,
  agentName,
  agentDescription,
  className,
}: SubagentTransparencyPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevStepCountRef = useRef(0);

  const [reasoningSteps, setReasoningSteps] = useState<AIChainOfThoughtStep[]>([]);
  const [toolCalls, setToolCalls] = useState<AIToolExecution[]>([]);

  // ─── Update streaming data ───
  useEffect(() => {
    if (mode === "live" && streamingData) {
      setReasoningSteps(streamingData.chainOfThought || []);
      setToolCalls(streamingData.tools || []);
    }
  }, [mode, streamingData]);

  // ─── Auto-scroll to bottom when new content arrives ───
  useEffect(() => {
    const currentStepCount = reasoningSteps.length + toolCalls.length;

    if (currentStepCount > prevStepCountRef.current) {
      scrollContainerRef.current?.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }

    prevStepCountRef.current = currentStepCount;
  }, [reasoningSteps, toolCalls]);

  // ─── Empty state ───
  if (!agentId) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center p-6 text-center",
          className
        )}
      >
        <div className="space-y-2">
          <div className="text-sm font-medium text-ink-muted">
            No agent selected
          </div>
          <div className="text-xs text-ink-muted/70">
            Click a node to view details
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-surface-200 dark:border-surface-700 pb-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className={cn(
              "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border-2 text-xs font-semibold",
              isActive
                ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                : "border-surface-300 bg-surface-100 text-surface-600 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-400"
            )}
          >
            {agentName?.charAt(0).toUpperCase() || "A"}
          </div>

          {/* Name & Description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink truncate">
                {agentName || "Agent"}
              </h3>
              {isActive && (
                <div className="flex h-2 w-2 flex-shrink-0">
                  <span className="absolute h-2 w-2 animate-ping rounded-full bg-violet-400 opacity-75" />
                  <span className="relative h-2 w-2 rounded-full bg-violet-500" />
                </div>
              )}
            </div>
            {agentDescription && (
              <p className="mt-0.5 text-xs text-ink-muted line-clamp-2">
                {agentDescription}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto space-y-3 py-4"
      >
        {/* Live Mode - Streaming Chain of Thought */}
        {mode === "live" && (
          <>
            {/* Reasoning Steps */}
            <AnimatePresence>
              {reasoningSteps.map((step, index) => (
                <motion.div
                  key={`reasoning-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-lg border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800"
                >
                  <div className="flex items-start gap-2">
                    {step.status === "success" && (
                      <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-emerald-500 mt-0.5" />
                    )}
                    {step.status === "error" && (
                      <XCircleIcon className="h-4 w-4 flex-shrink-0 text-red-500 mt-0.5" />
                    )}
                    {step.status === "running" && (
                      <div className="h-4 w-4 flex-shrink-0 mt-0.5">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                      </div>
                    )}
                    {step.status === "pending" && (
                      <ClockIcon className="h-4 w-4 flex-shrink-0 text-surface-400 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-ink">
                        {step.label}
                      </div>
                      {step.description && (
                        <div className="mt-1 text-xs text-ink-muted">
                          {step.description}
                        </div>
                      )}
                      {step.duration && (
                        <div className="mt-1 text-xs text-ink-muted/70">
                          {step.duration}ms
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Tool Calls */}
            <AnimatePresence>
              {toolCalls.map((tool) => (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-ink">
                          {tool.name}
                        </span>
                        {tool.status === "running" && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            Running...
                          </span>
                        )}
                        {tool.status === "success" && (
                          <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
                        )}
                        {tool.status === "error" && (
                          <XCircleIcon className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                      {tool.output && (
                        <div className="mt-2 rounded bg-surface-100 p-2 text-xs text-ink-muted dark:bg-surface-900">
                          {tool.output}
                        </div>
                      )}
                      {tool.error && (
                        <div className="mt-2 rounded bg-red-100 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
                          {tool.error}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Reasoning text (real-time) */}
            {streamingData?.reasoning && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-900/20"
              >
                <div className="text-xs font-medium text-violet-700 dark:text-violet-400 mb-2">
                  Reasoning
                </div>
                <div className="text-xs text-ink-muted whitespace-pre-wrap">
                  {streamingData.reasoning.content}
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* Completed Mode - Final Output */}
        {mode === "completed" && finalOutput && (
          <div className="space-y-3">
            {/* Status Banner */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg p-3",
                finalOutput.status === "success"
                  ? "bg-emerald-50 dark:bg-emerald-900/20"
                  : "bg-red-50 dark:bg-red-900/20"
              )}
            >
              {finalOutput.status === "success" ? (
                <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-emerald-500" />
              ) : (
                <XCircleIcon className="h-5 w-5 flex-shrink-0 text-red-500" />
              )}
              <div className="flex-1">
                <div
                  className={cn(
                    "text-xs font-semibold",
                    finalOutput.status === "success"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-red-700 dark:text-red-400"
                  )}
                >
                  {finalOutput.status === "success"
                    ? "Completed Successfully"
                    : "Failed"}
                </div>
              </div>
            </div>

            {/* Final Output */}
            <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800">
              <div className="text-xs font-medium text-ink mb-2">Output</div>
              <div className="text-xs text-ink-muted whitespace-pre-wrap">
                {finalOutput.content}
              </div>
            </div>
          </div>
        )}

        {/* No data state */}
        {mode === "live" &&
          !streamingData?.reasoning &&
          reasoningSteps.length === 0 &&
          toolCalls.length === 0 && (
            <div className="flex items-center justify-center py-8 text-center">
              <div className="space-y-2">
                <div className="text-xs text-ink-muted">
                  {isActive
                    ? "Waiting for agent to start..."
                    : "No activity yet"}
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Footer Metrics */}
      {(mode === "completed" && finalOutput) || toolCalls.length > 0 && (
        <div className="flex-shrink-0 border-t border-surface-200 dark:border-surface-700 pt-3">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <div className="flex items-center gap-4">
              {mode === "completed" && finalOutput && (
                <>
                  <div>
                    <span className="font-medium">Duration:</span>{" "}
                    {finalOutput.duration}ms
                  </div>
                  {finalOutput.tokenUsage.input && (
                    <div>
                      <span className="font-medium">Tokens:</span>{" "}
                      {finalOutput.tokenUsage.input + (finalOutput.tokenUsage.output || 0)}
                    </div>
                  )}
                </>
              )}
              {mode === "live" && toolCalls.length > 0 && (
                <div>
                  <span className="font-medium">Tools:</span> {toolCalls.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
