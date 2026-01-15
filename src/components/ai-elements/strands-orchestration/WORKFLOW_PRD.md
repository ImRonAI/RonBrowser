# Product Requirements Document: AgentWorkflowCanvas

## Component Overview

`AgentWorkflowCanvas` is a React Flow-based visualization component for the Strands Workflow orchestration pattern. Unlike Graph (complex DAG) or Swarm (autonomous handoffs), Workflow represents **strictly sequential, linear task execution** where each task must complete before the next begins.

## Core Architecture

### 1. Layout Algorithm

#### 1.1 Vertical Linear Layout
```typescript
interface WorkflowLayout {
  // Fixed vertical spacing between nodes
  nodeSpacing: 120; // pixels between node centers

  // Canvas dimensions
  canvasWidth: "100%";
  canvasHeight: "100%";

  // Node positioning
  nodeWidth: 280; // matches AgentOrchestrationNode
  nodeStartY: 100; // top padding

  // Center alignment calculation
  nodeCenterX: (canvasWidth / 2) - (nodeWidth / 2);
}
```

**Layout Rules:**
- All nodes align vertically on the same X axis (center of canvas)
- Y position = `nodeStartY + (taskIndex * nodeSpacing)`
- No automatic layout library needed (no Dagre) - positions are calculated
- Canvas should be scrollable vertically for long workflows
- Maintain 100px padding at top and bottom

#### 1.2 Auto-Fit Behavior
- On initial render, fit all nodes in viewport using `fitView()`
- Provide zoom controls (50% - 200% range)
- Enable panning for navigation
- Smooth scroll to active task when execution progresses

### 2. Visual Representation

#### 2.1 Node Representation
```typescript
// Use existing WorkflowNodeComponent wrapper
const nodeTypes = {
  "workflow-task": WorkflowNodeComponent // Already built, wraps AgentOrchestrationNode
};

// Node data structure
interface WorkflowNodeData extends WorkflowTask {
  stepNumber: number; // 1-based index for display
  isCurrentStep: boolean;
  progressPercentage?: number; // 0-100 for current task
}
```

**Visual Elements:**
- **Step Number Badge**: Prominent badge showing "Step 1", "Step 2", etc.
  - Position: Top-left of node (-10px, -10px offset)
  - Style: Circle with 24px diameter
  - Colors:
    - Completed: Emerald green background
    - Current: Sky blue with pulsing animation
    - Pending: Slate gray
- **Node Component**: Use existing `AgentOrchestrationNode` via `WorkflowNodeComponent`
- **Progress Indicator**: For running tasks, show progress bar at bottom of node

#### 2.2 Sequential Progression Visualization
- **Step Numbers**: Large, clear step numbers on each node
- **Completion Checkmarks**: Replace step number with checkmark when completed
- **Current Step Highlight**:
  - Glowing purple border (matches streaming pattern)
  - Subtle scale animation (1.02x)
  - Optional spotlight effect (radial gradient behind node)

#### 2.3 Task Dependencies
- Dependencies are implicit in Workflow (previous task)
- Show as disabled/grayed out for tasks not yet reachable
- Visual hierarchy: Brighter/more opaque for completed and current tasks

### 3. State Visualization

#### 3.1 Overall Progress Bar
```typescript
interface WorkflowProgressBar {
  position: "top" | "bottom"; // Panel position
  height: 48; // pixels
  showPercentage: true;
  showTaskCount: true; // "3 of 7 tasks completed"
  animateProgress: true; // Smooth transitions
}
```

**Progress Bar Design:**
- Full-width bar at top or bottom of canvas
- Segmented by tasks (each task is one segment)
- Colors:
  - Completed segments: Emerald green
  - Current segment: Sky blue with animated fill
  - Pending segments: Slate gray
- Text overlay: "40% Complete • Task 3 of 7"

#### 3.2 Current Step Indicator
```typescript
interface CurrentStepIndicator {
  // Animated arrow pointing to current task
  type: "floating-arrow" | "side-indicator";
  animation: "pulse" | "bounce";
  label: "Currently Executing";
}
```

**Indicator Options:**
- **Floating Arrow**: SVG arrow that floats beside current node
- **Side Indicator**: Vertical line on left side showing progress
- Both should pulse/animate to draw attention

#### 3.3 Task Status Badges
Already handled by `AgentOrchestrationNode` status prop:
- `pending`: Gray, waiting icon
- `running`: Blue, spinning loader
- `completed`: Green, checkmark
- `error`: Red, X icon
- Additional: Show execution time for completed tasks

#### 3.4 Sequential Task Cards
**Mini Task List Panel** (optional sidebar):
```typescript
interface TaskListPanel {
  position: "left" | "right";
  width: 240; // pixels
  showAllTasks: true;
  highlightCurrent: true;
  showDurations: true;
}
```

Each card shows:
- Step number
- Task name (truncated)
- Status icon
- Execution time (if completed)
- Click to scroll to task in canvas

### 4. Edge Types

#### 4.1 Simple Connecting Edges
```typescript
interface WorkflowEdge {
  type: "workflow-edge";
  style: {
    strokeWidth: 2;
    strokeDasharray: "none"; // Solid for default
  };
}
```

**Edge States:**
- **Completed**: Solid emerald green line
- **Active** (current→next): Animated sky blue with flow particles
- **Pending**: Dashed slate gray line
- **Error Path**: Red line to show where execution stopped

#### 4.2 Progress Visualization on Edges
```typescript
interface ProgressEdge {
  // For currently executing transition
  showProgress: boolean;
  progressPercent: number; // 0-100

  // Visual style
  progressStyle: "gradient-fill" | "moving-dots";
}
```

**Progress Styles:**
- **Gradient Fill**: Edge fills from source to target as task completes
- **Moving Dots**: Animated dots flowing along edge path

#### 4.3 Completion State Edges
- Completed edges get thicker (3px) and brighter
- Add subtle glow effect for recently completed edges
- Fade animation when transitioning from active to completed

#### 4.4 Animated Flow
```typescript
interface FlowAnimation {
  // Particle effect for active edge
  particles: {
    count: 3;
    size: 4; // pixels
    speed: 2; // seconds per traversal
    color: "currentColor";
  };

  // Or gradient animation
  gradient: {
    speed: 1.5; // seconds
    direction: "forward";
  };
}
```

### 5. Controls

#### 5.1 Control Panel Design
```typescript
interface WorkflowControls {
  position: Panel; // React Flow Panel component
  location: "top-left" | "bottom-center";

  buttons: {
    play: { icon: PlayIcon, label: "Start Workflow" };
    pause: { icon: PauseIcon, label: "Pause Execution" };
    step: { icon: StepForwardIcon, label: "Execute Next" };
    reset: { icon: RefreshIcon, label: "Reset Workflow" };
  };

  showStatus: true; // "Running", "Paused", "Completed"
  showElapsedTime: true;
}
```

#### 5.2 Control Actions
```typescript
// Integration with orchestrationStore
const controls = {
  onPlay: () => {
    // Start or resume workflow execution
    orchestrationStore.workflowState.status = "running";
    // Begin executing pending tasks sequentially
  },

  onPause: () => {
    // Pause after current task completes
    orchestrationStore.workflowState.status = "paused";
  },

  onStep: () => {
    // Execute just the next pending task
    const nextTask = getNextPendingTask();
    if (nextTask) {
      orchestrationStore.updateNodeStatus(nextTask.taskId, "running");
    }
  },

  onReset: () => {
    // Reset all tasks to pending
    orchestrationStore.workflowTasks.forEach(task => {
      orchestrationStore.updateNodeStatus(task.taskId, "pending");
    });
    // Clear execution history
  }
};
```

#### 5.3 Control State Management
- Disable "Play" when running or all complete
- Disable "Pause" when not running
- Disable "Step" when running or all complete
- Show confirmation dialog for "Reset"

### 6. Integration Points

#### 6.1 orchestrationStore Integration
```typescript
// Subscribe to workflow state
const workflowState = useOrchestrationStore(state => state.workflowState);
const workflowTasks = useOrchestrationStore(state => state.workflowTasks);

// Update node data when task status changes
useEffect(() => {
  const nodes = workflowTasks.map((task, index) => ({
    id: task.taskId,
    type: "workflow-task",
    position: {
      x: centerX,
      y: startY + (index * spacing)
    },
    data: {
      ...task,
      stepNumber: index + 1,
      isCurrentStep: task.status === "running",
      progressPercentage: calculateProgress(task),
      // Streaming data from store
      isActivelyStreaming: orchestrationStore.activeAgentIds.includes(task.taskId),
      streamingData: orchestrationStore.agentStreamingData.get(task.taskId)
    }
  }));

  setNodes(nodes);
}, [workflowTasks]);
```

#### 6.2 Active Task Synchronization
```typescript
// Auto-scroll to active task
const activeTaskId = workflowTasks.find(t => t.status === "running")?.taskId;

useEffect(() => {
  if (activeTaskId && reactFlowInstance) {
    const node = reactFlowInstance.getNode(activeTaskId);
    if (node) {
      reactFlowInstance.fitView({
        nodes: [node],
        duration: 800,
        padding: 0.5
      });
    }
  }
}, [activeTaskId]);
```

#### 6.3 Streaming Data Integration
```typescript
// Connect to streaming events
useEffect(() => {
  const unsubscribe = agentStore.subscribe(
    state => state.streamingData,
    (streamingData) => {
      // Update node with streaming data
      const taskId = streamingData.agentId;
      orchestrationStore.syncStreamingData(taskId, {
        reasoning: streamingData.reasoning,
        chainOfThought: streamingData.chainOfThought,
        tools: streamingData.tools,
        images: streamingData.images
      });
    }
  );

  return unsubscribe;
}, []);
```

#### 6.4 Sequential Execution Events
```typescript
interface WorkflowExecutionEvents {
  onTaskStart: (taskId: string) => void;
  onTaskComplete: (taskId: string, result: AgentResult) => void;
  onTaskError: (taskId: string, error: Error) => void;
  onWorkflowComplete: () => void;
  onWorkflowError: (error: Error) => void;
}

// Emit events for monitoring
const handleTaskComplete = (taskId: string) => {
  // Update task status
  orchestrationStore.updateNodeStatus(taskId, "completed");

  // Find and start next task
  const currentIndex = workflowTasks.findIndex(t => t.taskId === taskId);
  const nextTask = workflowTasks[currentIndex + 1];

  if (nextTask) {
    // Automatic progression
    setTimeout(() => {
      orchestrationStore.updateNodeStatus(nextTask.taskId, "running");
    }, 500); // Brief pause between tasks
  } else {
    // Workflow complete
    orchestrationStore.workflowState.status = "completed";
  }
};
```

## Component API

```typescript
interface AgentWorkflowCanvasProps {
  // Data
  workflowId: string;
  tasks: WorkflowTask[];

  // Display Options
  showProgressBar?: boolean; // default: true
  showTaskList?: boolean; // default: false
  showControls?: boolean; // default: true
  showStepNumbers?: boolean; // default: true

  // Layout
  orientation?: "vertical" | "horizontal"; // default: "vertical"
  spacing?: number; // pixels between nodes, default: 120

  // Callbacks
  onTaskClick?: (task: WorkflowTask) => void;
  onTaskStart?: (taskId: string) => void;
  onTaskComplete?: (taskId: string, result: AgentResult) => void;
  onWorkflowComplete?: () => void;

  // Styling
  className?: string;
  progressBarPosition?: "top" | "bottom"; // default: "top"
  controlsPosition?: "top-left" | "bottom-center"; // default: "top-left"
}
```

## Visual Design Specifications

### Color Palette
```typescript
const workflowColors = {
  // Status colors (consistent with AgentOrchestrationNode)
  pending: "slate-600",
  running: "sky-500",
  completed: "emerald-500",
  error: "rose-500",

  // Progress colors
  progressBackground: "slate-200 dark:slate-700",
  progressFill: "sky-500",
  progressComplete: "emerald-500",

  // Edge colors
  edgeDefault: "slate-400",
  edgeActive: "sky-500",
  edgeComplete: "emerald-500",
  edgeError: "rose-500",

  // Step number badges
  stepPending: "slate-500",
  stepActive: "sky-500",
  stepComplete: "emerald-500"
};
```

### Animations
```typescript
const animations = {
  // Node animations
  currentNodePulse: {
    scale: [1, 1.02, 1],
    transition: { duration: 2, repeat: Infinity }
  },

  // Edge animations
  flowParticles: {
    duration: 2,
    ease: "linear",
    repeat: Infinity
  },

  // Progress animations
  progressFill: {
    transition: { duration: 0.5, ease: "easeInOut" }
  },

  // Step number badge
  stepBadgeBounce: {
    y: [0, -4, 0],
    transition: { duration: 1.5, repeat: Infinity }
  }
};
```

### Responsive Behavior
- Mobile: Stack controls vertically, reduce node spacing
- Tablet: Default layout with collapsible task list
- Desktop: Full layout with all panels visible

## Performance Considerations

1. **Memoization**: Use React.memo for all sub-components
2. **Virtual Scrolling**: For workflows with >20 tasks
3. **Debounced Updates**: Batch status updates every 100ms
4. **Lazy Rendering**: Only render visible nodes + buffer
5. **CSS Transforms**: Use transform for animations (not top/left)

## Accessibility

1. **Keyboard Navigation**: Arrow keys to move between tasks
2. **Screen Reader Support**: ARIA labels for all interactive elements
3. **Focus Management**: Clear focus indicators
4. **Status Announcements**: Live regions for status changes
5. **High Contrast Mode**: Ensure sufficient color contrast

## Testing Scenarios

1. **Empty Workflow**: Handle gracefully with placeholder message
2. **Single Task**: Should still show step number and progress
3. **Long Workflow** (50+ tasks): Performance and scrolling
4. **Rapid Status Changes**: No visual glitches
5. **Error Recovery**: Clear error states and retry options

## Future Enhancements

1. **Branching Support**: Conditional paths (would upgrade to Graph pattern)
2. **Parallel Tracks**: Multiple sequential tracks running simultaneously
3. **Time Estimates**: Show estimated time remaining
4. **Execution History**: Replay previous runs
5. **Task Templates**: Save and reuse common task sequences

## Dependencies

- React Flow (@xyflow/react)
- Framer Motion (animations)
- Zustand (orchestrationStore)
- Existing components:
  - AgentOrchestrationNode
  - WorkflowNodeComponent wrapper
  - orchestrationStore hooks

## Success Metrics

1. **Visual Clarity**: Users understand execution order at a glance
2. **Real-time Feedback**: <100ms visual update after state change
3. **Smooth Animations**: 60fps for all animations
4. **Intuitive Controls**: Users can control workflow without documentation
5. **Performance**: Handle 100+ task workflows without lag