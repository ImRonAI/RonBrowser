/**
 * Graph Orchestration Task Wrapper
 *
 * Wraps AgentGraphCanvas with a 70/30 split layout and subagent panel.
 * Derives active/complete state from orchestrationStore graph data.
 */

import { AgentFormationAccordion } from '@/components/ai-elements/formation-components/AgentFormationAccordion';
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

  const hasNodes = graphNodes.length > 0;
  const hasRunning = graphNodes.some((node) => node.data.status === 'running');
  const hasPending = graphNodes.some(
    (node) => node.data.status === 'pending' || node.data.status === 'idle'
  );
  const isFormationActive = hasRunning;
  const isFormationComplete = hasNodes && !hasRunning && !hasPending;

  return (
    <AgentFormationAccordion
      formationType="graph"
      isFormationActive={isFormationActive}
      isFormationComplete={isFormationComplete}
      title={title}
      description={description}
      defaultExpanded={defaultExpanded}
      className={className}
      onGraphNodeClick={onNodeClick}
      onGraphEdgeClick={onEdgeClick}
    />
  );
}
