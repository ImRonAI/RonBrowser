/**
 * Swarm Orchestration Task Wrapper
 *
 * Wraps AgentSwarmCanvas with CollapsibleTask accordion for task UI integration.
 * Derives status from orchestrationStore swarm state.
 */

import { CollapsibleTask, type TaskStatus } from '@/components/ai-elements/task';
import { AgentSwarmCanvas } from '@/components/ai-elements/agent-swarm-canvas';
import { useOrchestrationStore } from '@/stores/orchestrationStore';
import type { StrandsSwarmNode, HandoffMessage } from '@/components/ai-elements/strands-orchestration/types';

// ─────────────────────────────────────────────────────────────────────────────
// SwarmOrchestrationTask Component
// ─────────────────────────────────────────────────────────────────────────────

export interface SwarmOrchestrationTaskProps {
  title?: string;
  description?: string;
  defaultExpanded?: boolean;
  className?: string;
  onNodeClick?: (node: StrandsSwarmNode) => void;
  onHandoff?: (handoff: HandoffMessage) => void;
}

export function SwarmOrchestrationTask({
  title = 'Agent Swarm Orchestration',
  description = 'Dynamic handoff-based agent execution',
  defaultExpanded = true,
  className,
  onNodeClick,
  onHandoff,
}: SwarmOrchestrationTaskProps) {
  const { swarmNodes } = useOrchestrationStore();

  // Derive task status from swarm state
  const status = deriveSwarmStatus(swarmNodes);

  return (
    <CollapsibleTask
      title={title}
      description={description}
      status={status}
      defaultExpanded={defaultExpanded}
      className={className}
    >
      <div className="h-[280px] w-full rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
        <AgentSwarmCanvas
          onNodeClick={onNodeClick}
          onHandoffClick={onHandoff}
          showStatusPanel={false}
          showControls={false}
          showMiniMap={false}
          showHandoffHistory={false}
          showEntryBadges={false}
        />
      </div>
    </CollapsibleTask>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function deriveSwarmStatus(nodes: StrandsSwarmNode[]): TaskStatus {
  if (!nodes || nodes.length === 0) {
    return 'pending';
  }

  const hasRunning = nodes.some((n) => n.data.status === 'running' || n.data.status === 'handoff');
  const hasError = nodes.some((n) => n.data.status === 'error');
  const allCompleted = nodes.every((n) => n.data.status === 'completed');

  if (hasError) return 'error';
  if (hasRunning) return 'running';
  if (allCompleted) return 'success';
  return 'pending';
}
