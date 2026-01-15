# AgentSwarmCanvas Component

A React Flow-based visualization component for Strands Swarm orchestration with dynamic handoff-based execution.

## Features

- **3-Column Grid Layout**: Automatic positioning with 120px horizontal and 150px vertical spacing
- **Dynamic Handoff Edges**: Animated particle effects along active handoff paths
- **Multiple Active Agents**: Support for simultaneous agent execution
- **Entry Point Indicators**: Visual badges for swarm entry points
- **Handoff History Panel**: Collapsible bottom panel showing handoff trace
- **Real-time Streaming**: Integration with orchestrationStore for live updates

## Installation

The component is already included in the project. Required dependencies:

```json
{
  "@xyflow/react": "^12.10.0",
  "framer-motion": "^11.0.0",
  "zustand": "^4.5.0"
}
```

## Usage

### Basic Usage with OrchestrationStore

```tsx
import { ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AgentSwarmCanvas } from "@/components/ai-elements/agent-swarm-canvas";

function MySwarmVisualization() {
  return (
    <div className="h-screen w-full">
      <ReactFlow>
        <AgentSwarmCanvas
          onNodeClick={(node) => console.log("Node clicked:", node)}
          onHandoffClick={(handoff) => console.log("Handoff clicked:", handoff)}
        />
      </ReactFlow>
    </div>
  );
}
```

### Initializing Swarm State

```tsx
import { useOrchestrationStore } from "@/stores/orchestrationStore";
import type { SwarmState } from "@/components/ai-elements/strands-orchestration/types";

function initializeSwarm() {
  const { initSwarmOrchestration, setActiveAgents } = useOrchestrationStore();

  const swarmState: SwarmState = {
    id: "swarm-001",
    status: "running",
    currentNode: "agent-1",
    nodes: [
      {
        id: "agent-1",
        type: "swarm-node",
        position: { x: 0, y: 0 }, // Auto-positioned
        data: {
          type: "swarm-node",
          isEntryPoint: true,
          agent: {
            id: "agent-1",
            name: "Research Agent",
            description: "Gathers information",
            modelProvider: "anthropic",
            tools: ["web_search"],
          },
          status: "running",
          canHandoffTo: ["agent-2", "agent-3"],
        },
      },
      // ... more nodes
    ],
    edges: [
      {
        id: "e1-2",
        source: "agent-1",
        target: "agent-2",
        type: "handoff-edge",
        data: {
          type: "swarm-edge",
          isActive: true,
          isAnimated: true,
          handoffMessage: "Research complete",
        },
      },
      // ... more edges
    ],
    handoffs: [],
    sharedContext: {},
    maxHandoffs: 10,
    handoffCount: 0,
    nodeHistory: [],
  };

  initSwarmOrchestration(swarmState);
  setActiveAgents(["agent-1"]);
}
```

### Dynamic Handoffs

```tsx
import { useOrchestrationStore } from "@/stores/orchestrationStore";

function performHandoff() {
  const { addHandoff, setActiveAgents, updateNodeStatus } = useOrchestrationStore();

  // Add handoff to history
  addHandoff({
    fromAgent: "Research Agent",
    toAgent: "Analysis Agent",
    message: "Research complete. Found 5 sources.",
    context: { sources: 5 },
    timestamp: Date.now(),
  });

  // Update active agents
  setActiveAgents(["agent-2"]);

  // Update node statuses
  updateNodeStatus("agent-1", "completed");
  updateNodeStatus("agent-2", "running");
}
```

## Component Structure

### Main Components

1. **AgentSwarmCanvas** (`index.tsx`)
   - Main container component
   - Manages React Flow instance
   - Handles node/edge synchronization with store
   - Renders controls, minimap, and status panel

2. **HandoffEdge** (`handoff-edge.tsx`)
   - Custom edge component with particle animation
   - Dynamic path calculation based on node positions
   - Animated particles for active handoffs
   - Message labels on edges

3. **HandoffHistory** (`handoff-history.tsx`)
   - Collapsible bottom panel
   - Scrollable handoff trace
   - Timestamps and relative timing
   - Context variable display

4. **EntryBadge** (`entry-badge.tsx`)
   - Overlay badge for entry point nodes
   - Pulse animation effect
   - Auto-positioned above nodes

## Styling

The component uses:
- Dark theme with glass effects
- Purple (`#8b5cf6`) for active/streaming agents
- Blue (`#0ea5e9`) for secondary active agents
- Smooth 300ms transitions
- Custom scrollbar styling for history panel

## Store Integration

The component integrates with `orchestrationStore` for:

- **swarmState**: Complete swarm configuration
- **swarmNodes**: Node definitions with agents
- **swarmEdges**: Edge connections between nodes
- **swarmHandoffs**: Handoff history messages
- **activeAgentIds**: Currently active agents (can be multiple)
- **agentStreamingData**: Real-time streaming data per agent

## Props

### AgentSwarmCanvas Props

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string?` | Additional CSS classes |
| `onNodeClick` | `(node: StrandsSwarmNode) => void` | Node click handler |
| `onHandoffClick` | `(handoff: HandoffMessage) => void` | Handoff click handler |

## Performance Considerations

- Nodes are memoized to prevent unnecessary re-renders
- Grid layout calculation happens once on mount
- Streaming data updates are throttled through store
- Particle animations use CSS animations for GPU acceleration
- History panel virtualizes long handoff lists

## Accessibility

- Keyboard navigation support through React Flow
- ARIA labels on controls and panels
- Focus management for expanded/collapsed states
- Color contrast meets WCAG AA standards

## Example

See `example.tsx` for a complete working example with:
- Sample swarm configuration
- Dynamic handoff simulation
- Store integration
- Event handlers

## License

Part of the Ron Browser AI Elements component library.