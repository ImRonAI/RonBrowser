/**
 * SubagentTransparencyPanel Component
 *
 * Right-side panel (30%) showing selected subagent's chain of thought, tool calls, and outputs.
 * Displays live streaming data during execution or final output after completion.
 */

"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type {
  AgentStreamingData,
  AIChainOfThoughtStep,
  AIToolExecution,
  CompletedNodeOutput,
} from "@/stores/orchestrationStore";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { ChainOfThoughtSearch } from "@/components/ai-elements/chain-of-thought-search";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { ResponseMarkdown } from "@/components/ai-elements/response";
import { Task, TaskHeader, type TaskStatus } from "@/components/ai-elements/task";
import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentTool,
  AgentTools,
} from "@/components/ai-elements/agent";
import type { Tool as AISDKTool } from "ai";
import {
  extractSearchQuery,
  extractSearchResults,
  getSearchProvider,
} from "@/utils/search-tool-utils";
import { usePreviewStore } from "@/stores/previewStore";

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
  agentModel?: string;
  agentPrompt?: string;
  agentTools?: string[];
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
  agentModel,
  agentPrompt,
  agentTools,
  className,
}: SubagentTransparencyPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevStepCountRef = useRef(0);
  const { openBrowserPreview } = usePreviewStore();

  const isOutputStep = useCallback((label?: string) => {
    if (!label) return false;
    const normalized = label.toLowerCase();
    return (
      normalized === "output" ||
      normalized === "final" ||
      normalized === "final output" ||
      normalized === "final answer" ||
      normalized === "answer" ||
      normalized === "response" ||
      normalized === "result"
    );
  }, []);

  const reasoningSteps = useMemo<AIChainOfThoughtStep[]>(() => {
    if (!streamingData) return [];
    const chainSteps =
      streamingData.chainOfThought?.filter(
        (step) => !isOutputStep(step.label)
      ) || [];

    if (chainSteps.length > 0) {
      return chainSteps;
    }

    if (streamingData.reasoning?.content) {
      return [
        {
          label: "Reasoning",
          description: streamingData.reasoning.content,
          status: isActive ? "running" : "success",
        },
      ];
    }

    return [];
  }, [agentId, streamingData, isActive, isOutputStep]);

  const toolCalls = useMemo<AIToolExecution[]>(() => {
    return streamingData?.tools || [];
  }, [streamingData]);

  const agentToolDefinitions = useMemo(() => {
    if (!agentTools || agentTools.length === 0) return [];

    return agentTools.map((toolName) => ({
      name: toolName,
      tool: {
        description: toolName,
        inputSchema: {
          type: "object",
          properties: {},
        },
      } as AISDKTool,
    }));
  }, [agentTools]);

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

  const hasChainOfThought = reasoningSteps.length > 0 || toolCalls.length > 0;
  const stepCount = reasoningSteps.length + toolCalls.length;
  const outputText = streamingData?.output;
  const hasOutput = Boolean(outputText && outputText.trim().length > 0);
  const taskStatus: TaskStatus = isActive
    ? "running"
    : finalOutput?.status === "error"
      ? "error"
      : finalOutput
        ? "success"
        : "pending";
  const hasAgentConfiguration = Boolean(
    agentDescription || agentPrompt || agentToolDefinitions.length > 0
  );
  const shouldStretch = !className || !className.includes("h-auto");

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
    <div className={cn("flex h-full flex-col gap-3", className)}>
      <Agent>
        <AgentHeader name={agentName || "Agent"} model={agentModel} />
        <AgentContent>
          {agentDescription && (
            <div className="text-xs text-ink-muted">{agentDescription}</div>
          )}
          {agentPrompt && <AgentInstructions>{agentPrompt}</AgentInstructions>}
          {agentToolDefinitions.length > 0 && (
            <AgentTools>
              {agentToolDefinitions.map((tool) => (
                <AgentTool
                  key={tool.name}
                  tool={tool.tool}
                  value={tool.name}
                />
              ))}
            </AgentTools>
          )}
          {!hasAgentConfiguration && (
            <div className="text-xs text-ink-muted">
              No agent configuration available yet.
            </div>
          )}
          {isActive && (
            <div className="flex items-center gap-2 text-xs text-violet-500">
              <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
              Streaming...
            </div>
          )}
        </AgentContent>
      </Agent>

      <Task className={cn("flex min-h-0 flex-col", shouldStretch && "flex-1")}>
        <TaskHeader
          title={agentName ? `${agentName} Task` : "Task"}
          status={taskStatus}
        />

        {/* Scrollable Content */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto space-y-4 p-4"
        >
          {hasChainOfThought && (
            <ChainOfThought
              defaultOpen
              isStreaming={mode === "live" && isActive}
              autoCollapseDelay={0}
            >
              <ChainOfThoughtHeader>
                {mode === "live" && isActive
                  ? "Processing..."
                  : `Thought Process (${stepCount} step${stepCount === 1 ? "" : "s"})`}
              </ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                {reasoningSteps.map((step, index) => {
                  const stepStatus =
                    step.status === "success"
                      ? "complete"
                      : step.status === "error"
                        ? "error"
                        : step.status === "pending"
                          ? "pending"
                          : "running";
                  const reasoningText = step.description || "";

                  return (
                    <ChainOfThoughtStep
                      key={`${step.label}-${index}`}
                      label={step.label}
                      status={stepStatus}
                    >
                      <Reasoning
                        isStreaming={isActive && stepStatus === "running"}
                      >
                        <ReasoningTrigger />
                        <ReasoningContent>
                          <ResponseMarkdown
                            content={
                              reasoningText || (isActive ? "Thinking..." : "No details")
                            }
                            isStreaming={isActive && stepStatus === "running"}
                          />
                        </ReasoningContent>
                      </Reasoning>
                    </ChainOfThoughtStep>
                  );
                })}

                {toolCalls.map((tool) => {
                  const toolState =
                    tool.status === "success"
                      ? "success"
                      : tool.status === "error"
                        ? "error"
                        : "running";
                  const stepStatus =
                    toolState === "success"
                      ? "complete"
                      : toolState === "error"
                        ? "error"
                        : "running";
                  const toolInput =
                    tool.input && typeof tool.input === "object"
                      ? (tool.input as Record<string, unknown>)
                      : tool.input != null
                        ? { value: tool.input }
                        : undefined;
                  const searchProvider = getSearchProvider(tool.name);
                  const searchQuery = searchProvider
                    ? extractSearchQuery(tool.input)
                    : null;
                  const searchResults = searchProvider
                    ? extractSearchResults(tool.output, searchProvider)
                    : [];
                  const shouldShowSearch = Boolean(searchProvider);
                  const hasToolOutput = tool.output != null || tool.error != null;
                  const shouldKeepOpen =
                    toolState !== "success" || shouldShowSearch || hasToolOutput;

                  const handlePreview = (result: { url: string; title: string }) => {
                    if (!result.url) return;
                    openBrowserPreview({
                      url: result.url,
                      title: result.title,
                      isLive: true,
                    });
                  };

                  return (
                    <ChainOfThoughtStep
                      key={tool.id}
                      label={tool.name}
                      status={stepStatus}
                    >
                      <Tool
                        isStreaming={toolState === "running"}
                        defaultOpen={shouldKeepOpen}
                      >
                        <ToolHeader title={tool.name} state={toolState} />
                        <ToolContent>
                          {toolInput && (
                            <ToolInput
                              input={toolInput}
                              isStreaming={toolState === "running"}
                            />
                          )}
                          {shouldShowSearch && searchProvider && (
                            <ChainOfThoughtSearch
                              provider={searchProvider}
                              query={searchQuery || tool.name}
                              results={searchResults}
                              isSearching={toolState === "running"}
                              error={toolState === "error" ? tool.error : undefined}
                              onResultClick={handlePreview}
                              onExpandPreview={handlePreview}
                            />
                          )}
                          {!shouldShowSearch && tool.output != null && (
                            <ToolOutput output={tool.output} />
                          )}
                          {toolState === "error" && tool.error && (
                            <ToolOutput errorText={tool.error} />
                          )}
                        </ToolContent>
                      </Tool>
                    </ChainOfThoughtStep>
                  );
                })}
              </ChainOfThoughtContent>
            </ChainOfThought>
          )}

          {/* Live Output (outside Chain-of-Thought) */}
          {mode === "live" && hasOutput && (
            <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800">
              <div className="text-xs font-medium text-ink mb-2">Output</div>
              <ResponseMarkdown
                content={outputText || ""}
                className="text-xs text-ink-muted"
                isStreaming={isActive}
              />
            </div>
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
                <ResponseMarkdown
                  content={finalOutput.content}
                  className="text-xs text-ink-muted"
                />
              </div>
            </div>
          )}

          {/* No data state */}
          {mode === "live" && !hasChainOfThought && !hasOutput && (
            <div className="flex items-center justify-center py-8 text-center">
              <div className="space-y-2">
                <div className="text-xs text-ink-muted">
                  {isActive ? "Waiting for agent to start..." : "No activity yet"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Metrics */}
        {((mode === "completed" && finalOutput) || toolCalls.length > 0) && (
          <div className="flex-shrink-0 border-t border-surface-200 dark:border-surface-700 px-4 py-3">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <div className="flex items-center gap-4">
                {mode === "completed" && finalOutput && (
                  <>
                    {finalOutput.duration != null && (
                      <div>
                        <span className="font-medium">Duration:</span>{" "}
                        {finalOutput.duration}ms
                      </div>
                    )}
                    {finalOutput.tokenUsage.input != null && (
                      <div>
                        <span className="font-medium">Tokens:</span>{" "}
                        {finalOutput.tokenUsage.input +
                          (finalOutput.tokenUsage.output || 0)}
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
      </Task>
    </div>
  );
}
