import { motion } from 'framer-motion'
import type { Task, TaskPriority, TaskStatus, TaskLabel } from '@/types/task'
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/types/task'

interface TaskMetadataSidebarProps {
  task: Task
  onUpdate?: (task: Task) => void
}

export function TaskMetadataSidebar({ task }: TaskMetadataSidebarProps) {
  return (
    <div className="
      w-80 flex-shrink-0
      bg-surface-50/50 dark:bg-surface-800/30
      overflow-y-auto scrollbar-thin
    ">
      <div className="p-5 space-y-6">
        {/* Status */}
        <MetadataSection title="Status">
          <StatusSelect value={task.status} />
        </MetadataSection>

        {/* Priority */}
        <MetadataSection title="Priority">
          <PrioritySelect value={task.priority} />
        </MetadataSection>

        {/* Assignees */}
        <MetadataSection title="Assignees">
          <AssigneeList assignees={task.assignees} />
        </MetadataSection>

        {/* Due Date */}
        <MetadataSection title="Due Date">
          <DateDisplay date={task.dueDate} />
        </MetadataSection>

        {/* Labels */}
        {task.labels.length > 0 && (
          <MetadataSection title="Labels">
            <LabelList labels={task.labels} />
          </MetadataSection>
        )}

        {/* Progress */}
        {task.subtasks.length > 0 && (
          <MetadataSection title="Progress">
            <ProgressIndicator 
              completed={task.subtasks.filter(s => s.completed).length}
              total={task.subtasks.length}
            />
          </MetadataSection>
        )}

        {/* Estimated Effort */}
        {task.estimatedEffort && (
          <MetadataSection title="Estimated Effort">
            <EffortBadge effort={task.estimatedEffort} />
          </MetadataSection>
        )}

        {/* Time Spent */}
        {task.actualTimeSpent && (
          <MetadataSection title="Time Spent">
            <TimeDisplay minutes={task.actualTimeSpent} />
          </MetadataSection>
        )}

        {/* AI Insights */}
        {(task.complexityScore || task.riskScore || task.completionConfidence) && (
          <MetadataSection title="AI Insights">
            <AIInsights task={task} />
          </MetadataSection>
        )}

        {/* Dependencies */}
        {task.dependencies && task.dependencies.length > 0 && (
          <MetadataSection title="Dependencies">
            <DependencyList dependencies={task.dependencies} />
          </MetadataSection>
        )}

        {/* Links & Integrations */}
        <MetadataSection title="Links">
          <LinksList task={task} />
        </MetadataSection>

        {/* Timestamps */}
        <MetadataSection title="Dates">
          <TimestampsList task={task} />
        </MetadataSection>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// METADATA SECTION
// ─────────────────────────────────────────────────────────────────────────────

interface MetadataSectionProps {
  title: string
  children: React.ReactNode
}

function MetadataSection({ title, children }: MetadataSectionProps) {
  return (
    <div className="space-y-2">
      <h4 className="
        text-label uppercase tracking-wider
        text-ink-muted dark:text-ink-inverse-muted
      ">
        {title}
      </h4>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS SELECT
// ─────────────────────────────────────────────────────────────────────────────

function StatusSelect({ value }: { value: TaskStatus }) {
  const config = TASK_STATUS_CONFIG[value]
  
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        w-full
        flex items-center gap-2
        px-3 py-2 rounded-lg
        ${config.bgColor}
        hover:ring-2 hover:ring-accent/20 dark:hover:ring-accent-light/20
        transition-all duration-200
      `}
    >
      <span className={`w-2 h-2 rounded-full ${config.color.replace('text-', 'bg-')}`} />
      <span className={`text-body-sm font-medium ${config.color}`}>
        {config.label}
      </span>
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY SELECT
// ─────────────────────────────────────────────────────────────────────────────

function PrioritySelect({ value }: { value?: TaskPriority }) {
  if (!value) {
    return (
      <span className="text-body-sm text-ink-muted dark:text-ink-inverse-muted">
        Not set
      </span>
    )
  }
  
  const config = TASK_PRIORITY_CONFIG[value]
  
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        w-full
        flex items-center gap-2
        px-3 py-2 rounded-lg
        ${config.bgColor}
        hover:ring-2 hover:ring-accent/20 dark:hover:ring-accent-light/20
        transition-all duration-200
      `}
    >
      <PriorityIcon priority={value} />
      <span className={`text-body-sm font-medium ${config.color}`}>
        {config.label}
      </span>
    </motion.button>
  )
}

function PriorityIcon({ priority }: { priority: TaskPriority }) {
  const colors = {
    critical: 'text-danger',
    high: 'text-warning',
    medium: 'text-info',
    low: 'text-surface-400',
  }
  
  return (
    <svg className={`w-4 h-4 ${colors[priority]}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {priority === 'critical' && (
        <>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </>
      )}
      {priority === 'high' && (
        <>
          <polyline points="17 11 12 6 7 11" />
          <polyline points="17 18 12 13 7 18" />
        </>
      )}
      {priority === 'medium' && (
        <line x1="5" y1="12" x2="19" y2="12" />
      )}
      {priority === 'low' && (
        <>
          <polyline points="7 13 12 18 17 13" />
          <polyline points="7 6 12 11 17 6" />
        </>
      )}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNEE LIST
// ─────────────────────────────────────────────────────────────────────────────

function AssigneeList({ assignees }: { assignees: Task['assignees'] }) {
  if (assignees.length === 0) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="
          w-full
          flex items-center justify-center gap-2
          px-3 py-2 rounded-lg
          border border-dashed border-surface-300 dark:border-surface-600
          text-ink-muted dark:text-ink-inverse-muted
          hover:border-accent/50 dark:hover:border-accent-light/50
          hover:text-accent dark:hover:text-accent-light
          transition-all duration-200
        "
      >
        <PlusIcon className="w-4 h-4" />
        <span className="text-body-sm">Add assignee</span>
      </motion.button>
    )
  }

  return (
    <div className="space-y-2">
      {assignees.map((assignee) => (
        <motion.div
          key={assignee.id}
          whileHover={{ x: 2 }}
          className="
            flex items-center gap-3
            px-3 py-2 rounded-lg
            bg-surface-100/50 dark:bg-surface-700/30
            cursor-pointer
            hover:bg-surface-100 dark:hover:bg-surface-700/50
            transition-colors duration-200
          "
        >
          <div className="
            w-7 h-7 rounded-full
            bg-accent dark:bg-accent-light
            flex items-center justify-center
            text-[10px] font-bold text-white
          ">
            {assignee.initials}
          </div>
          <span className="text-body-sm text-ink dark:text-ink-inverse">
            {assignee.name}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE DISPLAY
// ─────────────────────────────────────────────────────────────────────────────

function DateDisplay({ date }: { date?: number | null }) {
  if (!date) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="
          w-full
          flex items-center justify-center gap-2
          px-3 py-2 rounded-lg
          border border-dashed border-surface-300 dark:border-surface-600
          text-ink-muted dark:text-ink-inverse-muted
          hover:border-accent/50 dark:hover:border-accent-light/50
          hover:text-accent dark:hover:text-accent-light
          transition-all duration-200
        "
      >
        <CalendarIcon className="w-4 h-4" />
        <span className="text-body-sm">Set due date</span>
      </motion.button>
    )
  }

  const dateObj = new Date(date)
  const isOverdue = dateObj < new Date()
  const isDueSoon = !isOverdue && (dateObj.getTime() - Date.now()) < 24 * 60 * 60 * 1000

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        w-full
        flex items-center gap-2
        px-3 py-2 rounded-lg
        ${isOverdue 
          ? 'bg-danger/10 text-danger' 
          : isDueSoon 
            ? 'bg-warning/10 text-warning'
            : 'bg-surface-100 dark:bg-surface-700 text-ink dark:text-ink-inverse'
        }
        hover:ring-2 hover:ring-accent/20 dark:hover:ring-accent-light/20
        transition-all duration-200
      `}
    >
      <CalendarIcon className="w-4 h-4" />
      <span className="text-body-sm font-medium">
        {formatDate(dateObj)}
      </span>
      {isOverdue && (
        <span className="text-label ml-auto">OVERDUE</span>
      )}
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LABEL LIST
// ─────────────────────────────────────────────────────────────────────────────

function LabelList({ labels }: { labels: TaskLabel[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <span
          key={label.id}
          className={`
            inline-flex items-center
            px-2.5 py-1 rounded-md
            text-label uppercase tracking-wider
            ${label.color}
          `}
        >
          {label.label}
        </span>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

function ProgressIndicator({ completed, total }: { completed: number; total: number }) {
  const percentage = Math.round((completed / total) * 100)
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-ink dark:text-ink-inverse">
          {completed} of {total} completed
        </span>
        <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
          {percentage}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${percentage === 100 ? 'bg-success' : 'bg-accent dark:bg-accent-light'}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EFFORT BADGE
// ─────────────────────────────────────────────────────────────────────────────

function EffortBadge({ effort }: { effort: Task['estimatedEffort'] }) {
  const label = typeof effort === 'string' 
    ? effort.toUpperCase() 
    : `${effort} points`
  
  return (
    <span className="
      inline-flex items-center
      px-3 py-1.5 rounded-lg
      bg-surface-100 dark:bg-surface-700
      text-body-sm font-medium
      text-ink dark:text-ink-inverse
    ">
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME DISPLAY
// ─────────────────────────────────────────────────────────────────────────────

function TimeDisplay({ minutes }: { minutes: number }) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  return (
    <span className="
      text-body-sm
      text-ink dark:text-ink-inverse
    ">
      {hours > 0 ? `${hours}h ` : ''}{mins}m
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI INSIGHTS
// ─────────────────────────────────────────────────────────────────────────────

function AIInsights({ task }: { task: Task }) {
  return (
    <div className="space-y-3">
      {task.complexityScore && (
        <InsightRow 
          label="Complexity" 
          value={task.complexityScore}
          max={10}
          color="bg-violet-500"
        />
      )}
      {task.riskScore && (
        <InsightRow 
          label="Risk" 
          value={task.riskScore}
          max={10}
          color={task.riskScore > 7 ? 'bg-danger' : task.riskScore > 4 ? 'bg-warning' : 'bg-success'}
        />
      )}
      {task.completionConfidence && (
        <InsightRow 
          label="Confidence" 
          value={task.completionConfidence}
          max={100}
          color="bg-accent dark:bg-accent-light"
          suffix="%"
        />
      )}
    </div>
  )
}

function InsightRow({ 
  label, 
  value, 
  max, 
  color, 
  suffix = '' 
}: { 
  label: string
  value: number
  max: number
  color: string
  suffix?: string
}) {
  const percentage = (value / max) * 100
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-body-xs text-ink-muted dark:text-ink-inverse-muted">
          {label}
        </span>
        <span className="text-body-xs font-medium text-ink dark:text-ink-inverse">
          {value}{suffix}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCY LIST
// ─────────────────────────────────────────────────────────────────────────────

function DependencyList({ dependencies }: { dependencies: Task['dependencies'] }) {
  if (!dependencies || dependencies.length === 0) return null
  
  return (
    <div className="space-y-2">
      {dependencies.map((dep) => (
        <div
          key={dep.id}
          className="
            flex items-center gap-2
            px-3 py-2 rounded-lg
            bg-surface-100/50 dark:bg-surface-700/30
          "
        >
          <span className={`
            text-body-xs uppercase
            ${dep.type === 'blocks' ? 'text-danger' : dep.type === 'blocked-by' ? 'text-warning' : 'text-ink-muted dark:text-ink-inverse-muted'}
          `}>
            {dep.type}
          </span>
          <span className="text-body-sm text-ink dark:text-ink-inverse truncate">
            {dep.taskTitle}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LINKS LIST
// ─────────────────────────────────────────────────────────────────────────────

function LinksList({ task }: { task: Task }) {
  const hasLinks = task.emailThreadRef?.length || task.meetingLinks?.length || task.documentLinks?.length
  
  if (!hasLinks) {
    return (
      <span className="text-body-sm text-ink-muted dark:text-ink-inverse-muted">
        No links attached
      </span>
    )
  }
  
  return (
    <div className="space-y-2">
      {task.emailThreadRef?.map((ref, i) => (
        <LinkItem key={`email-${i}`} type="email" label={`Email Thread ${i + 1}`} />
      ))}
      {task.meetingLinks?.map((link, i) => (
        <LinkItem key={`meeting-${i}`} type="meeting" label={`Meeting ${i + 1}`} url={link} />
      ))}
      {task.documentLinks?.map((doc) => (
        <LinkItem key={doc.id} type="document" label={doc.name} url={doc.url} />
      ))}
    </div>
  )
}

function LinkItem({ type, label, url }: { type: 'email' | 'meeting' | 'document'; label: string; url?: string }) {
  const icons = {
    email: <MailIcon className="w-4 h-4" />,
    meeting: <VideoIcon className="w-4 h-4" />,
    document: <DocumentIcon className="w-4 h-4" />,
  }
  
  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ x: 2 }}
      className="
        flex items-center gap-2
        px-3 py-2 rounded-lg
        bg-surface-100/50 dark:bg-surface-700/30
        text-ink dark:text-ink-inverse
        hover:bg-surface-100 dark:hover:bg-surface-700/50
        transition-colors duration-200
        cursor-pointer
      "
    >
      <span className="text-ink-muted dark:text-ink-inverse-muted">
        {icons[type]}
      </span>
      <span className="text-body-sm truncate">{label}</span>
      <ExternalLinkIcon className="w-3 h-3 ml-auto text-ink-muted dark:text-ink-inverse-muted" />
    </motion.a>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMESTAMPS LIST
// ─────────────────────────────────────────────────────────────────────────────

function TimestampsList({ task }: { task: Task }) {
  return (
    <div className="space-y-2 text-body-xs text-ink-muted dark:text-ink-inverse-muted">
      <div className="flex justify-between">
        <span>Created</span>
        <span>{formatFullDate(new Date(task.createdAt))}</span>
      </div>
      <div className="flex justify-between">
        <span>Updated</span>
        <span>{formatFullDate(new Date(task.updatedAt))}</span>
      </div>
      {task.completedAt && (
        <div className="flex justify-between">
          <span>Completed</span>
          <span>{formatFullDate(new Date(task.completedAt))}</span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return `In ${diffDays} days`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  )
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

