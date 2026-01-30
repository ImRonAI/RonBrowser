/**
 * Swarm Orchestration Task Wrapper
 *
 * Wraps AgentSwarmCanvas with a 70/30 split layout and subagent panel.
 * Derives active/complete state from orchestrationStore swarm data.
 */

import { AgentFormationAccordion } from '@/components/ai-elements/formation-components/AgentFormationAccordion';
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
  toolInput?: unknown;
}

export function SwarmOrchestrationTask({
  title = 'Agent Swarm Orchestration',
  description = 'Dynamic handoff-based agent execution',
  defaultExpanded = true,
  className,
  onNodeClick,
  onHandoff,
  toolInput,
}: SwarmOrchestrationTaskProps) {
  const { swarmNodes } = useOrchestrationStore();

  const hasNodes = swarmNodes.length > 0;
  const hasActive = swarmNodes.some((node) =>
    node.data.status === 'running' || node.data.status === 'handoff'
  );
  const hasPending = swarmNodes.some(
    (node) => node.data.status === 'pending' || node.data.status === 'idle'
  );
  const isFormationActive = hasActive;
  const isFormationComplete = hasNodes && !hasActive && !hasPending;

  return (
    <AgentFormationAccordion
      formationType="swarm"
      isFormationActive={isFormationActive}
      isFormationComplete={isFormationComplete}
      title={title}
      description={description}
      defaultExpanded={defaultExpanded}
      className={className}
      onSwarmNodeClick={onNodeClick}
      onSwarmHandoff={onHandoff}
      toolInput={toolInput}
    />
  );
}
