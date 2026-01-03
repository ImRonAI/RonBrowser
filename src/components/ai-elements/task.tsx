/**
 * Task Components
 * 
 * Display AI task execution and progress tracking.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'

// ─────────────────────────────────────────────────────────────────────────────
// Task
// ─────────────────────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled'

interface TaskProps {
  children: React.ReactNode
  className?: string
}

export function Task({ children, className }: TaskProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-xl border border-surface-200 dark:border-surface-700',
        'bg-surface-0 dark:bg-surface-800',
        'overflow-hidden',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CollapsibleTask - Accordion variant of Task
// ─────────────────────────────────────────────────────────────────────────────

interface CollapsibleTaskProps {
  title: string
  description?: string
  status: TaskStatus
  children: React.ReactNode
  defaultExpanded?: boolean
  className?: string
  onToggle?: (expanded: boolean) => void
}

export function CollapsibleTask({ 
  title, 
  description, 
  status, 
  children, 
  defaultExpanded = false,
  className,
  onToggle,
}: CollapsibleTaskProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const handleToggle = () => {
    const next = !isExpanded
    setIsExpanded(next)
    onToggle?.(next)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-xl border border-surface-200 dark:border-surface-700',
        'bg-surface-0 dark:bg-surface-800',
        'overflow-hidden',
        className
      )}
    >
      {/* Clickable Header */}
      <button
        onClick={handleToggle}
        className={cn(
          'w-full p-4 flex items-start gap-3 text-left',
          'hover:bg-surface-50 dark:hover:bg-surface-750',
          'transition-colors duration-200',
          isExpanded && 'border-b border-surface-200 dark:border-surface-700'
        )}
      >
        <TaskStatusIndicator status={status} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-body-sm font-semibold text-ink dark:text-ink-inverse truncate">
              {title}
            </h4>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDownIcon className="w-4 h-4 text-ink-muted dark:text-ink-inverse-muted" />
            </motion.div>
          </div>
          
          {description && (
            <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary mt-0.5">
              {description}
            </p>
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="p-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskHeader
// ─────────────────────────────────────────────────────────────────────────────

interface TaskHeaderProps {
  title: string
  description?: string
  status: TaskStatus
  progress?: number // 0-100
  className?: string
}

export function TaskHeader({ title, description, status, progress, className }: TaskHeaderProps) {
  return (
    <div className={cn('p-4 border-b border-surface-200 dark:border-surface-700', className)}>
      <div className="flex items-start gap-3">
        <TaskStatusIndicator status={status} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-body-sm font-semibold text-ink dark:text-ink-inverse truncate">
              {title}
            </h4>
            {progress !== undefined && status === 'running' && (
              <span className="text-label text-ink-muted dark:text-ink-inverse-muted">
                {progress}%
              </span>
            )}
          </div>
          
          {description && (
            <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary mt-0.5">
              {description}
            </p>
          )}
          
          {/* Progress bar */}
          {progress !== undefined && status === 'running' && (
            <div className="mt-2 h-1 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-accent dark:bg-accent-light rounded-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskStatusIndicator
// ─────────────────────────────────────────────────────────────────────────────

interface TaskStatusIndicatorProps {
  status: TaskStatus
  size?: 'sm' | 'md'
}

export function TaskStatusIndicator({ status, size = 'md' }: TaskStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
  }

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  }

  const config = {
    pending: { 
      bg: 'bg-surface-200 dark:bg-surface-700', 
      color: 'text-ink-muted dark:text-ink-inverse-muted',
      icon: ClockIcon 
    },
    running: { 
      bg: 'bg-accent/10 dark:bg-accent-light/10', 
      color: 'text-accent dark:text-accent-light',
      icon: null // Use loader
    },
    success: { 
      bg: 'bg-green-100 dark:bg-green-900/30', 
      color: 'text-green-600 dark:text-green-400',
      icon: CheckIcon 
    },
    error: { 
      bg: 'bg-red-100 dark:bg-red-900/30', 
      color: 'text-red-600 dark:text-red-400',
      icon: XIcon 
    },
    cancelled: { 
      bg: 'bg-surface-200 dark:bg-surface-700', 
      color: 'text-ink-muted dark:text-ink-inverse-muted',
      icon: MinusIcon 
    },
  }

  const { bg, color, icon: IconComponent } = config[status]

  return (
    <div className={cn('rounded-lg flex items-center justify-center flex-shrink-0', bg, sizeClasses[size])}>
      {status === 'running' ? (
        <Loader size={size === 'sm' ? 12 : 14} />
      ) : IconComponent ? (
        <IconComponent className={cn(iconSize[size], color)} />
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskContent
// ─────────────────────────────────────────────────────────────────────────────

interface TaskContentProps {
  children: React.ReactNode
  className?: string
}

export function TaskContent({ children, className }: TaskContentProps) {
  return (
    <div className={cn('p-4', className)}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskOutput
// ─────────────────────────────────────────────────────────────────────────────

interface TaskOutputProps {
  output?: string
  error?: string
  className?: string
}

export function TaskOutput({ output, error, className }: TaskOutputProps) {
  const hasError = !!error
  const content = error || output

  if (!content) return null

  return (
    <div className={cn('p-4 pt-0', className)}>
      <pre className={cn(
        'p-3 rounded-lg text-body-xs font-mono overflow-x-auto',
        hasError
          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          : 'bg-surface-100 dark:bg-surface-900 text-ink dark:text-ink-inverse'
      )}>
        {content}
      </pre>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskList
// ─────────────────────────────────────────────────────────────────────────────

interface TaskListProps {
  children: React.ReactNode
  className?: string
}

export function TaskList({ children, className }: TaskListProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <AnimatePresence mode="popLayout">
        {children}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskItem (Compact version for lists)
// ─────────────────────────────────────────────────────────────────────────────

interface TaskItemProps {
  title: string
  status: TaskStatus
  duration?: number // In milliseconds
  className?: string
}

export function TaskItem({ title, status, duration, className }: TaskItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg',
        'bg-surface-50 dark:bg-surface-800',
        className
      )}
    >
      <TaskStatusIndicator status={status} size="sm" />
      
      <span className="flex-1 text-body-sm text-ink dark:text-ink-inverse truncate">
        {title}
      </span>
      
      {duration !== undefined && status === 'success' && (
        <span className="text-label text-ink-muted dark:text-ink-inverse-muted">
          {formatDuration(duration)}
        </span>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = seconds / 60
  return `${minutes.toFixed(1)}m`
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
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

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
