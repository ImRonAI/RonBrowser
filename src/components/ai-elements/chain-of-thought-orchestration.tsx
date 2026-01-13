/**
 * Chain of Thought Orchestration Component
 * 
 * Inline visualization for Strands orchestration tools (workflow, swarm, graph)
 * within the chain of thought. Shows active agents with glowing nodes and
 * animated connecting edges.
 * 
 * Design principles:
 * - Compact inline view (not full React Flow canvas)
 * - Active nodes pulse with subtle purple glow
 * - Edges animate with gradient flow when active
 * - Clean, minimal, premium aesthetic
 */

import { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AgentStatus = 'idle' | 'active' | 'completed' | 'error'

interface OrchestrationAgent {
  id: string
  name: string
  status: AgentStatus
  description?: string
}

interface OrchestrationEdge {
  from: string
  to: string
  isActive: boolean
  label?: string
}

interface WorkflowState {
  agents: OrchestrationAgent[]
  edges: OrchestrationEdge[]
  currentAgent?: string
}

interface SwarmState {
  agents: OrchestrationAgent[]
  handoffs: Array<{ from: string; to: string; message?: string }>
  currentAgent?: string
  history: string[]
}

interface GraphState {
  nodes: OrchestrationAgent[]
  edges: OrchestrationEdge[]
  executionOrder: string[]
  completedNodes: string[]
  currentNodes: string[]
}

interface ChainOfThoughtOrchestrationProps {
  tool: {
    type: string
    toolCallId: string
    toolName?: string
    state: string
    input?: unknown
    output?: unknown
  }
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const ChainOfThoughtOrchestration = memo(function ChainOfThoughtOrchestration({
  tool,
  className,
}: ChainOfThoughtOrchestrationProps) {
  const toolName = (tool.toolName || '').toLowerCase()
  const isStreaming = tool.state === 'input-streaming' || tool.state === 'input-available'
  
  // Parse tool input/output to determine state
  const orchestrationData = useMemo(() => {
    try {
      const data = tool.output || tool.input
      if (!data) return null
      return typeof data === 'string' ? JSON.parse(data) : data
    } catch {
      return null
    }
  }, [tool.input, tool.output])

  if (toolName === 'workflow') {
    return (
      <WorkflowVisualization 
        data={orchestrationData} 
        isStreaming={isStreaming}
        className={className}
      />
    )
  }

  if (toolName === 'swarm') {
    return (
      <SwarmVisualization 
        data={orchestrationData} 
        isStreaming={isStreaming}
        className={className}
      />
    )
  }

  if (toolName === 'graph') {
    return (
      <GraphVisualization 
        data={orchestrationData} 
        isStreaming={isStreaming}
        className={className}
      />
    )
  }

  return null
})

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Visualization - Linear sequence
// ─────────────────────────────────────────────────────────────────────────────

interface WorkflowVisualizationProps {
  data: WorkflowState | null
  isStreaming: boolean
  className?: string
}

const WorkflowVisualization = memo(function WorkflowVisualization({
  data,
  isStreaming,
  className,
}: WorkflowVisualizationProps) {
  const agents = data?.agents || []
  const currentAgent = data?.currentAgent

  if (agents.length === 0 && !isStreaming) return null

  return (
    <div className={cn(
      "rounded-xl border border-violet-200/40 dark:border-violet-500/20",
      "bg-surface-50/50 dark:bg-surface-800/50 backdrop-blur-sm",
      "p-4 my-2",
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <WorkflowIcon className="w-4 h-4 text-violet-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Workflow
        </span>
        {isStreaming && (
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-[10px] text-violet-400"
          >
            Running...
          </motion.span>
        )}
      </div>

      {/* Agent sequence */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {agents.map((agent, index) => (
          <div key={agent.id} className="flex items-center">
            <AgentNode 
              agent={agent} 
              isActive={agent.id === currentAgent || agent.status === 'active'}
            />
            {index < agents.length - 1 && (
              <EdgeLine 
                isActive={
                  agents[index].status === 'completed' && 
                  (agents[index + 1].status === 'active' || agents[index + 1].id === currentAgent)
                }
              />
            )}
          </div>
        ))}
        
        {agents.length === 0 && isStreaming && (
          <div className="flex items-center gap-2">
            <LoadingNode />
            <span className="text-body-xs text-ink-muted">Initializing workflow...</span>
          </div>
        )}
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Swarm Visualization - Agent handoffs
// ─────────────────────────────────────────────────────────────────────────────

interface SwarmVisualizationProps {
  data: SwarmState | null
  isStreaming: boolean
  className?: string
}

const SwarmVisualization = memo(function SwarmVisualization({
  data,
  isStreaming,
  className,
}: SwarmVisualizationProps) {
  const agents = data?.agents || []
  const currentAgent = data?.currentAgent
  const history = data?.history || []

  if (agents.length === 0 && !isStreaming) return null

  return (
    <div className={cn(
      "rounded-xl border border-violet-200/40 dark:border-violet-500/20",
      "bg-surface-50/50 dark:bg-surface-800/50 backdrop-blur-sm",
      "p-4 my-2",
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <SwarmIcon className="w-4 h-4 text-violet-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Swarm
        </span>
        {currentAgent && (
          <span className="text-[10px] text-ink-muted dark:text-ink-inverse-muted">
            Active: {currentAgent}
          </span>
        )}
      </div>

      {/* Agent grid */}
      <div className="flex flex-wrap gap-2 mb-3">
        {agents.map((agent) => (
          <AgentNode 
            key={agent.id}
            agent={agent} 
            isActive={agent.id === currentAgent || agent.status === 'active'}
            showLabel
          />
        ))}
        
        {agents.length === 0 && isStreaming && (
          <LoadingNode />
        )}
      </div>

      {/* Handoff history */}
      {history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-surface-200/60 dark:border-surface-700/60">
          <span className="text-[10px] text-ink-muted dark:text-ink-inverse-muted uppercase tracking-wider">
            Handoff trace
          </span>
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {history.map((agentId, i) => (
              <div key={`${agentId}-${i}`} className="flex items-center">
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded",
                  i === history.length - 1
                    ? "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                    : "bg-surface-100 dark:bg-surface-800 text-ink-muted dark:text-ink-inverse-muted"
                )}>
                  {agentId}
                </span>
                {i < history.length - 1 && (
                  <ArrowRightIcon className="w-3 h-3 text-ink-muted/40 mx-0.5" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Graph Visualization - Dependency graph
// ─────────────────────────────────────────────────────────────────────────────

interface GraphVisualizationProps {
  data: GraphState | null
  isStreaming: boolean
  className?: string
}

const GraphVisualization = memo(function GraphVisualization({
  data,
  isStreaming,
  className,
}: GraphVisualizationProps) {
  const nodes = data?.nodes || []
  const completedNodes = data?.completedNodes || []
  const currentNodes = data?.currentNodes || []

  if (nodes.length === 0 && !isStreaming) return null

  return (
    <div className={cn(
      "rounded-xl border border-violet-200/40 dark:border-violet-500/20",
      "bg-surface-50/50 dark:bg-surface-800/50 backdrop-blur-sm",
      "p-4 my-2",
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <GraphIcon className="w-4 h-4 text-violet-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Graph Execution
        </span>
        {currentNodes.length > 0 && (
          <span className="text-[10px] text-ink-muted">
            {currentNodes.length} active
          </span>
        )}
      </div>

      {/* Node grid with status */}
      <div className="flex flex-wrap gap-2">
        {nodes.map((node) => {
          const isCompleted = completedNodes.includes(node.id)
          const isActive = currentNodes.includes(node.id)
          return (
            <AgentNode 
              key={node.id}
              agent={{
                ...node,
                status: isActive ? 'active' : isCompleted ? 'completed' : node.status
              }}
              isActive={isActive}
              showLabel
            />
          )
        })}
        
        {nodes.length === 0 && isStreaming && (
          <LoadingNode />
        )}
      </div>

      {/* Execution order */}
      {data?.executionOrder && data.executionOrder.length > 0 && (
        <div className="mt-3 pt-3 border-t border-surface-200/60 dark:border-surface-700/60">
          <span className="text-[10px] text-ink-muted dark:text-ink-inverse-muted uppercase tracking-wider">
            Execution order
          </span>
          <div className="flex items-center gap-1 mt-1.5 overflow-x-auto">
            {data.executionOrder.map((nodeId, i) => {
              const isCompleted = completedNodes.includes(nodeId)
              const isCurrent = currentNodes.includes(nodeId)
              return (
                <div key={`${nodeId}-${i}`} className="flex items-center">
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap",
                    isCurrent && "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
                    isCompleted && !isCurrent && "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
                    !isCompleted && !isCurrent && "bg-surface-100 dark:bg-surface-800 text-ink-muted dark:text-ink-inverse-muted"
                  )}>
                    {nodeId}
                  </span>
                  {i < data.executionOrder.length - 1 && (
                    <ArrowRightIcon className="w-3 h-3 text-ink-muted/40 mx-0.5 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────────────────────────────────────

interface AgentNodeProps {
  agent: OrchestrationAgent
  isActive: boolean
  showLabel?: boolean
}

function AgentNode({ agent, isActive, showLabel }: AgentNodeProps) {
  const isCompleted = agent.status === 'completed'
  const isError = agent.status === 'error'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
        "border transition-all duration-300",
        isActive && "border-violet-400/60 dark:border-violet-500/50 bg-violet-50 dark:bg-violet-900/20",
        isCompleted && !isActive && "border-emerald-300/60 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-900/10",
        isError && "border-red-300/60 dark:border-red-500/40 bg-red-50/50 dark:bg-red-900/10",
        !isActive && !isCompleted && !isError && "border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800",
      )}
      style={{
        boxShadow: isActive 
          ? '0 0 16px rgba(139, 92, 246, 0.25)' 
          : 'none',
      }}
    >
      {/* Status indicator */}
      <motion.div
        className={cn(
          "w-2 h-2 rounded-full flex-shrink-0",
          isActive && "bg-violet-500",
          isCompleted && !isActive && "bg-emerald-500",
          isError && "bg-red-500",
          !isActive && !isCompleted && !isError && "bg-ink-muted/30 dark:bg-ink-inverse-muted/30",
        )}
        animate={isActive ? {
          scale: [1, 1.3, 1],
          opacity: [1, 0.7, 1],
        } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      
      {/* Name */}
      {(showLabel || true) && (
        <span className={cn(
          "text-[11px] font-medium whitespace-nowrap",
          isActive && "text-violet-700 dark:text-violet-300",
          isCompleted && !isActive && "text-emerald-700 dark:text-emerald-300",
          isError && "text-red-700 dark:text-red-300",
          !isActive && !isCompleted && !isError && "text-ink-muted dark:text-ink-inverse-muted",
        )}>
          {agent.name}
        </span>
      )}

      {/* Completed checkmark */}
      {isCompleted && !isActive && (
        <CheckIcon className="w-3 h-3 text-emerald-500 flex-shrink-0" />
      )}
    </motion.div>
  )
}

function EdgeLine({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative w-6 h-px mx-1">
      <div className={cn(
        "absolute inset-0 transition-colors duration-300",
        isActive 
          ? "bg-gradient-to-r from-violet-400 to-violet-500" 
          : "bg-surface-300 dark:bg-surface-600"
      )} />
      {isActive && (
        <motion.div
          className="absolute inset-y-0 w-2 bg-violet-300/50"
          animate={{ left: ['-8px', 'calc(100% + 8px)'] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  )
}

function LoadingNode() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700">
      <motion.div
        className="w-2 h-2 rounded-full bg-violet-400"
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      <span className="text-[11px] text-ink-muted">Loading...</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function WorkflowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="9" y="15" width="6" height="6" rx="1" />
      <path d="M9 6h6" />
      <path d="M12 9v6" />
    </svg>
  )
}

function SwarmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 9V5M15 12h4M12 15v4M9 12H5" />
    </svg>
  )
}

function GraphIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="3" />
      <circle cx="19" cy="6" r="3" />
      <circle cx="19" cy="18" r="3" />
      <path d="M8 12h4M12 12l4-4M12 12l4 4" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default ChainOfThoughtOrchestration
