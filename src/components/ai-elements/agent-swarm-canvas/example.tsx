/**
 * AgentSwarmCanvas Example
 *
 * Demonstrates how to use the AgentSwarmCanvas component with the orchestrationStore.
 * Shows a complete swarm orchestration setup with multiple agents and handoffs.
 */

import { useEffect } from "react";
import { ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AgentSwarmCanvas } from "./index";
import { useOrchestrationStore } from "@/stores/orchestrationStore";
import { SwarmNodeComponent } from "@/components/ai-elements/agent-orchestration-node";
import { HandoffEdge } from "./handoff-edge";
import type {
  SwarmState,
  StrandsSwarmNode,
  StrandsSwarmEdge,
  HandoffMessage,
} from "@/components/ai-elements/strands-orchestration/types";

// ─────────────────────────────────────────────────────────────────────────────
// Example Swarm Configuration
// ─────────────────────────────────────────────────────────────────────────────

const EXAMPLE_SWARM_STATE: SwarmState = {
  id: "swarm-example-001",
  status: "running",
  currentNode: "agent-2",
  maxHandoffs: 10,
  handoffCount: 3,
  sharedContext: {},
  nodeHistory: ["agent-1", "agent-2", "agent-3", "agent-2"],
  startedAt: Date.now() - 5000,

  nodes: [
    {
      id: "agent-1",
      type: "swarm-node",
      position: { x: 0, y: 0 }, // Will be auto-positioned by grid layout
      data: {
        type: "swarm-node",
        isEntryPoint: true,
        agent: {
          id: "agent-1",
          name: "Research Agent",
          description: "Gathers information and context",
          modelProvider: "anthropic",
          modelId: "claude-3-opus",
          tools: ["web_search", "document_reader", "summarize"],
          priority: 5,
        },
        status: "completed",
        canHandoffTo: ["agent-2", "agent-3"],
        result: {
          status: "success",
          content: "Research completed. Found 5 relevant sources.",
        },
      },
    },
    {
      id: "agent-2",
      type: "swarm-node",
      position: { x: 0, y: 0 },
      data: {
        type: "swarm-node",
        agent: {
          id: "agent-2",
          name: "Analysis Agent",
          description: "Analyzes data and generates insights",
          modelProvider: "openai",
          modelId: "gpt-4-turbo",
          tools: ["data_analysis", "chart_generator", "statistics"],
          priority: 4,
        },
        status: "running",
        canHandoffTo: ["agent-3", "agent-4", "agent-5"],
      },
    },
    {
      id: "agent-3",
      type: "swarm-node",
      position: { x: 0, y: 0 },
      data: {
        type: "swarm-node",
        agent: {
          id: "agent-3",
          name: "Writing Agent",
          description: "Creates reports and documentation",
          modelProvider: "anthropic",
          modelId: "claude-3-sonnet",
          tools: ["document_writer", "format_markdown", "grammar_check"],
          priority: 3,
        },
        status: "completed",
        canHandoffTo: ["agent-2", "agent-4"],
        result: {
          status: "success",
          content: "Initial draft created.",
        },
      },
    },
    {
      id: "agent-4",
      type: "swarm-node",
      position: { x: 0, y: 0 },
      data: {
        type: "swarm-node",
        agent: {
          id: "agent-4",
          name: "Review Agent",
          description: "Reviews and validates outputs",
          modelProvider: "openai",
          modelId: "gpt-4",
          tools: ["fact_checker", "quality_scorer", "feedback_generator"],
          priority: 4,
        },
        status: "pending",
        canHandoffTo: ["agent-5", "agent-6"],
      },
    },
    {
      id: "agent-5",
      type: "swarm-node",
      position: { x: 0, y: 0 },
      data: {
        type: "swarm-node",
        agent: {
          id: "agent-5",
          name: "Delivery Agent",
          description: "Formats and delivers final output",
          modelProvider: "anthropic",
          modelId: "claude-3-haiku",
          tools: ["formatter", "email_sender", "notification"],
          priority: 2,
        },
        status: "idle",
        canHandoffTo: ["agent-6"],
      },
    },
    {
      id: "agent-6",
      type: "swarm-node",
      position: { x: 0, y: 0 },
      data: {
        type: "swarm-node",
        agent: {
          id: "agent-6",
          name: "Monitor Agent",
          description: "Monitors execution and handles errors",
          modelProvider: "bedrock",
          modelId: "amazon-titan",
          tools: ["error_handler", "alert_system", "retry_logic"],
          priority: 5,
        },
        status: "idle",
        canHandoffTo: ["agent-1"], // Can loop back to start
      },
    },
  ] as StrandsSwarmNode[],

  edges: [
    {
      id: "e1-2",
      source: "agent-1",
      target: "agent-2",
      type: "handoff-edge",
      data: {
        type: "swarm-edge",
        isActive: false,
        handoffMessage: "Research complete",
      },
    },
    {
      id: "e2-3",
      source: "agent-2",
      target: "agent-3",
      type: "handoff-edge",
      data: {
        type: "swarm-edge",
        isActive: false,
        handoffMessage: "Analysis ready",
      },
    },
    {
      id: "e3-2",
      source: "agent-3",
      target: "agent-2",
      type: "handoff-edge",
      data: {
        type: "swarm-edge",
        isActive: true,
        isAnimated: true,
        handoffMessage: "Need more data",
      },
    },
    {
      id: "e2-4",
      source: "agent-2",
      target: "agent-4",
      type: "handoff-edge",
      data: {
        type: "swarm-edge",
        isActive: false,
      },
    },
    {
      id: "e4-5",
      source: "agent-4",
      target: "agent-5",
      type: "handoff-edge",
      data: {
        type: "swarm-edge",
        isActive: false,
      },
    },
    {
      id: "e5-6",
      source: "agent-5",
      target: "agent-6",
      type: "handoff-edge",
      data: {
        type: "swarm-edge",
        isActive: false,
      },
    },
  ] as StrandsSwarmEdge[],

  handoffs: [
    {
      fromAgent: "Research Agent",
      toAgent: "Analysis Agent",
      message: "Research complete. Found 5 sources on AI orchestration patterns.",
      context: { sources: 5, quality: "high" },
      timestamp: Date.now() - 4000,
    },
    {
      fromAgent: "Analysis Agent",
      toAgent: "Writing Agent",
      message: "Initial analysis complete. Key insights identified.",
      context: { insights: 3, confidence: 0.85 },
      timestamp: Date.now() - 3000,
    },
    {
      fromAgent: "Writing Agent",
      toAgent: "Analysis Agent",
      message: "Draft created but need additional data points for conclusion.",
      context: { draft_status: "incomplete", missing: "statistical_evidence" },
      timestamp: Date.now() - 1000,
    },
  ] as HandoffMessage[],
};

// ─────────────────────────────────────────────────────────────────────────────
// Example Component
// ─────────────────────────────────────────────────────────────────────────────

export function AgentSwarmCanvasExample() {
  const { initSwarmOrchestration, setActiveAgents, addHandoff } = useOrchestrationStore();

  // Initialize swarm state on mount
  useEffect(() => {
    initSwarmOrchestration(EXAMPLE_SWARM_STATE);
    setActiveAgents(["agent-2"]); // Set Analysis Agent as active

    // Simulate dynamic handoffs
    const timer1 = setTimeout(() => {
      setActiveAgents(["agent-2", "agent-4"]);
      addHandoff({
        fromAgent: "Analysis Agent",
        toAgent: "Review Agent",
        message: "Additional analysis complete. Ready for review.",
        context: { completion: 100 },
        timestamp: Date.now(),
      });
    }, 5000);

    const timer2 = setTimeout(() => {
      setActiveAgents(["agent-4"]);
    }, 8000);

    const timer3 = setTimeout(() => {
      setActiveAgents(["agent-4", "agent-5"]);
      addHandoff({
        fromAgent: "Review Agent",
        toAgent: "Delivery Agent",
        message: "Review passed. Ready for delivery.",
        context: { approved: true },
        timestamp: Date.now(),
      });
    }, 12000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [initSwarmOrchestration, setActiveAgents, addHandoff]);

  const handleNodeClick = (node: StrandsSwarmNode) => {
    console.log("Node clicked:", node.data.agent.name);
  };

  const handleHandoffClick = (handoff: HandoffMessage) => {
    console.log("Handoff clicked:", handoff);
  };

  return (
    <div className="h-screen w-full bg-slate-950">
      <ReactFlow>
        <AgentSwarmCanvas
          onNodeClick={handleNodeClick}
          onHandoffClick={handleHandoffClick}
        />
      </ReactFlow>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone Usage Example (without store)
// ─────────────────────────────────────────────────────────────────────────────

export function AgentSwarmCanvasStandalone() {
  // You can also use the canvas without the store by manually managing state
  return (
    <div className="h-screen w-full bg-slate-950">
      <ReactFlow
        defaultNodes={EXAMPLE_SWARM_STATE.nodes}
        defaultEdges={EXAMPLE_SWARM_STATE.edges}
        nodeTypes={{ "swarm-node": SwarmNodeComponent }}
        edgeTypes={{ "handoff-edge": HandoffEdge }}
      >
        <AgentSwarmCanvas />
      </ReactFlow>
    </div>
  );
}