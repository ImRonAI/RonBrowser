import { useMemo, useState, useEffect } from 'react'
import { Plus, FolderKanban } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { useTaskStore } from '@/stores/taskStore'
import { KanbanBoard, CalendarView } from '@/components/board'
import { TaskDetailView } from '@/components/board/task-detail'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import {
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
  TASK_PRIORITY_CONFIG,
  TASK_STATUS_CONFIG,
} from '@/pages/types/task'
import { CreateIssueDialog, CreateProjectDialog } from '@/components/projects/dialogs'
import { PageBackground } from '@/components/shared/PageBackground'
import { cn } from '@/utils/cn'

export function ExecutePage() {
  const { user } = useAuthStore()
  const { setActiveTab } = useNavigationStore()
  const { tasks, updateTask } = useTaskStore()
  const [activeView, setActiveView] = useState<'kanban' | 'calendar' | 'gantt' | 'list'>('kanban')
  const [calendarMode, setCalendarMode] = useState<'day' | 'week' | 'month'>('week')
  const [projectFilter, setProjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<TaskType | 'all'>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [dueFilter, setDueFilter] = useState<'all' | 'overdue' | 'due-soon' | 'none'>('all')
  const [showIssueDialog, setShowIssueDialog] = useState(false)
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const currentUserName = user?.user_metadata?.full_name || user?.email || ''

  useEffect(() => {
    setActiveTab('execute')
  }, [setActiveTab])

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>()
    let hasPersonal = false
    tasks.forEach((task) => {
      if (task.projectId || task.projectName) {
        const key = task.projectId || task.projectName!
        map.set(key, task.projectName || task.projectId!)
      } else {
        hasPersonal = true
      }
    })
    const options = Array.from(map.entries()).map(([value, label]) => ({ value, label }))
    if (hasPersonal) options.unshift({ value: 'personal', label: 'Personal' })
    return options
  }, [tasks])

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    tasks.forEach((task) => {
      task.assignees.forEach((assignee) => {
        map.set(assignee.id, { id: assignee.id, name: assignee.name })
      })
    })
    return Array.from(map.values())
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const projectKey = task.projectId || task.projectName || 'personal'
      if (projectFilter !== 'all' && projectKey !== projectFilter) return false
      if (statusFilter !== 'all' && task.status !== statusFilter) return false
      const taskPriority = task.priority || 'medium'
      if (priorityFilter !== 'all' && taskPriority !== priorityFilter) return false
      const taskType = task.type || 'other'
      if (typeFilter !== 'all' && taskType !== typeFilter) return false
      if (dueFilter !== 'all') {
        const due = task.dueDate ?? null
        if (dueFilter === 'none' && due) return false
        if (dueFilter === 'overdue') {
          if (!due || due > Date.now()) return false
        }
        if (dueFilter === 'due-soon') {
          if (!due || due > Date.now() + 1000 * 60 * 60 * 24 * 7) return false
        }
      }
      if (assigneeFilter === 'me') {
        if (!currentUserName) return true
        const lower = currentUserName.toLowerCase()
        return task.assignees.some((assignee) => assignee.name.toLowerCase() === lower)
      }
      if (assigneeFilter !== 'all') {
        return task.assignees.some((assignee) => assignee.id === assigneeFilter)
      }
      return true
    })
  }, [
    tasks,
    projectFilter,
    statusFilter,
    priorityFilter,
    typeFilter,
    assigneeFilter,
    dueFilter,
    currentUserName,
  ])

  const navigateInternal = (url: string) => {
    if (typeof window !== 'undefined' && window.electron?.browser) {
      window.electron.browser.navigate(url)
    }
  }

  return (
    <div className="min-h-full relative overflow-hidden bg-surface-0 dark:bg-surface-900">
      <PageBackground />
      <div className="relative z-10 px-10 py-8 space-y-8">
        <div className="rounded-3xl glass-card border border-white/10 p-8 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-ink-muted dark:text-ink-inverse-muted">Execute</p>
              <h1 className="mt-2 text-3xl font-display text-ink dark:text-ink-inverse">Operational Hub</h1>
              <p className="mt-2 text-body-sm text-ink-secondary dark:text-ink-inverse-secondary max-w-2xl">
                Track work across projects, resolve blockers, and drive daily execution.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ActionButton variant="ghost" onClick={() => setShowProjectDialog(true)}>
                New Project
              </ActionButton>
              <ActionButton variant="primary" onClick={() => setShowIssueDialog(true)}>
                <Plus className="w-4 h-4" />
                New Issue
              </ActionButton>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <FilterSelect value={projectFilter} onChange={setProjectFilter}>
              <option value="all">All Projects</option>
              {projectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={statusFilter} onChange={(value) => setStatusFilter(value as TaskStatus | 'all')}>
              <option value="all">All Statuses</option>
              <option value="backlog">Backlog</option>
              <option value="in-progress">In Progress</option>
              <option value="review">Review</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </FilterSelect>
            <FilterSelect value={priorityFilter} onChange={(value) => setPriorityFilter(value as TaskPriority | 'all')}>
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </FilterSelect>
            <FilterSelect value={typeFilter} onChange={(value) => setTypeFilter(value as TaskType | 'all')}>
              <option value="all">All Types</option>
              <option value="feature">Feature</option>
              <option value="bug">Bug</option>
              <option value="improvement">Improvement</option>
              <option value="research">Research</option>
              <option value="documentation">Documentation</option>
              <option value="support">Support</option>
              <option value="other">Other</option>
            </FilterSelect>
            <FilterSelect value={assigneeFilter} onChange={setAssigneeFilter}>
              <option value="all">All assignees</option>
              {currentUserName && <option value="me">Assigned to me</option>}
              {assigneeOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={dueFilter} onChange={(value) => setDueFilter(value as any)}>
              <option value="all">All due dates</option>
              <option value="due-soon">Due in 7 days</option>
              <option value="overdue">Overdue</option>
              <option value="none">No due date</option>
            </FilterSelect>
            <ActionButton variant="ghost" onClick={() => navigateInternal('ron://projects')} className="ml-auto">
              <FolderKanban className="w-4 h-4" />
              Projects
            </ActionButton>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {EXECUTE_VIEWS.map((view) => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={cn(
                  'px-4 py-2 rounded-full text-[11px] font-semibold uppercase tracking-wider transition',
                  activeView === view.id
                    ? 'bg-accent/20 text-accent dark:text-accent-light'
                    : 'glass-subtle border border-white/10 dark:border-white/10 text-ink-muted dark:text-ink-inverse-muted'
                )}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        {activeView === 'kanban' && (
          <div className="rounded-3xl glass-card border border-white/10 p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-body-sm font-semibold text-ink dark:text-ink-inverse">Kanban Board</h2>
                <p className="text-body-xs text-ink-muted dark:text-ink-inverse-muted mt-1">
                  Your task board with the original glass cards and layouts.
                </p>
              </div>
            </div>
            <div className="mt-4 h-[60vh] min-h-[480px]">
              <ErrorBoundary componentName="KanbanBoard">
                <KanbanBoard tasks={filteredTasks} />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {activeView === 'calendar' && (
          <CalendarView mode={calendarMode} onModeChange={setCalendarMode} />
        )}

        {activeView === 'gantt' && (
          <ExecuteGanttView tasks={filteredTasks} onTaskClick={setSelectedTask} />
        )}

        {activeView === 'list' && (
          <ExecuteListView
            tasks={filteredTasks}
            onTaskClick={setSelectedTask}
            onUpdate={updateTask}
          />
        )}

      <CreateIssueDialog isOpen={showIssueDialog} onClose={() => setShowIssueDialog(false)} />
      <CreateProjectDialog isOpen={showProjectDialog} onClose={() => setShowProjectDialog(false)} />
      {selectedTask && (
        <TaskDetailPortal task={selectedTask} onClose={() => setSelectedTask(null)} onUpdate={updateTask} />
      )}
      </div>
    </div>
  )
}

const EXECUTE_VIEWS: { id: 'kanban' | 'calendar' | 'gantt' | 'list'; label: string }[] = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'list', label: 'List' },
]

function ActionButton({
  variant,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant: 'primary' | 'ghost' }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center gap-2 h-11 px-5 rounded-full text-body-xs font-semibold tracking-wide transition-colors',
        variant === 'primary'
          ? 'bg-accent/20 text-accent dark:text-accent-light border border-accent/30 hover:bg-accent/30'
          : 'glass-subtle border border-white/10 dark:border-white/10 text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse hover:border-accent/30',
        className
      )}
    >
      {children}
    </button>
  )
}

function ExecuteListView({
  tasks,
  onTaskClick,
  onUpdate,
}: {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onUpdate: (taskId: string, updates: Partial<Task>) => void
}) {
  return (
    <div className="rounded-3xl glass-card border border-white/10 p-6 shadow-soft">
      <table className="w-full text-left text-body-xs">
        <thead>
          <tr className="text-ink-muted dark:text-ink-inverse-muted border-b border-white/10">
            <th className="pb-3">Task</th>
            <th className="pb-3">Status</th>
            <th className="pb-3">Priority</th>
            <th className="pb-3">Assignees</th>
            <th className="pb-3">Due</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-t border-white/10">
              <td className="py-3">
                <button onClick={() => onTaskClick(task)} className="text-body-sm font-semibold text-ink dark:text-ink-inverse">
                  {task.title}
                </button>
              </td>
              <td className="py-3">
                <select
                  value={task.status}
                  onChange={(event) => onUpdate(task.id, { status: event.target.value as TaskStatus })}
                  className="rounded-lg glass-subtle border border-white/10 dark:border-white/10 px-2 py-1"
                >
                  {Object.keys(TASK_STATUS_CONFIG).map((status) => (
                    <option key={status} value={status}>
                      {TASK_STATUS_CONFIG[status as TaskStatus].label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-3">
                <select
                  value={task.priority || 'medium'}
                  onChange={(event) => onUpdate(task.id, { priority: event.target.value as TaskPriority })}
                  className="rounded-lg glass-subtle border border-white/10 dark:border-white/10 px-2 py-1"
                >
                  {Object.keys(TASK_PRIORITY_CONFIG).map((priority) => (
                    <option key={priority} value={priority}>
                      {TASK_PRIORITY_CONFIG[priority as TaskPriority].label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-3">
                <div className="flex -space-x-2">
                  {task.assignees.slice(0, 3).map((assignee) => (
                    <div
                      key={assignee.id}
                      className="w-7 h-7 rounded-full bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-700 dark:to-surface-800 border-2 border-surface-0/50 dark:border-surface-800/50 flex items-center justify-center text-[9px] font-bold text-ink dark:text-ink-inverse"
                    >
                      {assignee.initials}
                    </div>
                  ))}
                </div>
              </td>
              <td className="py-3 text-body-xs text-ink-muted dark:text-ink-inverse-muted">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExecuteGanttView({
  tasks,
  onTaskClick,
}: {
  tasks: Task[]
  onTaskClick: (task: Task) => void
}) {
  const windowStart = useMemo(() => {
    const start = new Date()
    start.setDate(start.getDate() - 7)
    return start
  }, [])
  const windowEnd = useMemo(() => {
    const end = new Date()
    end.setDate(end.getDate() + 28)
    return end
  }, [])
  const totalMs = windowEnd.getTime() - windowStart.getTime()

  const items = tasks.map((task) => {
    const start = task.startDate ? new Date(task.startDate) : new Date(task.createdAt)
    const end = task.dueDate ? new Date(task.dueDate) : new Date(start.getTime() + 1000 * 60 * 60 * 24 * 7)
    return { task, start, end }
  })

  return (
    <div className="rounded-3xl glass-card border border-white/10 p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="text-body-sm font-semibold text-ink dark:text-ink-inverse">Gantt</h2>
        <span className="text-[11px] uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">
          {windowStart.toLocaleDateString()} – {windowEnd.toLocaleDateString()}
        </span>
      </div>
      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <p className="text-body-xs text-ink-muted dark:text-ink-inverse-muted">No scheduled tasks.</p>
        ) : (
          items.map(({ task, start, end }) => {
            const left = Math.max(0, ((start.getTime() - windowStart.getTime()) / totalMs) * 100)
            const width = Math.min(100 - left, ((end.getTime() - start.getTime()) / totalMs) * 100)
            return (
              <div key={task.id} className="space-y-2">
                <button onClick={() => onTaskClick(task)} className="text-body-sm font-semibold text-ink dark:text-ink-inverse">
                  {task.title}
                </button>
                <div className="h-3 rounded-full glass-subtle border border-white/10 dark:border-white/10 relative">
                  <div
                    className="absolute h-3 rounded-full bg-accent/60"
                    style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function TaskDetailPortal({
  task,
  onClose,
  onUpdate,
}: {
  task: Task
  onClose: () => void
  onUpdate: (taskId: string, updates: Partial<Task>) => void
}) {
  return (
    <ErrorBoundary componentName="TaskDetailView">
      <div className="fixed inset-0 z-[120]">
        <TaskDetailView
          task={task}
          onClose={onClose}
          onUpdate={(updated: Task) => onUpdate(updated.id, updated)}
        />
      </div>
    </ErrorBoundary>
  )
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'rounded-full glass-subtle border border-white/10 dark:border-white/10 px-4 py-2 text-body-xs font-semibold text-ink dark:text-ink-inverse h-11 min-w-[170px]'
      )}
    >
      {children}
    </select>
  )
}
