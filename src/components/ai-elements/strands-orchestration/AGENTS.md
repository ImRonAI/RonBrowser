# Multi-Agent Orchestration Visualization System
## Vercel AI Elements Blueprint for Workflow/Swarm/Graph Orchestration

**Author's Note:** This document outlines a sophisticated 70/30 split component that visualizes multi-agent orchestration with real-time streaming, active agent highlighting, nested sub-subagent support, and tab-based context switching.

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Component Hierarchy](#component-hierarchy)
3. [Data Flow & Streaming](#data-flow--streaming)
4. [Implementation Details](#implementation-details)
5. [Code Examples](#code-examples)
6. [Integration with Vercel AI SDK](#integration-with-vercel-ai-sdk)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│          Main Orchestration Component                   │
│  (Workflow/Swarm/Graph Trigger)                         │
├─────────────────────────────┬───────────────────────────┤
│                             │                           │
│  70% LEFT PANE              │   30% RIGHT PANE          │
│  ─────────────────          │   ──────────────          │
│  Workflow Visualization     │   Task Display & CoT      │
│  • Agent Node Graph         │   ┌─────────────────────┐ │
│  • Connection Lines         │   │ Tab Bar:             │ │
│  • Glow Effect (active)     │   │ [Agent1] [Agent2]... │ │
│  • Node States              │   │ [View All]           │ │
│                             │   └─────────────────────┘ │
│                             │   SubAgent Card:          │
│                             │   • Name                  │
│                             │   • Model                 │
│                             │   • Prompt               │
│                             │   • Tools Allowed        │
│                             │                          │
│                             │   ChainOfThought:        │
│                             │   • Reasoning Steps      │
│                             │   • Tool Calls           │
│                             │   • Search Results       │
│                             │   • Sub-SubAgent Chain   │
│                             │     (1 level max)        │
│                             │                          │
│                             │   [View All Stack]:      │
│                             │   • Window pane effect   │
│                             │   • Each task card       │
│                             │   • Auto-expand active   │
└─────────────────────────────┴───────────────────────────┘
```

### Streaming & State Management

**Orchestration Tool Call Triggering:**
- User triggers workflow/swarm/graph via interface
- Main agent calls `workflow`, `swarm`, or `graph` tool
- Each tool invocation streams:
  - `subagent-created` event (creates node in left pane)
  - `subagent-started` event (adds glow to node)
  - `reasoning` events (appears in ChainOfThought)
  - `tool-call` events (displayed in CoT)
  - `tool-result` events (displayed in CoT)
  - `subagent-use-agent` event (if sub-subagent created)
  - `subagent-completed` event (removes glow, shows completion state)

**Sub-SubAgent Constraint:**
- Sub-subagents CAN call `use_agent` tool
- Sub-subagents CANNOT call orchestration tools (workflow/swarm/graph)
- Sub-subagents of sub-subagents have NO agent invocation ability
- Maximum nesting depth: 2 levels of orchestration

---

## Component Hierarchy

### Root Component: `MultiAgentOrchestrationPanel`

```typescript
interface OrchestrationState {
  // Workflow metadata
  orchestrationType: 'workflow' | 'swarm' | 'graph';
  executionId: string;
  startTime: number;
  
  // Agent nodes (70% left pane)
  agents: AgentNode[];
  connections: Connection[];
  activeAgentIds: string[]; // Currently executing
  
  // Task display (30% right pane)
  selectedAgentId: string | null;
  taskCards: Map<string, TaskCardData>;
  subAgentNesting: Map<string, AgentNode[]>; // For nested visualization
  
  // View mode
  viewMode: 'single' | 'all';
  expandedSteps: Map<string, boolean>; // Track which CoT steps expanded
}

interface AgentNode {
  id: string;
  name: string;
  model: string;
  prompt: string;
  toolsAllowed: string[];
  parentId?: string; // If this is a sub-subagent
  state: 'created' | 'executing' | 'completed' | 'error';
  executionOrder: number;
  position: { x: number; y: number }; // For graph layout
}

interface TaskCardData {
  agentId: string;
  agentName: string;
  model: string;
  prompt: string;
  toolsAllowed: string[];
  chainOfThought: ChainOfThoughtStep[];
  output: string;
  executionTime: number;
  error?: string;
  nestedAgents?: AgentNode[]; // Sub-subagents spawned by this agent
}

interface ChainOfThoughtStep {
  type: 'reasoning' | 'tool-call' | 'tool-result' | 'search-result' | 'function-call';
  content: string;
  timestamp: number;
  details?: any;
  isStreaming?: boolean;
}

interface Connection {
  fromId: string;
  toId: string;
  type: 'sequential' | 'conditional' | 'parallel' | 'handoff';
  label?: string;
}
```

---

## Data Flow & Streaming

### Streaming Event Types

```typescript
type OrchestrationStreamEvent =
  | SubAgentCreatedEvent
  | SubAgentStartedEvent
  | ReasoningEvent
  | ToolCallEvent
  | ToolResultEvent
  | SearchResultEvent
  | SubAgentUseAgentEvent
  | SubAgentCompletedEvent
  | OrchestrationErrorEvent;

interface SubAgentCreatedEvent {
  type: 'subagent-created';
  agentId: string;
  agentName: string;
  model: string;
  prompt: string;
  toolsAllowed: string[];
  parentId?: string;
  executionOrder: number;
  position: { x: number; y: number };
}

interface SubAgentStartedEvent {
  type: 'subagent-started';
  agentId: string;
  timestamp: number;
}

interface ReasoningEvent {
  type: 'reasoning';
  agentId: string;
  step: number;
  content: string;
  timestamp: number;
}

interface ToolCallEvent {
  type: 'tool-call';
  agentId: string;
  toolName: string;
  arguments: Record<string, any>;
  timestamp: number;
}

interface ToolResultEvent {
  type: 'tool-result';
  agentId: string;
  toolName: string;
  result: string;
  timestamp: number;
}

interface SearchResultEvent {
  type: 'search-result';
  agentId: string;
  query: string;
  results: SearchResultItem[];
  timestamp: number;
}

interface SubAgentUseAgentEvent {
  type: 'subagent-use-agent';
  parentAgentId: string;
  childAgentId: string;
  childAgentName: string;
  childModel: string;
  childPrompt: string;
  childToolsAllowed: string[];
  timestamp: number;
}

interface SubAgentCompletedEvent {
  type: 'subagent-completed';
  agentId: string;
  output: string;
  executionTime: number;
  timestamp: number;
}

interface OrchestrationErrorEvent {
  type: 'error';
  agentId: string;
  error: string;
  timestamp: number;
}
```

### Real-Time Streaming Flow

```typescript
// In your API route (e.g., /api/orchestration-stream)
import { streamWorkflow, streamSwarm, streamGraph } from '@/lib/orchestration';
import { writable } from 'svelte/store';

export async function POST(req: Request) {
  const { orchestrationType, prompt, context } = await req.json();
  
  // Create streaming response
  const encoder = new TextEncoder();
  const { readable, writable: responseWritable } = new ReadableStream();
  
  (async () => {
    try {
      let eventStream;
      
      if (orchestrationType === 'workflow') {
        eventStream = streamWorkflow(prompt, context);
      } else if (orchestrationType === 'swarm') {
        eventStream = streamSwarm(prompt, context);
      } else {
        eventStream = streamGraph(prompt, context);
      }
      
      for await (const event of eventStream) {
        // Transform event into JSON-ND (newline-delimited JSON)
        const line = JSON.stringify(event) + '\n';
        responseWritable.getWriter().write(encoder.encode(line));
      }
      
      responseWritable.close();
    } catch (error) {
      const errorEvent = {
        type: 'error',
        agentId: 'orchestrator',
        error: error.message,
        timestamp: Date.now(),
      };
      const line = JSON.stringify(errorEvent) + '\n';
      responseWritable.getWriter().write(encoder.encode(line));
      responseWritable.close();
    }
  })();
  
  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}
```

---

## Implementation Details

### 1. Left Pane: Workflow Visualization (70%)

**Features:**
- Node-based graph visualization
- Each node = one subagent
- Connections show orchestration type (sequential, parallel, conditional)
- Active agents have animated glow effect
- Smooth transitions as new agents spawn

**Technical Approach:**
- Use React Flow or similar graph library
- Position nodes based on execution order and orchestration type
- Implement glow as CSS animation on active node elements

```css
@keyframes agentGlow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
  }
  50% {
    box-shadow: 0 0 40px rgba(34, 197, 94, 0.8);
  }
}

.agent-node.active {
  animation: agentGlow 2s ease-in-out infinite;
}
```

### 2. Right Pane: Task Display & Chain of Thought (30%)

#### Tab Bar
```
┌─────────────────────────────────────────┐
│ [Agent1: Claude 3.5 Sonnet]             │
│ [Agent2: GPT-4]        [View All]       │
└─────────────────────────────────────────┘
```

**Behaviors:**
- Tabs auto-created as new subagents spawn
- Selected tab highlights in active state
- `View All` mode stacks task cards like window panes
- Only "currently executing" agents show expanded CoT

#### SubAgent Card

```
┌──────────────────────────────────┐
│ Agent Name: Research Assistant   │
│ Model: Claude 3.5 Sonnet        │
│ ─────────────────────────────────│
│ Prompt: [Search for information] │
│ Allowed Tools:                   │
│   • web_search                   │
│   • use_agent                    │
└──────────────────────────────────┘
```

#### Chain of Thought Component (Nested under SubAgent Card)

```
ChainOfThought Step 1: Reasoning
├─ Content: "I need to search for current data..."
├─ Timestamp: 2:34:10
└─ [Expand]

ChainOfThought Step 2: Tool Call
├─ Tool: web_search
├─ Arguments: { query: "latest trends" }
├─ Status: Executing
└─ [Expand]

ChainOfThought Step 3: Search Results
├─ Query: "latest trends"
├─ Results: 5 items
└─ [Expand/Collapse]
   └─ Result 1: Title | URL | Snippet
   └─ Result 2: Title | URL | Snippet

ChainOfThought Step 4: Sub-SubAgent Invocation
├─ Using Agent: Analysis Agent
├─ Model: GPT-4
├─ Status: Streaming
└─ [Sub-CoT]
   └─ Sub-CoT Step 1: Analyzing data...
   └─ Sub-CoT Step 2: Tool call to calculator...
```

---

## Code Examples

### Component: MultiAgentOrchestrationPanel

```typescript
// components/MultiAgentOrchestrationPanel.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useEventSource } from '@/hooks/useEventSource';
import { WorkflowVisualization } from './WorkflowVisualization';
import { TaskDisplayPanel } from './TaskDisplayPanel';
import { OrchestrationState, OrchestrationStreamEvent } from '@/types/orchestration';

export function MultiAgentOrchestrationPanel() {
  const [state, setState] = useState<OrchestrationState>({
    orchestrationType: 'workflow',
    executionId: '',
    startTime: 0,
    agents: [],
    connections: [],
    activeAgentIds: [],
    selectedAgentId: null,
    taskCards: new Map(),
    subAgentNesting: new Map(),
    viewMode: 'single',
    expandedSteps: new Map(),
  });

  const handleStreamEvent = useCallback((event: OrchestrationStreamEvent) => {
    setState((prevState) => {
      switch (event.type) {
        case 'subagent-created': {
          const newAgent = {
            id: event.agentId,
            name: event.agentName,
            model: event.model,
            prompt: event.prompt,
            toolsAllowed: event.toolsAllowed,
            parentId: event.parentId,
            state: 'created' as const,
            executionOrder: event.executionOrder,
            position: event.position,
          };

          const newAgents = [...prevState.agents, newAgent];
          
          // If parent exists, add to nested collection
          if (event.parentId) {
            const nested = prevState.subAgentNesting.get(event.parentId) || [];
            nested.push(newAgent);
            prevState.subAgentNesting.set(event.parentId, nested);
          }

          return {
            ...prevState,
            agents: newAgents,
            // Auto-select first agent, or the newly created one
            selectedAgentId: prevState.selectedAgentId || event.agentId,
          };
        }

        case 'subagent-started': {
          return {
            ...prevState,
            activeAgentIds: [...prevState.activeAgentIds, event.agentId],
            agents: prevState.agents.map((agent) =>
              agent.id === event.agentId ? { ...agent, state: 'executing' as const } : agent
            ),
          };
        }

        case 'reasoning':
        case 'tool-call':
        case 'tool-result':
        case 'search-result': {
          const taskCard = prevState.taskCards.get(event.agentId);
          if (taskCard) {
            taskCard.chainOfThought.push({
              type: event.type as any,
              content: event.content || JSON.stringify(event),
              timestamp: event.timestamp,
              details: event.details || {},
              isStreaming: true,
            });
          }
          return prevState;
        }

        case 'subagent-completed': {
          return {
            ...prevState,
            activeAgentIds: prevState.activeAgentIds.filter(
              (id) => id !== event.agentId
            ),
            agents: prevState.agents.map((agent) =>
              agent.id === event.agentId
                ? { ...agent, state: 'completed' as const }
                : agent
            ),
            taskCards: new Map(prevState.taskCards).set(event.agentId, {
              ...prevState.taskCards.get(event.agentId)!,
              output: event.output,
              executionTime: event.executionTime,
            }),
          };
        }

        case 'error': {
          return {
            ...prevState,
            agents: prevState.agents.map((agent) =>
              agent.id === event.agentId
                ? { ...agent, state: 'error' as const }
                : agent
            ),
            taskCards: new Map(prevState.taskCards).set(event.agentId, {
              ...prevState.taskCards.get(event.agentId)!,
              error: event.error,
            }),
          };
        }

        default:
          return prevState;
      }
    });
  }, []);

  // Hook into EventSource for streaming
  const { isStreaming } = useEventSource('/api/orchestration-stream', handleStreamEvent);

  return (
    <div className="flex h-screen bg-background">
      {/* 70% Left Pane */}
      <div className="flex-[7] border-r border-border">
        <WorkflowVisualization
          agents={state.agents}
          connections={state.connections}
          activeAgentIds={state.activeAgentIds}
          selectedAgentId={state.selectedAgentId}
          onSelectAgent={(agentId) =>
            setState((prev) => ({ ...prev, selectedAgentId: agentId }))
          }
        />
      </div>

      {/* 30% Right Pane */}
      <div className="flex-[3] bg-surface border-l border-border overflow-hidden">
        <TaskDisplayPanel
          state={state}
          onSelectAgent={(agentId) =>
            setState((prev) => ({ ...prev, selectedAgentId: agentId }))
          }
          onToggleViewMode={() =>
            setState((prev) => ({
              ...prev,
              viewMode: prev.viewMode === 'single' ? 'all' : 'single',
            }))
          }
        />
      </div>
    </div>
  );
}
```

### Component: TaskDisplayPanel (30% Right Pane)

```typescript
// components/TaskDisplayPanel.tsx
'use client';

import React from 'react';
import { ChainOfThought } from '@vercel/ai-rsc/elements';
import { TaskCard } from './TaskCard';
import { OrchestrationState } from '@/types/orchestration';

interface TaskDisplayPanelProps {
  state: OrchestrationState;
  onSelectAgent: (agentId: string) => void;
  onToggleViewMode: () => void;
}

export function TaskDisplayPanel({
  state,
  onSelectAgent,
  onToggleViewMode,
}: TaskDisplayPanelProps) {
  const agentList = Array.from(state.taskCards.values()).map((card) => ({
    id: card.agentId,
    name: card.agentName,
  }));

  const selectedCard = state.selectedAgentId
    ? state.taskCards.get(state.selectedAgentId)
    : null;

  const isMultiAgent = agentList.length > 1;

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Tab Bar */}
      {isMultiAgent && (
        <div className="flex gap-2 p-4 border-b border-border overflow-x-auto bg-surface-elevated">
          {agentList.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                state.selectedAgentId === agent.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {agent.name}
            </button>
          ))}

          {/* View All Button */}
          <button
            onClick={onToggleViewMode}
            className={`px-4 py-2 rounded-md text-sm font-medium ml-auto whitespace-nowrap transition-all ${
              state.viewMode === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            View All
          </button>
        </div>
      )}

      {/* Task Display Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {state.viewMode === 'single' && selectedCard ? (
          <TaskCard
            card={selectedCard}
            isActive={state.activeAgentIds.includes(selectedCard.agentId)}
            onNestedAgentSelect={onSelectAgent}
          />
        ) : state.viewMode === 'all' ? (
          <div className="space-y-4">
            {Array.from(state.taskCards.values()).map((card) => (
              <div
                key={card.agentId}
                className="border border-border rounded-lg overflow-hidden shadow-md"
              >
                <TaskCard
                  card={card}
                  isActive={state.activeAgentIds.includes(card.agentId)}
                  onNestedAgentSelect={onSelectAgent}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-text-secondary py-8">
            Waiting for agent orchestration to begin...
          </div>
        )}
      </div>
    </div>
  );
}
```

### Component: TaskCard with Nested ChainOfThought

```typescript
// components/TaskCard.tsx
'use client';

import React, { useState } from 'react';
import { ChainOfThought, Task } from '@vercel/ai-rsc/elements';
import { TaskCardData } from '@/types/orchestration';

interface TaskCardProps {
  card: TaskCardData;
  isActive: boolean;
  onNestedAgentSelect?: (agentId: string) => void;
}

export function TaskCard({
  card,
  isActive,
  onNestedAgentSelect,
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(isActive);

  return (
    <div className={`bg-surface rounded-lg border ${isActive ? 'border-primary' : 'border-border'} p-4`}>
      {/* SubAgent Metadata Card */}
      <div className="mb-4 p-4 bg-surface-elevated rounded-md border border-border-subtle">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Agent Name
            </label>
            <p className="text-sm font-medium text-text mt-1">{card.agentName}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Model
            </label>
            <p className="text-sm font-medium text-text mt-1">{card.model}</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Prompt
          </label>
          <p className="text-sm text-text-secondary mt-1 line-clamp-2">
            {card.prompt}
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Allowed Tools
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {card.toolsAllowed.map((tool) => (
              <span
                key={tool}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        {isActive && (
          <div className="mt-4 flex items-center gap-2 text-primary">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
            <span className="text-xs font-medium">Streaming...</span>
          </div>
        )}
      </div>

      {/* Chain of Thought */}
      <div className="mt-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 hover:text-text"
        >
          ▼ Chain of Thought ({card.chainOfThought.length} steps)
        </button>

        {isExpanded && (
          <div className="bg-surface-elevated rounded-md border border-border-subtle p-4 space-y-3">
            {card.chainOfThought.map((step, idx) => (
              <ChainOfThoughtStep
                key={idx}
                step={step}
                stepNumber={idx + 1}
                isStreaming={step.isStreaming && isActive}
              />
            ))}
          </div>
        )}
      </div>

      {/* Nested Agents (Sub-SubAgents) */}
      {card.nestedAgents && card.nestedAgents.length > 0 && (
        <div className="mt-4 border-t border-border-subtle pt-4">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Sub-Agents Invoked
          </label>
          <div className="space-y-2 mt-2">
            {card.nestedAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onNestedAgentSelect?.(agent.id)}
                className="w-full text-left p-2 rounded-md bg-bg-3 hover:bg-bg-3 transition-colors text-sm"
              >
                <span className="font-medium">{agent.name}</span>
                <span className="text-text-secondary ml-2">({agent.model})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Output/Error Display */}
      {card.output && (
        <div className="mt-4 p-4 bg-success/10 border border-success/20 rounded-md">
          <p className="text-xs font-semibold text-success uppercase tracking-wide mb-2">
            Output
          </p>
          <p className="text-sm text-text">{card.output}</p>
          <p className="text-xs text-text-secondary mt-2">
            Completed in {card.executionTime.toFixed(2)}ms
          </p>
        </div>
      )}

      {card.error && (
        <div className="mt-4 p-4 bg-error/10 border border-error/20 rounded-md">
          <p className="text-xs font-semibold text-error uppercase tracking-wide mb-2">
            Error
          </p>
          <p className="text-sm text-error">{card.error}</p>
        </div>
      )}
    </div>
  );
}

// Helper Component: ChainOfThoughtStep
interface ChainOfThoughtStepProps {
  step: any;
  stepNumber: number;
  isStreaming: boolean;
}

function ChainOfThoughtStep({
  step,
  stepNumber,
  isStreaming,
}: ChainOfThoughtStepProps) {
  const [isExpanded, setIsExpanded] = useState(isStreaming);

  const typeColors = {
    reasoning: 'bg-blue-50 border-blue-200',
    'tool-call': 'bg-purple-50 border-purple-200',
    'tool-result': 'bg-green-50 border-green-200',
    'search-result': 'bg-cyan-50 border-cyan-200',
    'function-call': 'bg-orange-50 border-orange-200',
  };

  return (
    <div
      className={`rounded-md border p-3 ${
        typeColors[step.type] || 'bg-surface-elevated border-border'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-secondary">
              Step {stepNumber}:
            </span>
            <span className="text-xs font-medium text-text uppercase tracking-wide">
              {step.type}
            </span>
            {isStreaming && (
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
            )}
          </div>
          <p className="text-sm text-text mt-1 line-clamp-2">{step.content}</p>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-text-secondary hover:text-text ml-2"
        >
          ▼
        </button>
      </div>

      {isExpanded && step.details && (
        <div className="mt-3 pt-3 border-t border-current/10">
          <pre className="text-xs text-text-secondary overflow-x-auto max-h-40 bg-surface p-2 rounded">
            {JSON.stringify(step.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

### Component: WorkflowVisualization (70% Left Pane)

```typescript
// components/WorkflowVisualization.tsx
'use client';

import React, { useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AgentNode as AgentNodeType, Connection } from '@/types/orchestration';

interface WorkflowVisualizationProps {
  agents: AgentNodeType[];
  connections: Connection[];
  activeAgentIds: string[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
}

export function WorkflowVisualization({
  agents,
  connections,
  activeAgentIds,
  selectedAgentId,
  onSelectAgent,
}: WorkflowVisualizationProps) {
  const { nodes, setNodes } = useNodesState(
    agents.map((agent) => ({
      id: agent.id,
      data: {
        label: agent.name,
        model: agent.model,
        isActive: activeAgentIds.includes(agent.id),
        isSelected: selectedAgentId === agent.id,
        state: agent.state,
      },
      position: agent.position,
      style: {
        background: activeAgentIds.includes(agent.id) ? '#22c55e' : '#3b82f6',
        borderRadius: '8px',
        padding: '16px',
        color: 'white',
        fontWeight: 500,
        border:
          selectedAgentId === agent.id
            ? '3px solid #fbbf24'
            : '2px solid rgba(255,255,255,0.2)',
        boxShadow:
          activeAgentIds.includes(agent.id)
            ? '0 0 40px rgba(34, 197, 94, 0.8)'
            : 'none',
        animation:
          activeAgentIds.includes(agent.id)
            ? 'agentGlow 2s ease-in-out infinite'
            : 'none',
        cursor: 'pointer',
      },
    }))
  );

  const { edges } = useEdgesState(
    connections.map((conn) => ({
      id: `${conn.fromId}-${conn.toId}`,
      source: conn.fromId,
      target: conn.toId,
      label: conn.label,
      animated: activeAgentIds.includes(conn.toId),
      markerEnd: { type: 'arrowclosed' },
      style: {
        stroke:
          conn.type === 'parallel'
            ? '#a78bfa'
            : conn.type === 'conditional'
              ? '#fbbf24'
              : conn.type === 'handoff'
                ? '#ec4899'
                : '#60a5fa',
        strokeWidth: 2,
      },
    }))
  );

  return (
    <div className="w-full h-full">
      <style>{`
        @keyframes agentGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
          }
          50% {
            box-shadow: 0 0 40px rgba(34, 197, 94, 0.8);
          }
        }
      `}</style>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

---

## Integration with Vercel AI SDK

### Tool Definition: Workflow/Swarm/Graph Invocation

```typescript
// lib/orchestration-tools.ts
import { tool } from 'ai';
import { z } from 'zod';

export const workflowTool = tool({
  description: 'Execute a multi-step workflow with predefined sequential agents',
  parameters: z.object({
    workflowName: z.string().describe('Name of the workflow to execute'),
    initialInput: z.string().describe('Input for the first workflow task'),
    context: z.record(z.any()).optional().describe('Shared context for all workflow agents'),
  }),
  execute: async ({ workflowName, initialInput, context }) => {
    // This tool streams subagent-created, subagent-started, etc. events
    // through your streaming endpoint
    return {
      workflowId: `wf-${Date.now()}`,
      status: 'started',
      message: `Workflow "${workflowName}" initiated with input: "${initialInput}"`,
    };
  },
});

export const swarmTool = tool({
  description: 'Initiate a swarm pattern where agents autonomously hand off tasks',
  parameters: z.object({
    task: z.string().describe('Main task for the swarm to collaborate on'),
    context: z.record(z.any()).optional().describe('Shared context for all swarm agents'),
  }),
  execute: async ({ task, context }) => {
    return {
      swarmId: `swm-${Date.now()}`,
      status: 'started',
      message: `Swarm collaboration initiated for task: "${task}"`,
    };
  },
});

export const graphTool = tool({
  description: 'Execute a graph pattern where LLM decides routing between agents',
  parameters: z.object({
    query: z.string().describe('Query or task for the graph to route through agents'),
    context: z.record(z.any()).optional().describe('Shared context for all graph agents'),
  }),
  execute: async ({ query, context }) => {
    return {
      graphId: `gr-${Date.now()}`,
      status: 'started',
      message: `Graph execution initiated for query: "${query}"`,
    };
  },
});

// Sub-agent tool: use_agent (available to subagents)
export const useAgentTool = tool({
  description: 'Delegate task to a specialized sub-agent',
  parameters: z.object({
    agentRole: z.string().describe('Role/specialization of the sub-agent'),
    task: z.string().describe('Task to delegate'),
  }),
  execute: async ({ agentRole, task }) => {
    return {
      subAgentId: `sub-${Date.now()}`,
      role: agentRole,
      status: 'started',
      message: `Sub-agent (${agentRole}) initiated for task: "${task}"`,
    };
  },
});
```

### Event Emission from Orchestration Logic

```typescript
// lib/orchestration.ts
import { Readable } from 'stream';

export async function* streamWorkflow(
  prompt: string,
  context: Record<string, any>
) {
  // Simulate or invoke actual workflow orchestration
  
  // Step 1: Emit subagent-created for each task
  yield {
    type: 'subagent-created',
    agentId: 'research-agent-1',
    agentName: 'Research Assistant',
    model: 'claude-3.5-sonnet',
    prompt: 'Search for information about the user query',
    toolsAllowed: ['web_search', 'use_agent'],
    executionOrder: 1,
    position: { x: 100, y: 50 },
  };

  yield {
    type: 'subagent-created',
    agentId: 'analysis-agent-2',
    agentName: 'Analysis Specialist',
    model: 'gpt-4',
    prompt: 'Analyze the research findings',
    toolsAllowed: ['use_agent'],
    executionOrder: 2,
    position: { x: 100, y: 200 },
  };

  // Step 2: Start first agent
  yield {
    type: 'subagent-started',
    agentId: 'research-agent-1',
    timestamp: Date.now(),
  };

  // Step 3: Emit reasoning events as they occur
  yield {
    type: 'reasoning',
    agentId: 'research-agent-1',
    step: 1,
    content: 'I will search for the latest information on this topic...',
    timestamp: Date.now(),
  };

  // Step 4: Emit tool calls
  yield {
    type: 'tool-call',
    agentId: 'research-agent-1',
    toolName: 'web_search',
    arguments: { query: prompt, maxResults: 5 },
    timestamp: Date.now(),
  };

  // Step 5: Emit tool results
  yield {
    type: 'search-result',
    agentId: 'research-agent-1',
    query: prompt,
    results: [
      {
        title: 'Result 1',
        url: 'https://example.com/1',
        snippet: 'This is a relevant result...',
      },
      // ... more results
    ],
    timestamp: Date.now(),
  };

  // Step 6: Complete first agent
  yield {
    type: 'subagent-completed',
    agentId: 'research-agent-1',
    output: 'Found 5 relevant sources on the topic...',
    executionTime: 5234,
    timestamp: Date.now(),
  };

  // Step 7: Start second agent
  yield {
    type: 'subagent-started',
    agentId: 'analysis-agent-2',
    timestamp: Date.now(),
  };

  // ... continue with analysis agent events
}

export async function* streamSwarm(
  prompt: string,
  context: Record<string, any>
) {
  // Swarm pattern: agents autonomously hand off
  // Similar event emission as workflow
}

export async function* streamGraph(
  prompt: string,
  context: Record<string, any>
) {
  // Graph pattern: LLM-driven routing
  // Similar event emission as workflow
}
```

---

## UI/UX Design Considerations

### Color Scheme (Using Vercel Design System)
- **Active Node Glow**: `#22c55e` (green-500) with animated glow
- **Node Default**: `#3b82f6` (blue-500)
- **Selected Node Border**: `#fbbf24` (amber-400)
- **Connection Lines**: Vary by type (parallel: purple, conditional: amber, handoff: pink)

### Responsive Design
- Left pane (70%) may stack to full-width on tablets
- Right pane (30%) may slide as overlay on mobile
- Consider mobile-friendly tab scrolling

### Accessibility
- Ensure keyboard navigation of tabs
- ARIA labels for active/streaming agents
- Color not the only indicator of state (use icons, animations)
- Sufficient contrast for text on colored backgrounds

---

## Performance Optimizations

1. **Virtualization**: For large CoT step lists, virtualize rendering
2. **Memoization**: Memoize component renders to prevent unnecessary re-renders
3. **Streaming Backpressure**: Handle slow client connections with buffering
4. **Lazy Loading**: Defer sub-agent details until tab clicked
5. **WebSocket vs EventSource**: Consider WebSocket for bidirectional streaming if needed

---

## Next Steps

1. **Install dependencies**:
   ```bash
   npm install reactflow @vercel/ai @vercel/ai-rsc
   ```

2. **Set up streaming endpoint** in your Next.js API route

3. **Implement orchestration tools** in your agent definition

4. **Test with mock data** before integrating live orchestration

5. **Deploy and monitor** streaming performance at scale

---

**End of Blueprint**
