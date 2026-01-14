import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TaskCard } from './TaskCard'
import { TaskDetailView } from './task-detail'
import type { Task } from '@/types/task'
import { useTaskStore } from '@/stores/taskStore'

// Sophisticated easing
const EASE = [0.16, 1, 0.3, 1] as const

// Column configurations with refined color system
const columns: {
  id: Task['status']
  title: string
  accentColor: string
  bgGradient: string
  glowClass: string
  borderClass: string
}[] = [
  { 
    id: 'backlog', 
    title: 'Backlog',
    accentColor: 'bg-surface-300 dark:bg-surface-600',
    bgGradient: 'from-surface-100/50 to-transparent dark:from-surface-800/30',
    glowClass: 'shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)] dark:shadow-[0_0_30px_-5px_rgba(99,102,241,0.1)]', // Indigo
    borderClass: 'border-indigo-500/20 dark:border-indigo-400/10'
  },
  { 
    id: 'in-progress', 
    title: 'In Progress',
    accentColor: 'bg-accent dark:bg-accent-light',
    bgGradient: 'from-accent/5 to-transparent dark:from-accent-light/5',
    glowClass: 'shadow-[0_0_30px_-5px_rgba(168,85,247,0.25)] dark:shadow-[0_0_30px_-5px_rgba(168,85,247,0.15)]', // Purple
    borderClass: 'border-purple-500/30 dark:border-purple-400/20'
  },
  { 
    id: 'review', 
    title: 'Review',
    accentColor: 'bg-warning',
    bgGradient: 'from-warning/5 to-transparent',
    glowClass: 'shadow-[0_0_30px_-5px_rgba(236,72,153,0.2)] dark:shadow-[0_0_30px_-5px_rgba(236,72,153,0.1)]', // Pink/Fuchsia
    borderClass: 'border-pink-500/20 dark:border-pink-400/10'
  },
  { 
    id: 'done', 
    title: 'Done',
    accentColor: 'bg-success',
    bgGradient: 'from-success/5 to-transparent',
    glowClass: 'shadow-[0_0_30px_-5px_rgba(139,92,246,0.2)] dark:shadow-[0_0_30px_-5px_rgba(139,92,246,0.1)]', // Violet
    borderClass: 'border-violet-500/20 dark:border-violet-400/10'
  },
]

export function KanbanBoard() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const { tasks, updateTask } = useTaskStore()

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
  }
  
  const handleUpdateTask = (updatedTask: Task) => {
      updateTask(updatedTask.id, updatedTask)
      setSelectedTask(updatedTask)
  }

  function getTasksForColumn(columnId: Task['status']): Task[] {
    // Map simplified statuses if necessary, but for now exact match works for core columns
    return tasks.filter(task => {
        // EXCLUDE SUBTASKS - They should never appear as top-level cards
        if (task.parentTaskId) return false
        
        if (columnId === 'in-progress' && task.status === 'blocked') return true
        if (columnId === 'review' && task.status === 'testing') return true
        return task.status === columnId
    })
  }

  const handleCloseDetail = () => {
    setSelectedTask(null)
  }
  
  const handleSubtaskClick = (subtaskId: string) => {
    if (!selectedTask) return
    
    // Find subtask (flattened search if needed, but here simple)
    // Note: Task interface uses Subtask[], which is simpler
    const subtask = selectedTask.subtasks.find(s => s.id === subtaskId)
    if (!subtask) return
    
    // For now, subtasks don't have full metadata in the type, but let's mock promotion like before
    const promotedTask: Task = {
      ...selectedTask,
      id: subtask.id,
      title: subtask.title,
      description: '', 
      type: 'feature',
      subtasks: [],
      priority: subtask.priority || selectedTask.priority,
      status: subtask.status || 'in-progress',
      assignees: subtask.assignee ? [subtask.assignee] : [],
      projectId: selectedTask.projectId,
      projectName: selectedTask.projectName,
    }
    
    setSelectedTask(promotedTask)
  }

  return (
    <>
      <div className="h-full overflow-x-auto overflow-y-hidden scrollbar-thin">
        <div className="h-full flex gap-6 pb-4 pt-1 px-4 min-w-max">
          {columns.map((column, index) => (
            <KanbanColumn
              key={column.id}
              column={column}
              index={index}
              tasks={getTasksForColumn(column.id)}
              onTaskClick={handleTaskClick}
            />
          ))}
        </div>
      </div>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetailView
            task={selectedTask}
            onClose={handleCloseDetail}
            onUpdate={handleUpdateTask}
            onTaskClick={handleSubtaskClick}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KANBAN COLUMN
// ─────────────────────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: typeof columns[number]
  index: number
  tasks: Task[]
  onTaskClick?: (task: Task) => void
}

function KanbanColumn({ column, index, tasks, onTaskClick }: KanbanColumnProps) {
  const taskCount = tasks.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.6,
        delay: index * 0.08,
        ease: EASE,
      }}
      className="flex-shrink-0 w-80 h-full flex flex-col group/column"
    >
      {/* Column Header */}
      <div className="flex-shrink-0 mb-4 px-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <motion.div 
              className={`w-2 h-2 rounded-full ${column.accentColor} shadow-[0_0_8px_currentColor]`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.08 + 0.3, type: 'spring', stiffness: 400, damping: 15 }}
            />
            <h3 className="text-body-sm font-semibold text-ink dark:text-ink-inverse uppercase tracking-wider">
              {column.title}
            </h3>
          </div>
          
          {/* Task count */}
          <motion.span 
            className="text-label px-2.5 py-1 rounded-md bg-surface-100 dark:bg-surface-800 text-ink-muted dark:text-ink-inverse-muted"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.08 + 0.4 }}
          >
            {taskCount}
          </motion.span>
        </div>
      </div>

      {/* Column Body */}
      <div 
        className={`
          flex-1 min-h-0 overflow-y-auto overflow-x-hidden
          rounded-xl
          bg-gradient-to-b ${column.bgGradient}
          border ${column.borderClass}
          ${column.glowClass}
          scrollbar-thin
          transition-all duration-500
          hover:shadow-lg
          group-hover/column:border-opacity-100
        `}
      >
        <div className="p-3 space-y-3">
          <AnimatePresence mode="popLayout">
            {tasks.length > 0 ? (
              tasks.map((task, taskIndex) => (
                <TaskCard 
                  key={task.id} 
                  task={task}
                  index={taskIndex} 
                  onClick={() => onTaskClick?.(task)}
                />
              ))
            ) : (
              <EmptyColumnState key="empty" index={index} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add Task Button */}
      <div className="flex-shrink-0 mt-3">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          /* Implement Add Task logic later */
          className="
            w-full py-3 px-4
            flex items-center justify-center gap-2
            rounded-xl
            text-body-xs font-medium
            text-ink-muted dark:text-ink-inverse-muted
            hover:text-accent dark:hover:text-accent-light
            bg-surface-50 dark:bg-surface-850
            hover:bg-accent/5 dark:hover:bg-accent-light/5
            border border-dashed border-surface-200 dark:border-surface-700
            hover:border-accent/30 dark:hover:border-accent-light/30
            transition-all duration-300
            group
          "
        >
          <motion.span
            className="transition-transform duration-300 group-hover:rotate-90"
          >
            <PlusIcon />
          </motion.span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Add task
          </span>
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyColumnState({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.08 + 0.5, duration: 0.4 }}
      className="
        h-32 flex flex-col items-center justify-center gap-3
        rounded-xl
        bg-surface-50/50 dark:bg-surface-800/30
        border border-dashed border-surface-200 dark:border-surface-700
      "
    >
      <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
        <EmptyIcon />
      </div>
      <p className="text-label text-ink-muted dark:text-ink-inverse-muted">
        No tasks yet
      </p>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function EmptyIcon() {
  return (
    <svg className="w-5 h-5 text-ink-muted dark:text-ink-inverse-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="13" y2="13" />
    </svg>
  )
}
