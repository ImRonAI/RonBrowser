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
// COMPONENT
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
      transition={{ duration: 0.4, delay: index * 0.05, ease: EASE }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative cursor-pointer"
    >
      {/* Glass Card Container */}
      <div className="
        relative p-5 glass-card
        hover:elevated transition-all duration-500
        group-hover:border-accent/20 dark:group-hover:border-accent-light/20
        overflow-hidden
      ">
        
        {/* Ambient Glow on Hover */}
        <div className="
          absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700
          bg-gradient-to-tr from-accent/5 via-transparent to-accent-light/5
          pointer-events-none
        " />

        {/* Floating Priority Orb */}
        {task.priority === 'high' && (
          <div className="absolute -top-3 -right-3">
             <div className="
               relative w-12 h-12 flex items-center justify-center
             ">
               <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
               <div className="w-3 h-3 rounded-full bg-gradient-to-br from-accent-light to-accent shadow-glow-accent animate-pulse-subtle" />
             </div>
          </div>
        )}

        {/* Top Meta Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {task.dueDate ? (
              <div className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-full
                text-[10px] font-bold uppercase tracking-wider
                glass-subtle transition-colors duration-300
                ${isOverdue 
                  ? 'bg-danger/10 text-danger border-danger/20' 
                  : isDueSoon 
                    ? 'bg-warning/10 text-warning border-warning/20'
                    : 'text-ink-secondary dark:text-ink-inverse-secondary group-hover:bg-surface-100/50'
                }
              `}>
                <CalendarIcon className="w-3 h-3" />
                {formatDueDate(task.dueDate)}
              </div>
            ) : <span />}
          </div>
          
          {task.hasNotification && (
            <div className="
              relative w-6 h-6 rounded-full glass-subtle
              flex items-center justify-center
              text-accent dark:text-accent-light
            ">
              <BellIcon className="w-3 h-3" />
              <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-accent dark:bg-accent-light animate-pulse" />
            </div>
          )}
        </div>

        {/* Title */}
        <h4 className={`
          text-body-lg font-semibold tracking-tight leading-snug mb-4
          text-ink dark:text-ink-inverse
          group-hover:text-accent dark:group-hover:text-accent-light transition-colors duration-300
          ${isDone ? 'line-through opacity-50' : ''}
        `}>
          {task.title}
        </h4>

        {/* Tags & Footer */}
        <div className="flex items-end justify-between mt-auto">
          <div className="flex flex-col gap-3">
             {task.interest && (
              <div className={`
                self-start px-2 py-0.5 rounded-md
                text-[10px] uppercase font-bold tracking-widest
                glass-subtle
                ${task.interest.color.replace('bg-', 'text-').replace('text-', 'border-transparent text-')}
              `}>
                {task.interest.label}
              </div>
            )}
            
            {/* Avatars Stack */}
            {task.contacts.length > 0 && (
              <div className="flex -space-x-2 pl-1">
                {task.contacts.slice(0, 3).map((contact) => (
                  <div
                    key={contact.id}
                    className="
                      w-7 h-7 rounded-full
                      bg-gradient-to-br from-surface-100 to-surface-200
                      dark:from-surface-700 dark:to-surface-800
                      border-2 border-surface-0/50 dark:border-surface-800/50
                      flex items-center justify-center
                      text-[9px] font-bold text-ink dark:text-ink-inverse
                      shadow-sm
                    "
                  >
                    {contact.initials}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Progress Circular Indiciator */}
          {task.subtasks.total > 0 && (
             <div className="flex flex-col items-center gap-1">
               <ProgressRing radius={14} stroke={3} progress={progress} />
               <span className="text-[9px] font-medium text-ink-muted dark:text-ink-inverse-muted">
                 {Math.round(progress)}%
               </span>
             </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function ProgressRing({ radius, stroke, progress }: { radius: number, stroke: number, progress: number }) {
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      <svg
        height={radius * 2}
        width={radius * 2}
        className="rotate-[-90deg]"
      >
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset: 0 }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="text-surface-200 dark:text-surface-700"
        />
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="text-accent dark:text-accent-light transition-all duration-1000 ease-out"
        />
      </svg>
    </div>
  )
}

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
      { id: 'c5', name: 'John Doe', initials: 'JD' },
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
