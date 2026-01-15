# Product Requirements Document: AgentSwarmCanvas

## Executive Summary

The `AgentSwarmCanvas` component visualizes the Strands Swarm orchestration pattern - a dynamic, autonomous multi-agent collaboration system with agent-to-agent handoffs and shared context. Unlike the deterministic Graph pattern, Swarm agents self-organize and autonomously decide when and to whom to hand off control.

## Core Objectives

1. **Visualize Dynamic Handoffs**: Show real-time agent-to-agent control transfers
2. **Display Multiple Active Agents**: Support simultaneous agent activity visualization
3. **Track Handoff History**: Maintain visual trace of execution path
4. **Show Shared Context**: Visualize accumulated knowledge across agents
5. **Provide Execution Controls**: Enable play, pause, manual handoff triggering

## Architecture Overview

### Component Structure
```
AgentSwarmCanvas
├── ReactFlow Canvas (main visualization area)
│   ├── SwarmNodeComponent nodes (using AgentOrchestrationNode)
│   ├── Dynamic handoff edges (created on-the-fly)
│   └── Background grid
├── Handoff History Panel (sidebar or bottom)
├── Swarm Stats Panel (top-left)
├── Swarm Controls (top-right)
└── Shared Context Viewer (expandable panel)
```

## 1. Layout Algorithm

### Grid Layout System

**Configuration:**
- **Grid Structure**: 3 columns, auto-wrapping rows
- **Node Spacing**:
  - Horizontal gap: 120px between node centers
  - Vertical gap: 150px between rows
- **Canvas Padding**: 60px from all edges
- **Node Dimensions**: 280px width (fixed by AgentOrchestrationNode)

**Positioning Algorithm:**
```typescript
function calculateNodePosition(index: number, isEntryPoint: boolean): { x: number, y: number } {
  const COLS = 3;
  const NODE_WIDTH = 280;
  const H_GAP = 120;
  const V_GAP = 150;
  const PADDING = 60;

  if (isEntryPoint) {
    // Entry point: top-center position
    return {
      x: PADDING + (COLS * (NODE_WIDTH + H_GAP)) / 2 - NODE_WIDTH / 2,
      y: PADDING
    };
  }

  // Regular agents: grid layout starting from second row
  const adjustedIndex = index - 1; // Account for entry point
  const col = adjustedIndex % COLS;
  const row = Math.floor(adjustedIndex / COLS) + 1; // Start from row 1

  return {
    x: PADDING + col * (NODE_WIDTH + H_GAP),
    y: PADDING + row * V_GAP
  };
}
```

**Dynamic Agent Addition:**
- New agents append to grid
- Maintain 3-column structure
- Auto-expand canvas height as needed
- Smooth animation when agents are added (scale + fade in)

## 2. Visual Representation

### Node Visualization

**Using `AgentOrchestrationNode` with SwarmNodeComponent wrapper:**

```typescript
interface SwarmNodeVisualization {
  // Core properties
  agent: AgentConfig;
  status: AgentStatus; // Including "handoff" status

  // Swarm-specific indicators
  isEntryPoint?: boolean;      // Purple "ENTRY" badge at top
  canHandoffTo?: string[];      // List of potential handoff targets
  isActivelyStreaming?: boolean; // Purple glow when streaming

  // Visual states
  isCurrentlyActive: boolean;   // Bright purple border glow
  isInHandoffState: boolean;    // Violet handoff icon visible
  hasCompletedWork: boolean;    // Dimmed appearance
}
```

**Visual States:**
1. **Entry Point**: Purple "ENTRY" badge above node
2. **Currently Active**: Purple pulsing glow (`shadow-[0_0_32px_-4px_rgba(139,92,246,0.5)]`)
3. **Handoff State**: Violet color scheme with handoff arrow icon
4. **Completed**: Emerald checkmark, reduced opacity (0.8)
5. **Idle/Waiting**: Default slate colors, no glow

### Multiple Active Agents

**Simultaneous Activity Visualization:**
- Multiple nodes can have purple glow simultaneously
- Different glow intensities:
  - Primary active: Strong purple glow + "LIVE" badge
  - Secondary active: Medium purple glow
  - Recently active: Fading purple glow (animate out over 1s)

```typescript
function getNodeGlowClass(nodeId: string, activeAgents: string[]): string {
  const index = activeAgents.indexOf(nodeId);
  if (index === -1) return '';

  if (index === 0) {
    // Primary active agent
    return 'shadow-[0_0_32px_-4px_rgba(139,92,246,0.6)] animate-pulse-glow';
  } else if (index < 3) {
    // Secondary active agents
    return 'shadow-[0_0_24px_-4px_rgba(139,92,246,0.4)]';
  } else {
    // Tertiary active agents
    return 'shadow-[0_0_16px_-4px_rgba(139,92,246,0.3)]';
  }
}
```

## 3. State Visualization

### Handoff History Trace Panel

**Position:** Bottom of canvas (collapsible) or right sidebar

**Layout:**
```
┌─────────────────────────────────────────────┐
│ 🔄 HANDOFF HISTORY (12 handoffs / max 20)   │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ researcher → analyst                     │ │
│ │ "Gathered initial market data..."       │ │
│ │ 10:23:45 AM                             │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ analyst → creative_agent                 │ │
│ │ "Analysis complete, need creative..."    │ │
│ │ 10:24:12 AM                             │ │
│ └─────────────────────────────────────────┘ │
│ [Scrollable area for more handoffs...]      │
└─────────────────────────────────────────────┘
```

**Handoff Entry Structure:**
```typescript
interface HandoffEntryDisplay {
  fromAgent: string;        // Source agent name
  toAgent: string;          // Target agent name
  message: string;          // Truncated to 100 chars
  timestamp: string;        // Formatted time
  sequenceNumber: number;   // Handoff #1, #2, etc.
  isRecent: boolean;       // Highlight if < 5 seconds old
}
```

**Visual Treatment:**
- Recent handoffs: Violet background with fade animation
- Arrow indicator between agent names
- Timestamp in muted text
- Auto-scroll to latest handoff
- Expandable to see full message

### Swarm Statistics Panel

**Position:** Top-left corner

```typescript
interface SwarmStatsDisplay {
  status: "running" | "completed" | "max_handoffs" | "error";
  handoffCount: number;
  maxHandoffs: number;
  activeAgentCount: number;
  totalAgents: number;
  elapsedTime: string;
  sharedContextSize: number; // Number of context entries
}
```

**Visual Layout:**
```
┌──────────────────────────┐
│ ● Running                │
│ ━━━━━━━━━━━━━━━━━━━━━━━ │ (progress bar)
│ 12/20 Handoffs          │
│ 3 Active | 7 Total       │
│ 02:34 Elapsed           │
│ 15 Context Items        │
└──────────────────────────┘
```

### Shared Context Viewer

**Position:** Expandable panel (click to open)

**Display Format:**
```typescript
interface ContextDisplay {
  [agentName: string]: {
    contributions: Array<{
      key: string;
      value: any;
      timestamp: number;
    }>;
    lastActive: number;
  };
}
```

## 4. Edge Types

### Dynamic Handoff Edges

**Edge Creation:**
- Created dynamically when handoff occurs
- Temporary edges that fade after display
- Multiple simultaneous edges possible

```typescript
interface HandoffEdge {
  id: `handoff-${number}`;
  source: string;          // From agent node ID
  target: string;          // To agent node ID
  type: 'swarm-handoff';
  data: {
    message: string;       // Handoff message
    timestamp: number;
    isActive: boolean;     // Currently animating
    fadeDelay: number;     // MS before fade starts (default: 3000)
    fadeDuration: number;  // MS for fade animation (default: 1000)
  };
}
```

**Visual Characteristics:**
- **Color**: Violet (`stroke: rgb(139, 92, 246)`)
- **Width**: 2px default, 3px when active
- **Animation**: Particle flow along edge path
- **Arrow**: Animated arrowhead at target
- **Label**: Handoff message (truncated to 50 chars)
- **Lifecycle**:
  1. Appear with scale animation (0.3s)
  2. Show particle flow (3s)
  3. Fade out (1s)
  4. Remove from DOM

### Handoff Capability Indicators

**Static edges showing potential handoffs:**
- Dotted lines between agents that can handoff
- Very low opacity (0.1)
- Become solid on hover
- Violet color when agent is selected

```typescript
interface CapabilityEdge {
  id: `capability-${source}-${target}`;
  source: string;
  target: string;
  type: 'swarm-capability';
  data: {
    isHovered: boolean;
    isPotential: boolean; // From canHandoffTo array
  };
}
```

### Handoff Trace Visualization

**Historical path overlay:**
- Shows breadcrumb trail of past handoffs
- Decreasing opacity for older handoffs
- Last 5 handoffs visible as fading edges

```typescript
interface TraceEdge {
  id: `trace-${number}`;
  source: string;
  target: string;
  type: 'swarm-trace';
  data: {
    sequenceNumber: number;  // Order in handoff history
    age: number;             // How many handoffs ago
    opacity: number;         // Calculated from age
  };
}
```

## 5. Controls

### Swarm Execution Controls

**Position:** Top-right corner

**Control Set:**
```typescript
interface SwarmControls {
  // Execution controls
  onPlay: () => void;        // Start swarm execution
  onPause: () => void;       // Pause execution
  onReset: () => void;       // Reset to initial state

  // Manual interventions
  onTriggerHandoff: (from: string, to: string) => void;
  onSelectActiveAgent: (agentId: string) => void;

  // View controls
  onToggleHistory: () => void;
  onToggleContext: () => void;
  onToggleTrace: () => void;
}
```

**Visual Design:**
```
┌────────────────────────────────────┐
│ [▶] [⏸] [↻] | [🔀] [👁] [📜]     │
└────────────────────────────────────┘
```

**Control Actions:**
1. **Play**: Start/resume swarm execution
2. **Pause**: Pause at current state
3. **Reset**: Clear all state, return to initial
4. **Trigger Handoff**: Opens agent selector modal
5. **Toggle Visibility**: History/Context/Trace panels
6. **View Mode**: Switch between layouts

### Manual Handoff Trigger

**Modal Interface:**
```typescript
interface HandoffModal {
  currentAgent: string;
  availableTargets: string[]; // From canHandoffTo
  onConfirm: (target: string, message: string) => void;
}
```

**Modal Layout:**
```
┌─────────────────────────────────┐
│ Trigger Manual Handoff          │
├─────────────────────────────────┤
│ From: researcher                │
│ To: [Select Agent ▼]           │
│ Message:                        │
│ [____________________________] │
│                                 │
│ [Cancel] [Trigger Handoff]     │
└─────────────────────────────────┘
```

## 6. Integration Points

### orchestrationStore Integration

**Reading State:**
```typescript
// From orchestrationStore
const swarmState = useOrchestrationStore(state => state.swarmState);
const swarmNodes = useOrchestrationStore(state => state.swarmNodes);
const swarmEdges = useOrchestrationStore(state => state.swarmEdges);
const swarmHandoffs = useOrchestrationStore(state => state.swarmHandoffs);
const activeAgentIds = useOrchestrationStore(state => state.activeAgentIds);
const streamingData = useOrchestrationStore(state => state.agentStreamingData);
```

**Updating State:**
```typescript
// Actions to call
const {
  updateNodeStatus,
  setActiveAgents,
  addHandoff,
  syncStreamingData
} = useOrchestrationStore();

// Example: Handle handoff event
function handleHandoff(handoff: HandoffMessage) {
  // Update store
  addHandoff(handoff);

  // Update active agents
  setActiveAgents([handoff.toAgent]);

  // Update node statuses
  updateNodeStatus(handoff.fromAgent, 'completed');
  updateNodeStatus(handoff.toAgent, 'running');

  // Create temporary edge for visualization
  createHandoffEdge(handoff);
}
```

### Real-time Updates

**Streaming Data Sync:**
```typescript
// Subscribe to streaming updates
useEffect(() => {
  // For each active agent, check streaming data
  activeAgentIds.forEach(agentId => {
    const data = streamingData.get(agentId);
    if (data) {
      // Update node with streaming visualization
      updateNodeStreamingState(agentId, data);
    }
  });
}, [activeAgentIds, streamingData]);
```

### Shared Context Management

```typescript
interface SharedContextSync {
  // Read shared context from swarmState
  getAgentContext: (agentId: string) => Record<string, unknown>;

  // Update when agent contributes
  updateAgentContext: (agentId: string, contribution: Record<string, unknown>) => void;

  // Display in context viewer
  formatContextForDisplay: (context: SharedContext) => ContextDisplay;
}
```

## 7. Animation & Transitions

### Node Animations
- **Entry**: Scale from 0.9 to 1, fade in (0.3s)
- **Activation**: Purple glow pulse (2s cycle)
- **Handoff**: Violet flash (0.5s)
- **Completion**: Fade to 0.8 opacity (0.5s)

### Edge Animations
- **Handoff Edge**: Particle flow animation
- **Trace Fade**: Opacity transition (1s)
- **Capability Hover**: Opacity 0.1 to 0.5 (0.2s)

### Panel Animations
- **History Entry**: Slide in from right (0.3s)
- **Stats Update**: Number counter animation
- **Context Expand**: Height auto with spring

## 8. Performance Considerations

### Optimization Strategies

1. **Edge Lifecycle Management**:
   - Remove edges from DOM after fade
   - Limit trace edges to last 5 handoffs
   - Batch edge updates

2. **Node Rendering**:
   - Memoize AgentOrchestrationNode components
   - Use React.memo for static agents
   - Virtualize if > 20 agents

3. **History Panel**:
   - Virtualize list if > 50 handoffs
   - Lazy load full messages
   - Paginate old handoffs

4. **Streaming Updates**:
   - Debounce rapid updates (100ms)
   - Batch state changes
   - Use requestAnimationFrame for animations

## 9. Accessibility

### Keyboard Navigation
- Tab: Navigate between agents
- Enter: Expand agent details
- Space: Toggle agent selection
- Arrows: Navigate grid layout

### Screen Reader Support
- ARIA labels for all controls
- Handoff announcements
- Status change notifications
- Role="application" for canvas

### Visual Accessibility
- High contrast borders in focus
- Status icons in addition to colors
- Text labels for all actions
- Minimum 4.5:1 contrast ratios

## 10. Error States

### Handling Failures

1. **Max Handoffs Reached**:
   - Red warning banner
   - Disable handoff controls
   - Show "Max handoffs (20) reached"

2. **Agent Error**:
   - Red node border
   - Error icon in node
   - Error message in expanded view

3. **Handoff Failure**:
   - Red edge animation
   - X icon on edge
   - Log in history with error

4. **Timeout**:
   - Orange node border
   - Clock icon
   - "Timeout after Xs" message

## 11. Example Implementation Structure

```typescript
// Main component structure
export function AgentSwarmCanvas({
  className,
  showHistory = true,
  showStats = true,
  showControls = true,
  interactive = true
}: AgentSwarmCanvasProps) {
  // Store integration
  const swarmState = useOrchestrationStore(state => state.swarmState);
  const [localNodes, setLocalNodes] = useNodesState([]);
  const [localEdges, setLocalEdges] = useEdgesState([]);

  // Layout calculation
  useEffect(() => {
    if (swarmState) {
      const positioned = calculateGridLayout(swarmState.nodes);
      setLocalNodes(positioned);
    }
  }, [swarmState?.nodes]);

  // Dynamic edge creation
  useEffect(() => {
    if (swarmState?.handoffs) {
      const handoffEdges = createHandoffEdges(swarmState.handoffs);
      const traceEdges = createTraceEdges(swarmState.handoffs);
      setLocalEdges([...handoffEdges, ...traceEdges]);
    }
  }, [swarmState?.handoffs]);

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        nodeTypes={{ 'swarm-node': SwarmNodeComponent }}
        edgeTypes={{
          'swarm-handoff': HandoffEdge,
          'swarm-trace': TraceEdge,
          'swarm-capability': CapabilityEdge
        }}
      >
        {showStats && <Panel position="top-left"><SwarmStats /></Panel>}
        {showControls && <Panel position="top-right"><SwarmControls /></Panel>}
        {showHistory && <Panel position="bottom-center"><HandoffHistory /></Panel>}
      </ReactFlow>
    </div>
  );
}
```

## 12. Testing Scenarios

### Functional Tests
1. Single agent to agent handoff
2. Multiple simultaneous active agents
3. Circular handoff patterns
4. Max handoff limit enforcement
5. Manual handoff triggering
6. Reset and replay functionality

### Visual Tests
1. Grid layout with 1-20 agents
2. Entry point positioning
3. Handoff edge animations
4. Multiple active agent glows
5. History panel scrolling
6. Responsive canvas sizing

### Performance Tests
1. 50+ agents in swarm
2. 100+ handoffs in history
3. Rapid handoff sequences
4. Large shared context objects
5. Continuous streaming updates

## Appendix: Design Tokens

### Colors
- **Primary Active**: `rgb(139, 92, 246)` - Purple
- **Handoff**: `rgb(139, 92, 246)` - Violet
- **Entry Point**: `rgb(139, 92, 246)` - Purple
- **Completed**: `rgb(16, 185, 129)` - Emerald
- **Error**: `rgb(239, 68, 68)` - Rose
- **Background**: `rgb(15, 23, 42)` - Slate-900

### Spacing
- **Node Width**: 280px
- **Node Gap H**: 120px
- **Node Gap V**: 150px
- **Canvas Padding**: 60px
- **Panel Gap**: 16px

### Animation Timing
- **Node Entry**: 300ms ease-out
- **Glow Pulse**: 2000ms ease-in-out
- **Handoff Edge**: 3000ms display + 1000ms fade
- **Trace Fade**: 1000ms linear
- **Panel Slide**: 300ms ease-out