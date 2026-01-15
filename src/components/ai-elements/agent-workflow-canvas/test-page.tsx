/**
 * Test Page for AgentWorkflowCanvas
 *
 * Simple test page to verify the workflow canvas renders correctly.
 * Place this in your pages folder to test the component.
 */

"use client";

import { useEffect } from "react";
import { AgentWorkflowCanvas } from "./index";
import { useOrchestrationStore } from "@/stores/orchestrationStore";
import type { WorkflowState } from "@/components/ai-elements/strands-orchestration/types";

export default function WorkflowCanvasTestPage() {
  const { initWorkflowOrchestration, setActiveAgents } = useOrchestrationStore();

  useEffect(() => {
    // Initialize with simple test data
    const testWorkflow: WorkflowState = {
      workflowId: "test-workflow",
      status: "running",
      tasks: [
        {
          taskId: "step-1",
          description: "Step 1: Initialize",
          dependencies: [],
          status: "completed",
        },
        {
          taskId: "step-2",
          description: "Step 2: Process",
          dependencies: ["step-1"],
          status: "running",
        },
        {
          taskId: "step-3",
          description: "Step 3: Finalize",
          dependencies: ["step-2"],
          status: "pending",
        },
      ],
      parallelExecution: false,
      createdAt: Date.now(),
      startedAt: Date.now(),
    };

    initWorkflowOrchestration(testWorkflow);
    setActiveAgents(["step-2"]);
  }, [initWorkflowOrchestration, setActiveAgents]);

  return (
    <div className="w-full h-screen bg-slate-900">
      <AgentWorkflowCanvas />
    </div>
  );
}