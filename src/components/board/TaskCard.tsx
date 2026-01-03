import { motion } from 'framer-motion'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskContact {
  id: string
  name: string
  avatar?: string
  initials: string
}

export interface TaskInterest {
  id: string
  label: string
  color: string
}

export interface Task {
  id: string
  title: string
  description?: string
  dueDate: Date | null
  hasNotification: boolean
  contacts: TaskContact[]
  interest: TaskInterest | null
  subtasks: {
    total: number
    completed: number
  }
  priority?: 'low' | 'medium' | 'high'
  status: 'backlog' | 'in-progress' | 'review' | 'done'
}

const EASE = [0.16, 1, 0.3, 1] as const

// ─────────────────────────────────────────────────────────────────────────────
// TASK CARD
// ─────────────────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task
  index?: number
  onClick?: () => void
}

export function TaskCard({ task, index = 0, onClick }: TaskCardProps) {
  const progress = task.subtasks.total > 0 
    ? Math.round((task.subtasks.completed / task.subtasks.total) * 100) 
    : 0

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
  const isDueSoon = task.dueDate && !isOverdue && 
    new Date(task.dueDate).getTime() - Date.now() < 24 * 60 * 60 * 1000
  const isDone = task.status === 'done'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: EASE }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="group relative cursor-pointer"
    >
      {/* Card */}
      <div className="
        relative p-5 rounded-xl
        bg-surface-0 dark:bg-surface-800
        border border-surface-200 dark:border-surface-700
        shadow-soft dark:shadow-dark-soft
        hover:shadow-medium dark:hover:shadow-dark-medium
        hover:border-surface-300 dark:hover:border-surface-600
        transition-all duration-300
      ">
        {/* Priority accent */}
        {task.priority === 'high' && (
          <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-accent dark:bg-accent-light" />
        )}

        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
          {task.dueDate ? (
            <div className={`
              flex items-center gap-1.5
              px-2.5 py-1 rounded-lg
              text-label uppercase tracking-wider
              ${isOverdue 
                ? 'bg-danger/10 text-danger' 
                : isDueSoon 
                  ? 'bg-warning/10 text-warning'
                  : 'bg-surface-100 dark:bg-surface-700 text-ink-muted dark:text-ink-inverse-muted'
              }
            `}>
              <CalendarIcon className="w-3 h-3" />
              {formatDueDate(task.dueDate)}
            </div>
          ) : <span />}

          {task.hasNotification && (
            <div className="
              relative w-7 h-7 rounded-lg
              bg-accent/10 dark:bg-accent-light/10
              flex items-center justify-center
            ">
              <BellIcon className="w-3.5 h-3.5 text-accent dark:text-accent-light" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent dark:bg-accent-light animate-pulse" />
            </div>
          )}
        </div>

        {/* Title */}
        <h4 className={`
          text-body-md font-semibold leading-snug
          text-ink dark:text-ink-inverse
          ${isDone ? 'line-through opacity-50' : ''}
        `}>
          {task.title}
        </h4>

        {/* Interest tag */}
        {task.interest && (
          <div className={`
            inline-flex items-center gap-1.5 mt-3
            px-2.5 py-1 rounded-lg
            text-label uppercase tracking-wider
            ${task.interest.color}
          `}>
            {task.interest.label}
          </div>
        )}

        {/* Bottom row */}
        {(task.contacts.length > 0 || task.subtasks.total > 0) && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-100 dark:border-surface-700">
            {/* Avatars */}
            {task.contacts.length > 0 && (
              <div className="flex -space-x-1.5">
                {task.contacts.slice(0, 3).map((contact) => (
                  <div
                    key={contact.id}
                    className="
                      w-6 h-6 rounded-full
                      bg-accent dark:bg-accent-light
                      ring-2 ring-surface-0 dark:ring-surface-800
                      flex items-center justify-center
                      text-[8px] font-bold text-white
                    "
                  >
                    {contact.initials}
                  </div>
                ))}
                {task.contacts.length > 3 && (
                  <div className="
                    w-6 h-6 rounded-full
                    bg-surface-100 dark:bg-surface-700
                    ring-2 ring-surface-0 dark:ring-surface-800
                    flex items-center justify-center
                    text-[8px] font-bold text-ink-muted dark:text-ink-inverse-muted
                  ">
                    +{task.contacts.length - 3}
                  </div>
                )}
              </div>
            )}

            {/* Progress */}
            {task.subtasks.total > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-12 h-1 rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${isDone ? 'bg-success' : 'bg-accent dark:bg-accent-light'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                </div>
                <span className="text-label text-ink-muted dark:text-ink-inverse-muted">
                  {task.subtasks.completed}/{task.subtasks.total}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatDueDate(date: Date): string {
  const now = new Date()
  const dueDate = new Date(date)
  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return `${diffDays} days`
  
  return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE DATA
// ─────────────────────────────────────────────────────────────────────────────

export const sampleTasks: Task[] = [
  {
    id: '1',
    title: 'Design new onboarding flow with voice interaction',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    hasNotification: true,
    contacts: [
      { id: 'c1', name: 'Alex Chen', initials: 'AC' },
      { id: 'c2', name: 'Sarah Kim', initials: 'SK' },
      { id: 'c3', name: 'Mike Ross', initials: 'MR' },
    ],
    interest: { id: 'i1', label: 'Design', color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400' },
    subtasks: { total: 8, completed: 5 },
    priority: 'high',
    status: 'in-progress',
  },
  {
    id: '2',
    title: 'Implement agent memory persistence',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    hasNotification: false,
    contacts: [
      { id: 'c1', name: 'Alex Chen', initials: 'AC' },
    ],
    interest: { id: 'i2', label: 'Engineering', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    subtasks: { total: 4, completed: 1 },
    priority: 'high',
    status: 'in-progress',
  },
  {
    id: '3',
    title: 'Research competitor AI browsers',
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    hasNotification: true,
    contacts: [
      { id: 'c2', name: 'Sarah Kim', initials: 'SK' },
      { id: 'c4', name: 'Emma Liu', initials: 'EL' },
    ],
    interest: { id: 'i3', label: 'Research', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
    subtasks: { total: 3, completed: 3 },
    priority: 'medium',
    status: 'review',
  },
  {
    id: '4',
    title: 'Write privacy policy documentation',
    dueDate: null,
    hasNotification: false,
    contacts: [],
    interest: { id: 'i4', label: 'Legal', color: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400' },
    subtasks: { total: 0, completed: 0 },
    priority: 'low',
    status: 'backlog',
  },
]
