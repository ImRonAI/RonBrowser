import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X as XIcon, Plus as PlusIcon } from 'lucide-react'
import { TaskPriority } from '@/types/task'
import { cn } from '@/utils/cn'

interface SubtaskCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (title: string, priority?: TaskPriority) => void
}

export function SubtaskCreationModal({ isOpen, onClose, onCreate }: SubtaskCreationModalProps) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  
  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setPriority('medium')
    }
  }, [isOpen])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!title.trim()) return
    
    onCreate(title, priority)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="
                pointer-events-auto
                w-full max-w-lg
                glass-bold
                rounded-2xl
                border border-white/20 dark:border-white/10
                shadow-2xl shadow-indigo-500/20 dark:shadow-black/50
                overflow-hidden
              "
            >
              <form onSubmit={handleSubmit} className="flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 dark:border-white/5 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-ink dark:text-ink-inverse">
                    Create Subtask
                  </h3>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition-colors text-ink-muted dark:text-ink-inverse-muted"
                  >
                    <XIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                  {/* Title Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">
                      Subtask Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      autoFocus
                      className="
                        w-full px-4 py-3 rounded-xl
                        bg-surface-50 dark:bg-surface-900/50
                        border border-surface-200 dark:border-surface-700
                        text-ink dark:text-ink-inverse
                        placeholder:text-ink-muted/50 dark:placeholder:text-ink-inverse-muted/50
                        focus:outline-none focus:ring-2 focus:ring-accent/50 dark:focus:ring-accent-light/50
                        transition-all duration-200
                      "
                    />
                  </div>

                  {/* Priority Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">
                      Priority
                    </label>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high', 'critical'] as TaskPriority[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={cn(
                            "px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 border",
                            priority === p
                              ? getPriorityClasses(p)
                              : "border-surface-200 dark:border-surface-700 text-ink-muted dark:text-ink-inverse-muted hover:bg-surface-100 dark:hover:bg-surface-800"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-surface-50/50 dark:bg-surface-900/50 border-t border-white/10 dark:border-white/5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="
                      px-4 py-2 rounded-xl
                      text-sm font-medium
                      text-ink-muted dark:text-ink-inverse-muted
                      hover:bg-surface-100 dark:hover:bg-surface-800
                      transition-colors
                    "
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!title.trim()}
                    className="
                      px-4 py-2 rounded-xl
                      text-sm font-bold text-white
                      bg-accent dark:bg-accent-light
                      shadow-lg shadow-accent/20 dark:shadow-accent-light/20
                      hover:scale-[1.02] active:scale-[0.98]
                      transition-all duration-200
                      disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center gap-2
                    "
                  >
                    <PlusIcon className="w-4 h-4" />
                    Create Subtask
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

function getPriorityClasses(priority: TaskPriority) {
  switch (priority) {
    case 'critical':
      return "bg-danger/10 text-danger border-danger/20 ring-1 ring-danger/20"
    case 'high':
      return "bg-warning/10 text-warning border-warning/20 ring-1 ring-warning/20"
    case 'medium':
      return "bg-info/10 text-info border-info/20 ring-1 ring-info/20"
    case 'low':
      return "bg-surface-200/50 text-ink-muted dark:bg-surface-700/50 dark:text-ink-inverse-muted border-transparent"
  }
}
