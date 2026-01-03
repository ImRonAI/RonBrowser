/**
 * Chain of Thought - Agent Components
 * 
 * Collapsible agent task for visualizing sub-agent orchestration.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'
import type { TaskStatus } from './task'

// ─────────────────────────────────────────────────────────────────────────────
// CollapsibleAgentTask
// ─────────────────────────────────────────────────────────────────────────────

interface CollapsibleAgentTaskProps {
  agentName: string
  agentDescription?: string
  agentIcon?: React.ReactNode
  status: TaskStatus
  handoffReason?: string
  tools?: string[]
  modelId?: string
  children: React.ReactNode
  defaultExpanded?: boolean
  className?: string
}

export function CollapsibleAgentTask({
  agentName,
  agentDescription,
  agentIcon,
  status,
  handoffReason,
  tools,
  modelId,
  children,
  defaultExpanded = false,
  className
}: CollapsibleAgentTaskProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border overflow-hidden',
        status === 'running' 
          ? 'border-accent/50 dark:border-accent-light/50 shadow-sm shadow-accent/10'
          : status === 'success'
            ? 'border-green-300 dark:border-green-800'
            : status === 'error'
              ? 'border-red-300 dark:border-red-800'
              : 'border-surface-200 dark:border-surface-700',
        className
      )}
    >
      {/* Agent Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full p-3 flex items-center gap-3 text-left',
          'bg-surface-50 dark:bg-surface-800',
          'hover:bg-surface-100 dark:hover:bg-surface-750',
          'transition-colors duration-200'
        )}
      >
        {/* Agent Avatar */}
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          status === 'running' 
            ? 'bg-accent/10 dark:bg-accent-light/10'
            : status === 'success'
              ? 'bg-green-100 dark:bg-green-900/30'
              : status === 'error'
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-surface-200 dark:bg-surface-700'
        )}>
          {status === 'running' ? (
            <Loader size={16} />
          ) : agentIcon ? (
            agentIcon
          ) : (
            <AgentIcon className={cn(
              'w-4 h-4',
              status === 'success' 
                ? 'text-green-600 dark:text-green-400'
                : status === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-ink-muted dark:text-ink-inverse-muted'
            )} />
          )}
        </div>

        {/* Agent Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-body-sm font-semibold text-ink dark:text-ink-inverse">
              {agentName}
            </span>
            {modelId && (
              <span className="text-label px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-700 text-ink-muted dark:text-ink-inverse-muted">
                {modelId}
              </span>
            )}
            {status === 'success' && (
              <CheckIcon className="w-4 h-4 text-green-500" />
            )}
            {status === 'error' && (
              <XIcon className="w-4 h-4 text-red-500" />
            )}
          </div>
          
          {agentDescription && (
            <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary mt-0.5 truncate">
              {agentDescription}
            </p>
          )}
          
          {handoffReason && status === 'running' && (
            <p className="text-body-xs text-accent dark:text-accent-light mt-1 italic">
              "{handoffReason}"
            </p>
          )}
        </div>

        {/* Tools badges */}
        {tools && tools.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
            {tools.slice(0, 2).map(tool => (
              <span 
                key={tool}
                className="text-label px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-700 text-ink-muted dark:text-ink-inverse-muted"
              >
                {tool}
              </span>
            ))}
            {tools.length > 2 && (
              <span className="text-label text-ink-muted dark:text-ink-inverse-muted">+{tools.length - 2}</span>
            )}
          </div>
        )}

        {/* Chevron */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDownIcon className="w-4 h-4 text-ink-muted dark:text-ink-inverse-muted" />
        </motion.div>
      </button>

      {/* Agent's Actions (nested content) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-2 space-y-3 border-t border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-850">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentHandoff - Shows handoff between agents
// ─────────────────────────────────────────────────────────────────────────────

interface AgentHandoffProps {
  fromAgent: string
  toAgent: string
  reason?: string
  className?: string
}

export function AgentHandoff({
  fromAgent,
  toAgent,
  reason,
  className
}: AgentHandoffProps) {
  return (
    <div className={cn(
      'flex items-center gap-3 p-2 rounded-lg',
      'bg-surface-50 dark:bg-surface-800',
      className
    )}>
      <div className="flex items-center gap-2 text-body-xs">
        <span className="font-medium text-ink dark:text-ink-inverse">{fromAgent}</span>
        <ArrowRightIcon className="w-4 h-4 text-accent dark:text-accent-light" />
        <span className="font-medium text-ink dark:text-ink-inverse">{toAgent}</span>
      </div>
      {reason && (
        <span className="text-body-xs text-ink-muted dark:text-ink-inverse-muted italic">
          "{reason}"
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentThinking - Shows agent thinking indicator
// ─────────────────────────────────────────────────────────────────────────────

interface AgentThinkingProps {
  agentName: string
  className?: string
}

export function AgentThinking({
  agentName,
  className
}: AgentThinkingProps) {
  return (
    <div className={cn(
      'flex items-center gap-2 p-2',
      className
    )}>
      <motion.div
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="flex items-center gap-1"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-accent dark:bg-accent-light" />
        <div className="w-1.5 h-1.5 rounded-full bg-accent dark:bg-accent-light" />
        <div className="w-1.5 h-1.5 rounded-full bg-accent dark:bg-accent-light" />
      </motion.div>
      <span className="text-body-xs text-ink-muted dark:text-ink-inverse-muted italic">
        {agentName} is thinking...
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function AgentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 1 0-16 0" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}


