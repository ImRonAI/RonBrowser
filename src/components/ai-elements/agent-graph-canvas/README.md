# AgentGraphCanvas Component

A sophisticated React Flow-based canvas for visualizing Strands Graph orchestration with deterministic dependency-driven execution. This component provides a complete visualization solution for multi-agent systems with real-time streaming updates.

## Features

- **Dagre Hierarchical Layout**: Automatic top-to-bottom graph layout with configurable spacing
- **Real-time Streaming**: Purple glow animation for actively streaming agents
- **Interactive Controls**: Play/pause/step/reset simulation controls
- **Execution Timeline**: Chronological view of orchestration events
- **Stats Panel**: Live execution statistics and progress tracking
- **Custom Edges**: Conditional edges with visual indicators
- **Export Functionality**: Export graph state as JSON
- **Dark Theme**: Elegant dark theme with glass morphism effects

## Installation

The component requires the following dependencies:
```bash
npm install @xyflow/react dagre framer-motion
```

## Basic Usage

```tsx
import { ReactFlowProvider } from "@xyflow/react";
import { AgentGraphCanvas } from "@/components/ai-elements/agent-graph-canvas";
import { useOrchestrationStore } from "@/stores/orchestrationStore";

function MyOrchestrationView() {
  const { initGraphOrchestration } = useOrchestrationStore();

  useEffect(() => {
    // Initialize with your graph state
    initGraphOrchestration({
      id: "my-graph",
      status: "created",
      nodes: [...],
      edges: [...],
      completedNodes: [],
      failedNodes: [],
      executionOrder: [],
    });
  }, []);

  return (
    <ReactFlowProvider>
      <AgentGraphCanvas
        showStats={true}
        showControls={true}
        showTimeline={true}
        autoFit={true}
      />
    </ReactFlowProvider>
  );
}
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `onNodeClick` | `(node: StrandsGraphNode) => void` | - | Node click handler |
| `onEdgeClick` | `(edge: StrandsGraphEdge) => void` | - | Edge click handler |
| `onExecutionEvent` | `(event: OrchestrationEvent) => void` | - | Execution event handler |
| `showStats` | `boolean` | `true` | Show statistics panel |
| `showControls` | `boolean` | `true` | Show control buttons |
| `showTimeline` | `boolean` | `true` | Show execution timeline |
| `showMiniMap` | `boolean` | `false` | Show minimap |
| `autoFit` | `boolean` | `true` | Auto-fit view on load |

## Integration with OrchestrationStore

The component automatically syncs with the `orchestrationStore` for:

1. **Graph State**: Nodes, edges, and execution status
2. **Active Agents**: Agents currently executing (purple glow)
3. **Streaming Data**: Real-time updates from agent execution

### Store Methods

```tsx
// Initialize graph
initGraphOrchestration(graphState);

// Update node status
updateNodeStatus(nodeId, "running");

// Set active agents (for purple glow)
setActiveAgents(["agent-1", "agent-2"]);

// Sync streaming data
syncStreamingData("agent-1", {
  reasoning: { content: "Thinking...", duration: 1000 },
  chainOfThought: [...],
  tools: [...],
  images: [...],
});
```

## Sub-Components

### GraphStats
Displays execution statistics including:
- Total nodes
- Active agents
- Completed/pending/failed counts
- Progress bar
- Elapsed time

### GraphControls
Playback controls for simulation:
- Play/Pause
- Step forward
- Reset

### Timeline
Chronological event viewer showing:
- Node starts/completions
- Edge activations
- Errors
- Handoffs

### GraphEdge
Custom edge with:
- Conditional styling (dashed amber)
- Active state (purple animation)
- Condition labels

## Layout Configuration

The component uses Dagre for automatic layout with these defaults:

```tsx
{
  direction: "TB",      // Top to bottom
  nodesep: 80,         // Node separation
  ranksep: 100,        // Rank separation
  nodeWidth: 280,      // Node width
  nodeHeight: 150,     // Node height
}
```

## Styling

The component uses:
- Dark theme (slate-950 background)
- Glass morphism effects
- Purple accent for active states
- Tailwind CSS utilities

### Color Scheme
- **Background**: `slate-950`
- **Panels**: `slate-900/90` with backdrop blur
- **Active**: `violet-500` (purple glow)
- **Conditional**: `amber-500`
- **Success**: `emerald-500`
- **Error**: `rose-500`

## Animation

All animations use Framer Motion with:
- Spring physics for node appearances
- Smooth transitions (400ms) for layout changes
- Pulse animation for active agents
- Flow animation for active edges

## Example Graph Structure

```tsx
const graphState: GraphState = {
  id: "example-graph",
  status: "created",
  nodes: [
    {
      id: "agent-1",
      type: "graph-node",
      position: { x: 0, y: 0 },
      data: {
        type: "graph-node",
        agent: {
          id: "agent-1",
          name: "Query Analyzer",
          description: "Analyzes user queries",
          modelProvider: "anthropic",
          tools: ["extract-keywords"],
          priority: 5,
        },
        status: "idle",
        dependencies: [],
      },
    },
  ],
  edges: [
    {
      id: "edge-1",
      source: "agent-1",
      target: "agent-2",
      type: "graph-edge",
      data: {
        type: "graph-edge",
        isConditional: false,
        isActive: false,
      },
    },
  ],
  completedNodes: [],
  failedNodes: [],
  executionOrder: [],
};
```

## Performance Considerations

- Uses React.memo for component optimization
- Implements virtualization for large graphs
- Debounced layout recalculation
- Selective re-rendering based on store changes

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT