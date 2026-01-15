/**
 * AgentWorkflowCanvas Demo
 *
 * Example usage of the AgentWorkflowCanvas component with mock workflow data.
 */

"use client";

import { useEffect } from "react";
import { AgentWorkflowCanvas } from "./index";
import { useOrchestrationStore } from "@/stores/orchestrationStore";
import type { WorkflowState, WorkflowTask } from "@/components/ai-elements/strands-orchestration/types";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Workflow Data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_WORKFLOW_TASKS: WorkflowTask[] = [
  {
    taskId: "task-1",
    description: "Initialize environment and load configurations",
    dependencies: [],
    tools: ["file-reader", "config-loader"],
    modelProvider: "anthropic",
    priority: 5,
    timeout: 30000,
    status: "completed",
    result: {
      status: "success",
      content: "Environment initialized successfully",
      startedAt: Date.now() - 60000,
      completedAt: Date.now() - 45000,
    },
  },
  {
    taskId: "task-2",
    description: "Analyze codebase and identify components",
    dependencies: ["task-1"],
    tools: ["code-analyzer", "ast-parser"],
    modelProvider: "openai",
    priority: 4,
    timeout: 60000,
    status: "completed",
    result: {
      status: "success",
      content: "Found 42 components across 8 modules",
      startedAt: Date.now() - 45000,
      completedAt: Date.now() - 20000,
    },
  },
  {
    taskId: "task-3",
    description: "Generate documentation for identified components",
    dependencies: ["task-2"],
    tools: ["doc-generator", "markdown-formatter"],
    modelProvider: "anthropic",
    priority: 3,
    timeout: 90000,
    status: "running",
    isActivelyStreaming: true,
    streamingData: {
      reasoning: {
        content: "Analyzing component signatures and creating comprehensive documentation...",
        duration: 5000,
      },
      chainOfThought: [
        {
          id: "cot-1",
          content: "Extracting JSDoc comments from source files",
          status: "completed",
          timestamp: Date.now() - 10000,
        },
        {
          id: "cot-2",
          content: "Generating usage examples for each component",
          status: "running",
          timestamp: Date.now() - 5000,
        },
      ],
      tools: [
        {
          id: "tool-1",
          name: "doc-generator",
          status: "running",
          input: { components: 42 },
          timestamp: Date.now() - 3000,
        },
      ],
    },
  },
  {
    taskId: "task-4",
    description: "Validate generated documentation",
    dependencies: ["task-3"],
    tools: ["validator", "spell-checker"],
    modelProvider: "openai",
    priority: 2,
    timeout: 45000,
    status: "pending",
  },
  {
    taskId: "task-5",
    description: "Deploy documentation to production",
    dependencies: ["task-4"],
    tools: ["deployer", "cdn-uploader"],
    modelProvider: "anthropic",
    priority: 1,
    timeout: 120000,
    status: "pending",
  },
];

const MOCK_WORKFLOW_STATE: WorkflowState = {
  workflowId: "workflow-demo-1",
  status: "running",
  tasks: MOCK_WORKFLOW_TASKS,
  parallelExecution: false,
  createdAt: Date.now() - 120000,
  startedAt: Date.now() - 60000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Demo Component
// ─────────────────────────────────────────────────────────────────────────────

export function AgentWorkflowCanvasDemo() {
  const { initWorkflowOrchestration, setActiveAgents, updateNodeStatus } = useOrchestrationStore();

  // Initialize workflow on mount
  useEffect(() => {
    initWorkflowOrchestration(MOCK_WORKFLOW_STATE);
    setActiveAgents(["task-3"]); // Set task-3 as active

    // Simulate workflow progression
    const timer = setInterval(() => {
      // This would normally be driven by actual agent execution
      const currentRunning = MOCK_WORKFLOW_TASKS.find(t => t.status === "running");
      const nextPending = MOCK_WORKFLOW_TASKS.find(t => t.status === "pending");

      if (currentRunning && nextPending) {
        // Complete current task
        updateNodeStatus(currentRunning.taskId, "completed");
        // Start next task
        updateNodeStatus(nextPending.taskId, "running");
        setActiveAgents([nextPending.taskId]);
      }
    }, 10000); // Progress every 10 seconds

    return () => clearInterval(timer);
  }, [initWorkflowOrchestration, setActiveAgents, updateNodeStatus]);

  const handleNodeClick = (task: WorkflowTask) => {
    console.log("Task clicked:", task);
    // Could open a detail panel, trigger actions, etc.
  };

  const handleTaskComplete = (taskId: string) => {
    console.log("Task completed:", taskId);
    updateNodeStatus(taskId, "completed");

    // Find and start next task
    const nextTask = MOCK_WORKFLOW_TASKS.find(
      t => t.status === "pending" &&
      t.dependencies.every(dep => {
        const depTask = MOCK_WORKFLOW_TASKS.find(dt => dt.taskId === dep);
        return depTask?.status === "completed";
      })
    );

    if (nextTask) {
      updateNodeStatus(nextTask.taskId, "running");
      setActiveAgents([nextTask.taskId]);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-900">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900/95 border-b border-slate-800">
          <h1 className="text-lg font-semibold text-slate-100">
            Workflow Orchestration Demo
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Sequential task execution with live progress tracking
          </p>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <AgentWorkflowCanvas
            onNodeClick={handleNodeClick}
            onTaskComplete={handleTaskComplete}
          />
        </div>
      </div>
    </div>
  );
}