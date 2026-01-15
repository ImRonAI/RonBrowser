# AgentWorkflowCanvas Component

A React Flow-based visualization component for Strands Workflow orchestration with sequential linear execution.

## Features

- **Vertical Linear Layout**: Tasks arranged vertically with 120px spacing
- **Step Number Badges**: Quick navigation badges at the top
- **Sequential Progression**: Simple straight-line connections between tasks
- **Full-width Progress Bar**: Segmented progress indicator at bottom
- **Real-time Updates**: Syncs with orchestrationStore for live status
- **Purple Glow**: Active streaming agents highlighted with purple glow
- **Dark Theme**: Glass effects and dark aesthetics matching AI Elements

## Usage

```tsx
import { AgentWorkflowCanvas } from '@/components/ai-elements/agent-workflow-canvas';
import { useOrchestrationStore } from '@/stores/orchestrationStore';

function MyWorkflowView() {
  const { initWorkflowOrchestration } = useOrchestrationStore();

  // Initialize workflow state
  useEffect(() => {
    const workflowState = {
      workflowId: "my-workflow",
      status: "running",
      tasks: [
        {
          taskId: "task-1",
          description: "Initialize environment",
          dependencies: [],
          status: "completed",
          // ... other task properties
        },
        {
          taskId: "task-2",
          description: "Process data",
          dependencies: ["task-1"],
          status: "running",
          isActivelyStreaming: true,
          // ... other task properties
        },
        // ... more tasks
      ],
      parallelExecution: false,
      createdAt: Date.now(),
      startedAt: Date.now(),
    };

    initWorkflowOrchestration(workflowState);
  }, []);

  return (
    <AgentWorkflowCanvas
      onNodeClick={(task) => console.log('Task clicked:', task)}
      onTaskComplete={(taskId) => console.log('Task completed:', taskId)}
    />
  );
}
```

## Component Structure

### Main Component
- `index.tsx` - Main AgentWorkflowCanvas component with React Flow integration

### Sub-components
- `workflow-edge.tsx` - Simple sequential edge with animation
- `progress-bar.tsx` - Full-width segmented progress indicator
- `step-badge.tsx` - Individual step badges for navigation

### Demo
- `demo.tsx` - Complete demo with mock workflow data

## Integration with OrchestrationStore

The component automatically syncs with the orchestrationStore:

```tsx
// The component watches these store values:
const {
  workflowState,     // Current workflow state
  workflowTasks,     // Array of tasks to display
  activeAgentIds,    // Currently active tasks (purple glow)
  agentStreamingData // Real-time streaming data per agent
} = useOrchestrationStore();
```

## Task Status Visualization

- **Pending**: Gray, waiting to start
- **Running**: Blue with pulsing animation, purple glow if streaming
- **Completed**: Green with checkmark
- **Error**: Red with X icon
- **Cancelled**: Dark gray with minus icon

## Props

### AgentWorkflowCanvas

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string?` | Additional CSS classes |
| `onNodeClick` | `(task: WorkflowTask) => void` | Task click handler |
| `onTaskComplete` | `(taskId: string) => void` | Task completion handler |

## Styling

The component uses:
- Dark theme with `bg-slate-900` base
- Glass effects with `backdrop-blur-sm`
- Purple accent (`violet-500`) for active/streaming states
- Smooth animations (300ms ease transitions)
- Consistent with AI Elements design system

## Dependencies

- `@xyflow/react` - React Flow visualization
- `framer-motion` - Animations
- `zustand` - State management (orchestrationStore)
- Existing components:
  - `AgentOrchestrationNode` (via `WorkflowNodeComponent`)
  - `orchestrationStore`
  - Strands types

## Key Implementation Details

1. **Fixed Vertical Positioning**: No auto-layout, tasks positioned at fixed Y intervals
2. **Sequential Only**: No branching or parallel paths
3. **Single Active Agent**: Only one task can be running at a time
4. **Progress Calculation**: Based on completed tasks / total tasks
5. **Step Navigation**: Click badges to focus on specific tasks