# Orchestration Task Wrappers

CollapsibleTask wrappers for the three agent orchestration canvas components. Each wrapper provides a task accordion UI that integrates with `orchestrationStore` and derives its status from the current orchestration state.

## Components

### **GraphOrchestrationTask**

Wraps `AgentGraphCanvas` with a collapsible task accordion for visualizing deterministic dependency-driven agent execution.

```tsx
import { GraphOrchestrationTask } from '@/components/ai-elements/orchestration-tasks';

function App() {
  return (
    <GraphOrchestrationTask
      title="Agent Graph Orchestration"
      description="Deterministic dependency-driven execution"
      defaultExpanded={true}
      onNodeClick={(node) => console.log('Node clicked:', node)}
      onEdgeClick={(edge) => console.log('Edge clicked:', edge)}
    />
  );
}
```

**Props:**
- `title?` - Task title (default: "Agent Graph Orchestration")
- `description?` - Task description (default: "Deterministic dependency-driven agent execution")
- `defaultExpanded?` - Whether accordion starts expanded (default: true)
- `className?` - Additional CSS classes
- `onNodeClick?` - Callback when a node is clicked
- `onEdgeClick?` - Callback when an edge is clicked

**Status Derivation:**
- `'pending'` - No nodes or all nodes are pending
- `'running'` - At least one node is running
- `'error'` - At least one node has an error
- `'success'` - All nodes completed successfully

---

### **WorkflowOrchestrationTask**

Wraps `AgentWorkflowCanvas` with a collapsible task accordion for visualizing sequential linear agent execution.

```tsx
import { WorkflowOrchestrationTask } from '@/components/ai-elements/orchestration-tasks';

function App() {
  return (
    <WorkflowOrchestrationTask
      title="Agent Workflow Orchestration"
      description="Sequential linear execution"
      defaultExpanded={true}
      onNodeClick={(task) => console.log('Task clicked:', task)}
      onTaskComplete={(taskId) => console.log('Task completed:', taskId)}
    />
  );
}
```

**Props:**
- `title?` - Task title (default: "Agent Workflow Orchestration")
- `description?` - Task description (default: "Sequential linear agent execution")
- `defaultExpanded?` - Whether accordion starts expanded (default: true)
- `className?` - Additional CSS classes
- `onNodeClick?` - Callback when a workflow task node is clicked
- `onTaskComplete?` - Callback when a task completes

**Status Derivation:**
- `'pending'` - No tasks or all tasks are pending
- `'running'` - At least one task is running
- `'error'` - At least one task has an error
- `'success'` - All tasks completed successfully

---

### **SwarmOrchestrationTask**

Wraps `AgentSwarmCanvas` with a collapsible task accordion for visualizing dynamic handoff-based agent execution.

```tsx
import { SwarmOrchestrationTask } from '@/components/ai-elements/orchestration-tasks';

function App() {
  return (
    <SwarmOrchestrationTask
      title="Agent Swarm Orchestration"
      description="Dynamic handoff-based execution"
      defaultExpanded={true}
      onNodeClick={(node) => console.log('Node clicked:', node)}
      onHandoff={(handoff) => console.log('Handoff:', handoff)}
    />
  );
}
```

**Props:**
- `title?` - Task title (default: "Agent Swarm Orchestration")
- `description?` - Task description (default: "Dynamic handoff-based agent execution")
- `defaultExpanded?` - Whether accordion starts expanded (default: true)
- `className?` - Additional CSS classes
- `onNodeClick?` - Callback when a swarm node is clicked
- `onHandoff?` - Callback when an agent handoff occurs

**Status Derivation:**
- `'pending'` - No nodes or all nodes are pending
- `'running'` - At least one node is running or in handoff state
- `'error'` - At least one node has an error
- `'success'` - All nodes completed successfully

---

## Integration with orchestrationStore

All three wrappers automatically connect to `useOrchestrationStore()` to:
1. Fetch the current orchestration state (graphState, workflowTasks, swarmNodes)
2. Derive the task status based on node/task statuses
3. Pass the appropriate data to the wrapped canvas component

The canvas components themselves handle the visualization and sync with the store for:
- Active agent highlighting (purple glow)
- Streaming data visualization
- Real-time updates

---

## Canvas Height

All wrappers use a fixed height of `600px` for the canvas. You can override this by:

```tsx
<GraphOrchestrationTask className="[&_>_div]:h-[800px]" />
```

Or wrap in a container with custom height:

```tsx
<div className="h-screen">
  <GraphOrchestrationTask />
</div>
```

---

## File Structure

```
/src/components/ai-elements/orchestration-tasks/
├── index.ts                           # Exports
├── graph-orchestration-task.tsx       # Graph wrapper
├── workflow-orchestration-task.tsx    # Workflow wrapper
├── swarm-orchestration-task.tsx       # Swarm wrapper
└── README.md                          # This file
```

---

## Examples

### **Using all three in a page:**

```tsx
import {
  GraphOrchestrationTask,
  WorkflowOrchestrationTask,
  SwarmOrchestrationTask,
} from '@/components/ai-elements/orchestration-tasks';

function OrchestrationPage() {
  return (
    <div className="space-y-4 p-6">
      <GraphOrchestrationTask />
      <WorkflowOrchestrationTask />
      <SwarmOrchestrationTask />
    </div>
  );
}
```

### **With custom titles:**

```tsx
<GraphOrchestrationTask
  title="Research Agent Network"
  description="Parallel research across multiple sources"
/>
```

### **With event handlers:**

```tsx
<WorkflowOrchestrationTask
  onNodeClick={(task) => {
    console.log(`Task ${task.taskId} clicked`);
    // Show task details modal
  }}
  onTaskComplete={(taskId) => {
    console.log(`Task ${taskId} completed`);
    // Trigger next action
  }}
/>
```

---

## Status Indicators

The task accordion header shows a status indicator that updates automatically:

- **Pending** (⏱️ gray) - Waiting to start
- **Running** (🔄 indigo) - Currently executing with spinning loader
- **Success** (✅ green) - All agents/tasks completed
- **Error** (❌ red) - One or more agents/tasks failed
- **Cancelled** (➖ gray) - Execution cancelled

The status derives from the aggregate state of all nodes/tasks in the orchestration.
