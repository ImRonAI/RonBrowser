/**
 * Canvas Test Component
 *
 * Simple test component to verify the updated canvas components
 * match the clean, minimal style of AIElementsShowcase.
 */

import { AgentGraphCanvas } from '@/components/ai-elements/agent-graph-canvas'
import { AgentWorkflowCanvas } from '@/components/ai-elements/agent-workflow-canvas'
import { AgentSwarmCanvas } from '@/components/ai-elements/agent-swarm-canvas'

export function CanvasTest() {
  return (
    <div className="p-8 space-y-8 bg-surface-50 dark:bg-surface-900 min-h-screen">
      <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-100">
        Agent Canvas Components - Clean Minimal Style
      </h1>

      {/* Graph Canvas */}
      <div className="space-y-2">
        <h2 className="text-lg font-medium text-surface-800 dark:text-surface-200">
          Agent Graph Canvas
        </h2>
        <div className="h-[280px] w-full rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
          <AgentGraphCanvas
            showStats={false}
            showControls={false}
            showTimeline={false}
            showMiniMap={false}
          />
        </div>
      </div>

      {/* Workflow Canvas */}
      <div className="space-y-2">
        <h2 className="text-lg font-medium text-surface-800 dark:text-surface-200">
          Agent Workflow Canvas
        </h2>
        <div className="h-[280px] w-full rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
          <AgentWorkflowCanvas
            showStepBadges={false}
            showControls={false}
            showMiniMap={false}
            showProgressBar={false}
          />
        </div>
      </div>

      {/* Swarm Canvas */}
      <div className="space-y-2">
        <h2 className="text-lg font-medium text-surface-800 dark:text-surface-200">
          Agent Swarm Canvas
        </h2>
        <div className="h-[280px] w-full rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
          <AgentSwarmCanvas
            showStatusPanel={false}
            showControls={false}
            showMiniMap={false}
            showHandoffHistory={false}
            showEntryBadges={false}
          />
        </div>
      </div>
    </div>
  )
}