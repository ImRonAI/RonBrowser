/**
 * Workflow Orchestration Task Wrapper
 *
 * Wraps AgentWorkflowCanvas with CollapsibleTask accordion for task UI integration.
 * Derives status from orchestrationStore workflow state.
 */

import { CollapsibleTask, type TaskStatus } from '@/components/ai-elements/task';
import { AgentWorkflowCanvas } from '@/components/ai-elements/agent-workflow-canvas';
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
}

export function WorkflowOrchestrationTask({
  title = 'Agent Workflow Orchestration',
  description = 'Sequential linear agent execution',
  defaultExpanded = true,
  className,
  onNodeClick,
  onTaskComplete,
}: WorkflowOrchestrationTaskProps) {
  const { workflowTasks } = useOrchestrationStore();

  // Derive task status from workflow state
  const status = deriveWorkflowStatus(workflowTasks);

  return (
    <CollapsibleTask
      title={title}
      description={description}
      status={status}
      defaultExpanded={defaultExpanded}
      className={className}
    >
      <div className="h-[280px] w-full rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
        <AgentWorkflowCanvas
          onNodeClick={onNodeClick}
          onTaskComplete={onTaskComplete}
          showStepBadges={false}
          showControls={false}
          showMiniMap={false}
          showProgressBar={false}
        />
      </div>
    </CollapsibleTask>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function deriveWorkflowStatus(tasks: WorkflowTask[]): TaskStatus {
  if (!tasks || tasks.length === 0) {
    return 'pending';
  }

  const hasRunning = tasks.some((t) => t.status === 'running');
  const hasError = tasks.some((t) => t.status === 'error');
  const allCompleted = tasks.every((t) => t.status === 'completed');

  if (hasError) return 'error';
  if (hasRunning) return 'running';
  if (allCompleted) return 'success';
  return 'pending';
}
