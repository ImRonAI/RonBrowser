/**
 * Graph Orchestration Task Wrapper
 *
 * Wraps AgentGraphCanvas with CollapsibleTask accordion for task UI integration.
 * Derives status from orchestrationStore graph state.
 */

import { CollapsibleTask, type TaskStatus } from '@/components/ai-elements/task';
import { AgentGraphCanvas } from '@/components/ai-elements/agent-graph-canvas';
import { useOrchestrationStore } from '@/stores/orchestrationStore';
import type { StrandsGraphNode, StrandsGraphEdge } from '@/components/ai-elements/strands-orchestration/types';

// ─────────────────────────────────────────────────────────────────────────────
// GraphOrchestrationTask Component
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphOrchestrationTaskProps {
  title?: string;
  description?: string;
  defaultExpanded?: boolean;
  className?: string;
  onNodeClick?: (node: StrandsGraphNode) => void;
  onEdgeClick?: (edge: StrandsGraphEdge) => void;
}

export function GraphOrchestrationTask({
  title = 'Agent Graph Orchestration',
  description = 'Deterministic dependency-driven agent execution',
  defaultExpanded = true,
  className,
  onNodeClick,
  onEdgeClick,
}: GraphOrchestrationTaskProps) {
  const { graphNodes } = useOrchestrationStore();

  // Derive task status from graph state
  const status = deriveGraphStatus(graphNodes);

  return (
    <CollapsibleTask
      title={title}
      description={description}
      status={status}
      defaultExpanded={defaultExpanded}
      className={className}
    >
      <div className="h-[280px] w-full rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
        <AgentGraphCanvas
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          showStats={false}
          showControls={false}
          showTimeline={false}
          showMiniMap={false}
        />
      </div>
    </CollapsibleTask>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function deriveGraphStatus(nodes: StrandsGraphNode[]): TaskStatus {
  if (!nodes || nodes.length === 0) {
    return 'pending';
  }

  const hasRunning = nodes.some((n) => n.data.status === 'running');
  const hasError = nodes.some((n) => n.data.status === 'error');
  const allCompleted = nodes.every((n) => n.data.status === 'completed');

  if (hasError) return 'error';
  if (hasRunning) return 'running';
  if (allCompleted) return 'success';
  return 'pending';
}
