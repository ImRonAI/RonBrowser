/**
 * AgentGraphCanvas Example
 *
 * Demonstrates how to use the AgentGraphCanvas component with
 * orchestrationStore integration for visualizing agent dependencies.
 */

"use client";

import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { AgentGraphCanvas } from "./AgentGraphCanvas";
import { useOrchestrationStore } from "@/stores/orchestrationStore";
import type {
  GraphState,
  StrandsGraphNode,
  StrandsGraphEdge,
  OrchestrationEvent,
} from "@/components/ai-elements/strands-orchestration/types";

/**
 * Example graph data - Research Agent Network
 */
const EXAMPLE_GRAPH: GraphState = {
  id: "research-network-001",
  status: "created",
  nodes: [
    {
      id: "query-analyzer",
      type: "graph-node",
      position: { x: 0, y: 0 },
      data: {
        type: "graph-node",
        agent: {
          id: "query-analyzer",
          name: "Query Analyzer",
          description: "Analyzes user queries and extracts key topics",
          modelProvider: "anthropic",
          modelId: "claude-3-sonnet",
          tools: ["extract-keywords", "identify-intent"],
          priority: 5,
        },
        status: "idle",
        dependencies: [],
      },
    },
    {
      id: "web-researcher",
      type: "graph-node",
      position: { x: -200, y: 200 },
      data: {
        type: "graph-node",
        agent: {
          id: "web-researcher",
          name: "Web Researcher",
          description: "Searches and scrapes web content",
          modelProvider: "openai",
          modelId: "gpt-4-turbo",
          tools: ["web-search", "scrape-url", "extract-content"],
          priority: 4,
        },
        status: "idle",
        dependencies: ["query-analyzer"],
      },
    },
    {
      id: "academic-researcher",
      type: "graph-node",
      position: { x: 0, y: 200 },
      data: {
        type: "graph-node",
        agent: {
          id: "academic-researcher",
          name: "Academic Researcher",
          description: "Searches academic papers and journals",
          modelProvider: "anthropic",
          modelId: "claude-3-opus",
          tools: ["arxiv-search", "scholar-search", "paper-analysis"],
          priority: 4,
        },
        status: "idle",
        dependencies: ["query-analyzer"],
      },
    },
    {
      id: "code-researcher",
      type: "graph-node",
      position: { x: 200, y: 200 },
      data: {
        type: "graph-node",
        agent: {
          id: "code-researcher",
          name: "Code Researcher",
          description: "Analyzes code repositories and documentation",
          modelProvider: "github",
          modelId: "copilot-gpt4",
          tools: ["github-search", "code-analysis", "doc-extraction"],
          priority: 3,
        },
        status: "idle",
        dependencies: ["query-analyzer"],
      },
    },
    {
      id: "fact-checker",
      type: "graph-node",
      position: { x: -100, y: 400 },
      data: {
        type: "graph-node",
        agent: {
          id: "fact-checker",
          name: "Fact Checker",
          description: "Verifies and cross-references information",
          modelProvider: "anthropic",
          modelId: "claude-3-sonnet",
          tools: ["verify-claim", "cross-reference", "confidence-score"],
          priority: 3,
        },
        status: "idle",
        dependencies: ["web-researcher", "academic-researcher"],
      },
    },
    {
      id: "synthesizer",
      type: "graph-node",
      position: { x: 100, y: 400 },
      data: {
        type: "graph-node",
        agent: {
          id: "synthesizer",
          name: "Synthesizer",
          description: "Combines and synthesizes research findings",
          modelProvider: "anthropic",
          modelId: "claude-3-opus",
          tools: ["combine-sources", "generate-summary", "create-outline"],
          priority: 2,
        },
        status: "idle",
        dependencies: ["web-researcher", "academic-researcher", "code-researcher"],
      },
    },
    {
      id: "report-generator",
      type: "graph-node",
      position: { x: 0, y: 600 },
      data: {
        type: "graph-node",
        agent: {
          id: "report-generator",
          name: "Report Generator",
          description: "Generates final research report",
          modelProvider: "anthropic",
          modelId: "claude-3-opus",
          tools: ["format-markdown", "generate-citations", "create-visualizations"],
          priority: 1,
        },
        status: "idle",
        dependencies: ["fact-checker", "synthesizer"],
      },
    },
  ] as StrandsGraphNode[],
  edges: [
    {
      id: "e1",
      source: "query-analyzer",
      target: "web-researcher",
      type: "graph-edge",
      data: {
        type: "graph-edge",
        isConditional: false,
        isActive: false,
      },
    },
    {
      id: "e2",
      source: "query-analyzer",
      target: "academic-researcher",
      type: "graph-edge",
      data: {
        type: "graph-edge",
        isConditional: false,
        isActive: false,
      },
    },
    {
      id: "e3",
      source: "query-analyzer",
      target: "code-researcher",
      type: "graph-edge",
      data: {
        type: "graph-edge",
        isConditional: true,
        isActive: false,
        condition: {
          id: "c1",
          label: "Has Code",
          expression: "query.contains('code') || query.contains('implementation')",
        },
      },
    },
    {
      id: "e4",
      source: "web-researcher",
      target: "fact-checker",
      type: "graph-edge",
      data: {
        type: "graph-edge",
        isConditional: false,
        isActive: false,
      },
    },
    {
      id: "e5",
      source: "academic-researcher",
      target: "fact-checker",
      type: "graph-edge",
      data: {
        type: "graph-edge",
        isConditional: false,
        isActive: false,
      },
    },
    {
      id: "e6",
      source: "web-researcher",
      target: "synthesizer",
      type: "graph-edge",
      data: {
        type: "graph-edge",
        isConditional: false,
        isActive: false,
      },
    },
    {
      id: "e7",
      source: "academic-researcher",
      target: "synthesizer",
      type: "graph-edge",
      data: {
        type: "graph-edge",
        isConditional: false,
        isActive: false,
      },
    },
    {
      id: "e8",
      source: "code-researcher",
      target: "synthesizer",
      type: "graph-edge",
      data: {
        type: "graph-edge",
        isConditional: true,
        isActive: false,
        condition: {
          id: "c2",
          label: "Code Found",
          expression: "results.length > 0",
        },
      },
    },
    {
      id: "e9",
      source: "fact-checker",
      target: "report-generator",
      type: "graph-edge",
      data: {
        type: "graph-edge",
        isConditional: false,
        isActive: false,
      },
    },
    {
      id: "e10",
      source: "synthesizer",
      target: "report-generator",
      type: "graph-edge",
      data: {
        type: "graph-edge",
        isConditional: false,
        isActive: false,
      },
    },
  ] as StrandsGraphEdge[],
  completedNodes: [],
  failedNodes: [],
  executionOrder: [],
};

/**
 * Example Component
 */
export function AgentGraphCanvasExample() {
  const { initGraphOrchestration, setActiveAgents, syncStreamingData } = useOrchestrationStore();

  // Initialize the graph on mount
  useEffect(() => {
    initGraphOrchestration(EXAMPLE_GRAPH);

    // Simulate some streaming data after a delay
    setTimeout(() => {
      setActiveAgents(["query-analyzer"]);
      syncStreamingData("query-analyzer", {
        reasoning: {
          content: "Analyzing user query to extract key topics and identify research domains...",
          duration: 1500,
        },
        chainOfThought: [
          {
            label: "Thinking",
            description: "Identifying main topics in the query",
            status: 'running' as const,
            duration: 1000,
          },
          {
            label: "Decision",
            description: "Determined need for web and academic research",
            status: 'success' as const,
            duration: 500,
          },
        ],
      });
    }, 2000);

    // Simulate more activity
    setTimeout(() => {
      setActiveAgents(["web-researcher", "academic-researcher"]);
      syncStreamingData("web-researcher", {
        reasoning: {
          content: "Searching web for relevant articles and resources...",
        },
        tools: [
          {
            id: "tool-1",
            name: "web-search",
            input: { query: "AI agent orchestration patterns" },
            status: "running",
          },
        ],
      });
    }, 4000);

    // Cleanup on unmount
    return () => {
      useOrchestrationStore.getState().reset();
    };
  }, [initGraphOrchestration, setActiveAgents, syncStreamingData]);

  const handleNodeClick = (node: StrandsGraphNode) => {
    console.log("Node clicked:", node);
  };

  const handleEdgeClick = (edge: StrandsGraphEdge) => {
    console.log("Edge clicked:", edge);
  };

  const handleExecutionEvent = (event: OrchestrationEvent) => {
    console.log("Execution event:", event);
  };

  return (
    <div className="w-full h-screen bg-slate-950">
      <ReactFlowProvider>
        <AgentGraphCanvas
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onExecutionEvent={handleExecutionEvent}
          showStats={true}
          showControls={true}
          showTimeline={true}
          showMiniMap={false}
          autoFit={true}
        />
      </ReactFlowProvider>
    </div>
  );
}

/**
 * Standalone example with provider wrapper
 */
export default function AgentGraphCanvasDemo() {
  return <AgentGraphCanvasExample />;
}