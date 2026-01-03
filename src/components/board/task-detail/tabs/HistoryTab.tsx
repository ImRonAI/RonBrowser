/**
 * History Tab - Task Changelog
 * 
 * A comprehensive changelog view showing all changes throughout a task's lifecycle.
 * Critical for compliance and accountability.
 * 
 * Features:
 * - Chronological display of all events
 * - Grouped by date
 * - AI-generated natural language summary
 * - Filter by event type
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Task, TaskHistoryEvent, TaskHistoryEventType } from '@/types/task'

// Sophisticated easing
const EASE = [0.16, 1, 0.3, 1] as const

interface HistoryTabProps {
  task: Task
}

type FilterType = 'all' | 'status' | 'assignment' | 'content' | 'ai'

const FILTER_OPTIONS: { type: FilterType; label: string }[] = [
  { type: 'all', label: 'All' },
  { type: 'status', label: 'Status' },
  { type: 'assignment', label: 'Assignment' },
  { type: 'content', label: 'Content' },
  { type: 'ai', label: 'AI' },
]

export function HistoryTab({ task }: HistoryTabProps) {
  const [filter, setFilter] = useState<FilterType>('all')

  // Generate sample history if none exists
  const history: TaskHistoryEvent[] = useMemo(() => {
    if (task.history && task.history.length > 0) return task.history
    
    // Generate mock history based on task data
    return generateMockHistory(task)
  }, [task])

  // Filter history
  const filteredHistory = useMemo(() => {
    if (filter === 'all') return history
    
    const typeMapping: Record<FilterType, TaskHistoryEventType[]> = {
      all: [],
      status: ['status_changed', 'created'],
      assignment: ['assignee_changed'],
      content: ['field_updated', 'comment_added', 'document_attached', 'subtask_created', 'subtask_completed'],
      ai: ['ai_interaction'],
    }
    
    return history.filter(event => typeMapping[filter].includes(event.type))
  }, [history, filter])

  // Group history by date
  const groupedHistory = useMemo(() => {
    const groups: Record<string, TaskHistoryEvent[]> = {}
    
    filteredHistory.forEach(event => {
      const date = new Date(event.timestamp).toDateString()
      if (!groups[date]) groups[date] = []
      groups[date].push(event)
    })
    
    return Object.entries(groups).sort((a, b) => 
      new Date(b[0]).getTime() - new Date(a[0]).getTime()
    )
  }, [filteredHistory])

  // Calculate summary stats
  const stats = useMemo(() => ({
    totalEvents: history.length,
    daysActive: Math.ceil((Date.now() - task.createdAt) / (1000 * 60 * 60 * 24)),
    statusChanges: history.filter(e => e.type === 'status_changed').length,
    aiInteractions: history.filter(e => e.type === 'ai_interaction').length,
  }), [history, task.createdAt])

  return (
    <div className="h-full flex flex-col">
      {/* Summary Header */}
      <div className="flex-shrink-0 px-6 pt-4 pb-3 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-body-lg font-semibold text-ink dark:text-ink-inverse">
            Task History
          </h3>
          <div className="flex items-center gap-4 text-body-xs text-ink-muted dark:text-ink-inverse-muted">
            <span>{stats.totalEvents} events</span>
            <span>•</span>
            <span>{stats.daysActive} days active</span>
          </div>
        </div>

        {/* AI Summary */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="
            p-3 rounded-xl mb-4
            bg-gradient-to-r from-accent/5 via-accent/10 to-accent/5
            dark:from-accent-light/5 dark:via-accent-light/10 dark:to-accent-light/5
            border border-accent/10 dark:border-accent-light/10
          "
        >
          <div className="flex items-start gap-2">
            <SparklesIcon className="w-4 h-4 text-accent dark:text-accent-light mt-0.5" />
            <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary">
              This task was created {stats.daysActive} days ago, has been reassigned {stats.statusChanges} times, 
              and currently has {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks complete.
              {stats.aiInteractions > 0 && ` Ron has assisted ${stats.aiInteractions} times.`}
            </p>
          </div>
        </motion.div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {FILTER_OPTIONS.map(({ type, label }) => (
            <motion.button
              key={type}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(type)}
              className={`
                px-3 py-1.5 rounded-lg
                text-body-xs font-medium
                transition-all duration-200
                ${filter === type 
                  ? 'bg-accent dark:bg-accent-light text-white' 
                  : 'bg-surface-100 dark:bg-surface-800 text-ink-secondary dark:text-ink-inverse-secondary hover:bg-surface-200 dark:hover:bg-surface-700'
                }
              `}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
        {groupedHistory.length > 0 ? (
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {groupedHistory.map(([date, events]) => (
                <DateGroup key={date} date={date} events={events} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyHistoryState />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE GROUP
// ─────────────────────────────────────────────────────────────────────────────

interface DateGroupProps {
  date: string
  events: TaskHistoryEvent[]
}

function DateGroup({ date, events }: DateGroupProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      {/* Date Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="
          text-label uppercase tracking-wider
          text-ink-muted dark:text-ink-inverse-muted
        ">
          {formatDateHeader(new Date(date))}
        </span>
        <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
      </div>

      {/* Events */}
      <div className="relative pl-6">
        {/* Timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-surface-200 dark:bg-surface-700" />

        <div className="space-y-3">
          {events.map((event, index) => (
            <HistoryEventCard key={event.id} event={event} index={index} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY EVENT CARD
// ─────────────────────────────────────────────────────────────────────────────

interface HistoryEventCardProps {
  event: TaskHistoryEvent
  index: number
}

function HistoryEventCard({ event, index }: HistoryEventCardProps) {
  const config = getEventConfig(event.type)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03, ease: EASE }}
      className="relative flex items-start gap-3"
    >
      {/* Timeline dot */}
      <div className={`
        absolute -left-6 top-1
        w-3.5 h-3.5 rounded-full
        ${config.dotColor}
        ring-4 ring-surface-0 dark:ring-surface-850
      `}>
        <span className="absolute inset-1 flex items-center justify-center">
          {config.dotIcon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {/* Actor & Action */}
            <div className="flex items-center gap-2 flex-wrap">
              <ActorBadge actor={event.actor} />
              <span className="text-body-sm text-ink dark:text-ink-inverse">
                {event.description}
              </span>
            </div>

            {/* Changes */}
            {event.changes && event.changes.length > 0 && (
              <div className="mt-2 space-y-1">
                {event.changes.map((change, i) => (
                  <div key={i} className="
                    flex items-center gap-2
                    text-body-xs
                  ">
                    <span className="text-ink-muted dark:text-ink-inverse-muted">
                      {change.field}:
                    </span>
                    {change.oldValue !== undefined && change.oldValue !== null && (
                      <>
                        <span className="
                          px-1.5 py-0.5 rounded
                          bg-danger/10 text-danger
                          line-through
                        ">
                          {String(change.oldValue)}
                        </span>
                        <span className="text-ink-muted">→</span>
                      </>
                    )}
                    <span className="
                      px-1.5 py-0.5 rounded
                      bg-success/10 text-success
                    ">
                      {String(change.newValue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timestamp */}
          <span className="
            flex-shrink-0
            text-body-xs text-ink-muted dark:text-ink-inverse-muted
          ">
            {formatTime(new Date(event.timestamp))}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTOR BADGE
// ─────────────────────────────────────────────────────────────────────────────

function ActorBadge({ actor }: { actor: TaskHistoryEvent['actor'] }) {
  const typeConfig = {
    user: { bg: 'bg-accent dark:bg-accent-light', icon: null },
    system: { bg: 'bg-surface-300 dark:bg-surface-600', icon: <CogIcon className="w-2.5 h-2.5" /> },
    ai: { bg: 'bg-gradient-to-r from-accent to-accent-light', icon: <SparklesIcon className="w-2.5 h-2.5" /> },
  }

  const config = typeConfig[actor.type]

  return (
    <span className="
      inline-flex items-center gap-1.5
      px-2 py-0.5 rounded-md
      bg-surface-100 dark:bg-surface-800
    ">
      <span className={`
        w-4 h-4 rounded-full
        ${config.bg}
        flex items-center justify-center
        text-white text-[8px] font-bold
      `}>
        {config.icon || actor.name.charAt(0).toUpperCase()}
      </span>
      <span className="text-body-xs font-medium text-ink dark:text-ink-inverse">
        {actor.name}
      </span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyHistoryState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="
        h-full flex flex-col items-center justify-center
        p-8 text-center
      "
    >
      <div className="
        w-16 h-16 mb-4 rounded-2xl
        bg-surface-100 dark:bg-surface-800
        flex items-center justify-center
      ">
        <ClockIcon className="w-8 h-8 text-ink-muted dark:text-ink-inverse-muted" />
      </div>
      
      <h3 className="
        text-body-lg font-medium
        text-ink dark:text-ink-inverse
        mb-2
      ">
        No history yet
      </h3>
      
      <p className="
        text-body-sm
        text-ink-muted dark:text-ink-inverse-muted
        max-w-sm
      ">
        Changes to this task will be tracked here automatically.
      </p>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getEventConfig(type: TaskHistoryEventType): {
  dotColor: string
  dotIcon: React.ReactNode
} {
  const configs: Record<TaskHistoryEventType, { dotColor: string; dotIcon: React.ReactNode }> = {
    created: { dotColor: 'bg-success', dotIcon: <PlusIcon className="w-2 h-2 text-white" /> },
    status_changed: { dotColor: 'bg-info', dotIcon: null },
    priority_changed: { dotColor: 'bg-warning', dotIcon: null },
    assignee_changed: { dotColor: 'bg-accent dark:bg-accent-light', dotIcon: null },
    field_updated: { dotColor: 'bg-surface-400', dotIcon: null },
    comment_added: { dotColor: 'bg-violet-500', dotIcon: null },
    document_attached: { dotColor: 'bg-emerald-500', dotIcon: null },
    communication_logged: { dotColor: 'bg-sky-500', dotIcon: null },
    ai_interaction: { dotColor: 'bg-gradient-to-r from-accent to-accent-light', dotIcon: null },
    subtask_created: { dotColor: 'bg-surface-400', dotIcon: null },
    subtask_completed: { dotColor: 'bg-success', dotIcon: null },
    external_sync: { dotColor: 'bg-surface-400', dotIcon: null },
    due_date_changed: { dotColor: 'bg-warning', dotIcon: null },
    label_added: { dotColor: 'bg-violet-500', dotIcon: null },
    label_removed: { dotColor: 'bg-surface-400', dotIcon: null },
  }
  
  return configs[type] || { dotColor: 'bg-surface-400', dotIcon: null }
}

function formatDateHeader(date: Date): string {
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString()
  const dateStr = date.toDateString()

  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

function generateMockHistory(task: Task): TaskHistoryEvent[] {
  const events: TaskHistoryEvent[] = []
  
  // Created event
  events.push({
    id: `event-created`,
    type: 'created',
    timestamp: task.createdAt,
    actor: { id: 'system', name: 'System', type: 'system' },
    description: 'created this task',
  })

  // Add status changes based on current status
  if (task.status !== 'backlog') {
    events.push({
      id: `event-status-1`,
      type: 'status_changed',
      timestamp: task.createdAt + 1000 * 60 * 60 * 2, // 2 hours after creation
      actor: { id: 'user-1', name: 'Team Member', type: 'user' },
      description: 'changed the status',
      changes: [{ field: 'Status', oldValue: 'Backlog', newValue: task.status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()) }],
    })
  }

  // Add assignee event if there are assignees
  if (task.assignees.length > 0) {
    events.push({
      id: `event-assign`,
      type: 'assignee_changed',
      timestamp: task.createdAt + 1000 * 60 * 30, // 30 mins after creation
      actor: { id: 'user-1', name: 'Manager', type: 'user' },
      description: 'assigned this task',
      changes: [{ field: 'Assignee', newValue: task.assignees.map(a => a.name).join(', ') }],
    })
  }

  // Add subtask events
  task.subtasks.filter(s => s.completed).forEach((subtask, i) => {
    events.push({
      id: `event-subtask-${subtask.id}`,
      type: 'subtask_completed',
      timestamp: task.createdAt + 1000 * 60 * 60 * 24 * (i + 1),
      actor: { id: 'user-1', name: 'Team Member', type: 'user' },
      description: `completed subtask "${subtask.title}"`,
    })
  })

  // Sort by timestamp descending
  return events.sort((a, b) => b.timestamp - a.timestamp)
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CogIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="12" y1="6" x2="12" y2="18" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </svg>
  )
}

