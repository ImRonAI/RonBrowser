import { motion } from 'framer-motion'
import type { Task, TaskPriority, TaskStatus, TaskLabel } from '@/types/task'
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/types/task'
import {
    Plus as PlusIcon,
    Calendar as CalendarIcon,
    FileText as DocumentIcon,
    Mail as MailIcon,
    Video as VideoIcon,
    ExternalLink as ExternalLinkIcon
} from 'lucide-react'

interface TaskMetadataSidebarProps {
  task: Task
  onUpdate?: (task: Task) => void
}

export function TaskMetadataSidebar({ task }: TaskMetadataSidebarProps) {
  return (
    <div className="
      w-80 flex-shrink-0
      bg-surface-50/30 dark:bg-surface-800/20 backdrop-blur-md
      border-l border-white/10 dark:border-white/5
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
        text-[10px] font-bold uppercase tracking-wider
        text-ink-muted dark:text-ink-inverse-muted
        opacity-70
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
        px-3 py-2.5 rounded-xl
        glass-card
        hover:elevated
        border transition-all duration-200
        ${config.bgColor}
        border-surface-200/50 dark:border-surface-700/50
      `}
    >
      <span className={`w-2 h-2 rounded-full shadow-glow-sm ${config.color.replace('text-', 'bg-')}`} />
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
      <span className="text-body-sm text-ink-muted dark:text-ink-inverse-muted italic">
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
        px-3 py-2.5 rounded-xl
        glass-card
        hover:elevated
        border transition-all duration-200
        ${config.bgColor}
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
            glass-subtle
            cursor-pointer
            hover:bg-surface-100/50 dark:hover:bg-surface-700/50
            transition-colors duration-200
          "
        >
          <div className="
            w-7 h-7 rounded-full
            bg-accent dark:bg-accent-light
            flex items-center justify-center
            text-[10px] font-bold text-white
            shadow-glow-sm
          ">
            {assignee.initials}
          </div>
          <span className="text-body-sm text-ink dark:text-ink-inverse font-medium">
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
        glass-subtle border
        ${isOverdue 
          ? 'bg-danger/10 text-danger border-danger/20' 
          : isDueSoon 
            ? 'bg-warning/10 text-warning border-warning/20'
            : 'text-ink dark:text-ink-inverse border-surface-200/50'
        }
        hover:shadow-sm
        transition-all duration-200
      `}
    >
      <CalendarIcon className="w-4 h-4" />
      <span className="text-body-sm font-medium">
        {formatDate(dateObj)}
      </span>
      {isOverdue && (
        <span className="text-[10px] font-bold uppercase tracking-wider ml-auto">OVERDUE</span>
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
            text-[10px] font-bold uppercase tracking-wider
            ${label.color} bg-opacity-10 dark:bg-opacity-20
            border border-current border-opacity-20
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
        <span className="text-body-xs text-ink-muted dark:text-ink-inverse-muted">
          {completed} of {total} completed
        </span>
        <span className="text-body-xs font-bold text-ink dark:text-ink-inverse">
          {percentage}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-200/50 dark:bg-surface-700/50 overflow-hidden box-border border border-surface-200/20">
        <motion.div
          className={`h-full rounded-full shadow-glow-sm ${percentage === 100 ? 'bg-success' : 'bg-accent dark:bg-accent-light'}`}
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
      glass-subtle
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
      text-body-sm font-mono
      text-ink dark:text-ink-inverse
      glass-subtle px-2 py-1 rounded-md
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
    <div className="space-y-3 p-3 rounded-xl glass-subtle border border-accent/10">
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
        <span className="text-[10px] font-medium text-ink-muted dark:text-ink-inverse-muted uppercase">
          {label}
        </span>
        <span className="text-[10px] font-bold text-ink dark:text-ink-inverse">
          {value}{suffix}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-200/50 dark:bg-surface-700/50 overflow-hidden">
        <motion.div
          className={`h-full rounded-full shadow-sm ${color}`}
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
            glass-subtle
          "
        >
          <span className={`
            text-[9px] font-bold uppercase
            px-1.5 py-0.5 rounded
            ${dep.type === 'blocks' ? 'bg-danger/10 text-danger' : dep.type === 'blocked-by' ? 'bg-warning/10 text-warning' : 'bg-surface-200 text-ink-muted'}
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
      <span className="text-body-sm text-ink-muted dark:text-ink-inverse-muted italic px-2">
        No links attached
      </span>
    )
  }
  
  return (
    <div className="space-y-2">
      {task.emailThreadRef?.map((ref, i) => (
        <LinkItem key={`email-${i}`} type="email" label={ref || `Email Thread ${i + 1}`} />
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
        glass-subtle
        text-ink dark:text-ink-inverse
        hover:bg-surface-100/50 dark:hover:bg-surface-700/50
        transition-colors duration-200
        cursor-pointer
        group
      "
    >
      <span className="text-ink-muted dark:text-ink-inverse-muted group-hover:text-accent dark:group-hover:text-accent-light transition-colors">
        {icons[type]}
      </span>
      <span className="text-body-sm truncate">{label}</span>
      <ExternalLinkIcon className="w-3 h-3 ml-auto text-ink-muted dark:text-ink-inverse-muted opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.a>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMESTAMPS LIST
// ─────────────────────────────────────────────────────────────────────────────

function TimestampsList({ task }: { task: Task }) {
  return (
    <div className="space-y-2 text-[10px] text-ink-muted dark:text-ink-inverse-muted glass-subtle p-3 rounded-lg">
      <div className="flex justify-between">
        <span>Created</span>
        <span className="font-mono">{formatFullDate(new Date(task.createdAt))}</span>
      </div>
      <div className="flex justify-between">
        <span>Updated</span>
        <span className="font-mono">{formatFullDate(new Date(task.updatedAt))}</span>
      </div>
      {task.completedAt && (
        <div className="flex justify-between">
          <span>Completed</span>
          <span className="font-mono">{formatFullDate(new Date(task.completedAt))}</span>
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
