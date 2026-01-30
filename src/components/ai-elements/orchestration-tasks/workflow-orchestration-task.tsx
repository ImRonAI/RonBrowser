/**
 * Workflow Orchestration Task Wrapper
 *
 * Wraps AgentWorkflowCanvas with a 70/30 split layout and subagent panel.
 * Derives active/complete state from orchestrationStore workflow data.
 */

import { AgentFormationAccordion } from '@/components/ai-elements/formation-components/AgentFormationAccordion';
import { useOrchestrationStore } from '@/stores/orchestrationStore';
import type { WorkflowTask } from '@/components/ai-elements/strands-orchestration/types';

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowOrchestrationTask Component
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowOrchestrationTaskProps {
  title?: string;
  description?: string;
  defaultExpanded?: boolean;
  className?: string;
  onNodeClick?: (task: WorkflowTask) => void;
  onTaskComplete?: (taskId: string) => void;
  toolInput?: unknown;
}

export function WorkflowOrchestrationTask({
  title = 'Agent Workflow Orchestration',
  description = 'Sequential linear agent execution',
  defaultExpanded = true,
  className,
  onNodeClick,
  toolInput,
}: WorkflowOrchestrationTaskProps) {
  const { workflowTasks } = useOrchestrationStore();

  const hasTasks = workflowTasks.length > 0;
  const hasRunning = workflowTasks.some((task) => task.status === 'running');
  const hasPending = workflowTasks.some((task) => task.status === 'pending');
  const isFormationActive = hasRunning;
  const isFormationComplete = hasTasks && !hasRunning && !hasPending;

  return (
    <AgentFormationAccordion
      formationType="workflow"
      isFormationActive={isFormationActive}
      isFormationComplete={isFormationComplete}
      title={title}
      description={description}
      defaultExpanded={defaultExpanded}
      className={className}
      onWorkflowNodeClick={onNodeClick}
      toolInput={toolInput}
    />
  );
}
