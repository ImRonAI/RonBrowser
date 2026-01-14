/**
 * RelationshipManager - Comprehensive Task Relationship UI
 * 
 * Supports multiple relationship types:
 * - Task to Task (parent, blocks, relates-to, etc.)
 * - Task to Chat (conversation reference)
 * - Task to Project (project context)
 * - Future: Phone, Email, Text, Video, Document Share (Coming Soon)
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Task, TaskRelationship } from '@/types/task'
import { useTaskStore } from '@/stores/taskStore'
import {
  Link as LinkIcon,
  Plus as PlusIcon,
  X as XIcon,
  ChevronDown as ChevronIcon,
  CheckSquare as TaskIcon,
  MessageSquare as ChatIcon,
  FolderKanban as ProjectIcon,
  Phone as PhoneIcon,
  Mail as MailIcon,
  MessageCircle as TextIcon,
  Video as VideoIcon,
  FileText as FaxIcon,
  Search as SearchIcon,
  ArrowRight as ArrowIcon,
  Lock as LockIcon
} from 'lucide-react'
import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type RelationshipCategory = 'task' | 'chat' | 'project' | 'phone' | 'email' | 'text' | 'video' | 'fax'

interface RelationshipConfig {
  id: RelationshipCategory
  label: string
  icon: React.ReactNode
  description: string
  enabled: boolean
  color: string
}

const RELATIONSHIP_CATEGORIES: RelationshipConfig[] = [
  { id: 'task', label: 'Task', icon: <TaskIcon size={18} />, description: 'Link to another task', enabled: true, color: 'text-accent' },
  { id: 'chat', label: 'Conversation', icon: <ChatIcon size={18} />, description: 'Reference a chat session', enabled: true, color: 'text-violet-500' },
  { id: 'project', label: 'Project', icon: <ProjectIcon size={18} />, description: 'Associate with a project', enabled: true, color: 'text-emerald-500' },
  { id: 'phone', label: 'Phone Call', icon: <PhoneIcon size={18} />, description: 'Link to a phone call', enabled: false, color: 'text-blue-500' },
  { id: 'email', label: 'Email', icon: <MailIcon size={18} />, description: 'Connect to email thread', enabled: false, color: 'text-rose-500' },
  { id: 'text', label: 'Text/SMS', icon: <TextIcon size={18} />, description: 'Link to text messages', enabled: false, color: 'text-teal-500' },
  { id: 'video', label: 'Video Call', icon: <VideoIcon size={18} />, description: 'Reference a video meeting', enabled: false, color: 'text-indigo-500' },
  { id: 'fax', label: 'Document Share', icon: <FaxIcon size={18} />, description: 'E-Fax or document share', enabled: false, color: 'text-amber-500' },
]

const TASK_RELATIONSHIP_TYPES = [
  { value: 'parent', label: 'Parent of' },
  { value: 'child', label: 'Child of' },
  { value: 'blocks', label: 'Blocks' },
  { value: 'blocked-by', label: 'Blocked by' },
  { value: 'relates-to', label: 'Related to' },
  { value: 'implements', label: 'Implements' },
  { value: 'implemented-by', label: 'Implemented by' },
  { value: 'causes', label: 'Causes' },
  { value: 'caused-by', label: 'Caused by' },
]

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface RelationshipManagerProps {
  task: Task
  onRelationshipAdd?: (type: string, targetId: string, relType?: string) => void
  onRelationshipRemove?: (relationshipId: string) => void
}

export function RelationshipManager({ task, onRelationshipAdd, onRelationshipRemove }: RelationshipManagerProps) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<RelationshipCategory | null>(null)

  // Filter out excessive "Parent Of" items (laundry list), 
  // but KEEP "Child Of" items so we can navigate back to the parent.
  const relationships = (task.relationships || []).filter(r => 
    r.type !== 'parent'
  )

  return (
    <div className="space-y-3">
      {/* Add Relationship Button - AT THE TOP */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsAddOpen(!isAddOpen)}
        className={cn(
          "w-full flex items-center justify-center gap-2",
          "px-4 py-3 rounded-xl",
          "glass-card border border-dashed border-surface-300 dark:border-surface-600",
          "text-ink-muted dark:text-ink-inverse-muted",
          "hover:border-accent/50 dark:hover:border-accent-light/50",
          "hover:text-accent dark:hover:text-accent-light",
          "transition-all duration-200",
          isAddOpen && "border-accent/50 dark:border-accent-light/50 text-accent dark:text-accent-light"
        )}
      >
        <PlusIcon size={16} className={cn("transition-transform duration-200", isAddOpen && "rotate-45")} />
        <span className="text-sm font-medium">{isAddOpen ? 'Cancel' : 'Add Relationship'}</span>
      </motion.button>

      {/* Inline Dropdown - Appears right below the button */}
      <AnimatePresence>
        {isAddOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "p-4 rounded-xl",
              "glass-card border border-surface-200 dark:border-surface-700"
            )}>
              {!selectedCategory ? (
                <CategorySelector onSelect={(cat) => setSelectedCategory(cat)} />
              ) : (
                <RelationshipPicker
                  task={task}
                  category={selectedCategory}
                  onBack={() => setSelectedCategory(null)}
                  onAdd={(targetId, relType) => {
                    onRelationshipAdd?.(selectedCategory || 'task', targetId, relType)
                    setIsAddOpen(false)
                    setSelectedCategory(null)
                  }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing Relationships - BELOW the dropdown */}
      {relationships.length > 0 && (
        <div className="space-y-2">
          {relationships.map(rel => (
            <RelationshipCard 
              key={rel.id} 
              relationship={rel} 
              onRemove={() => onRelationshipRemove?.(rel.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP CARD
// ─────────────────────────────────────────────────────────────────────────────

function RelationshipCard({ 
  relationship, 
  onRemove 
}: { 
  relationship: TaskRelationship
  onRemove: () => void 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative flex items-center gap-3",
        "p-3 rounded-xl",
        "glass-card hover:elevated",
        "transition-all duration-200"
      )}
    >
      <div className="w-8 h-8 rounded-lg glass-subtle flex items-center justify-center text-accent dark:text-accent-light">
        <LinkIcon size={16} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-wider",
            "px-1.5 py-0.5 rounded",
            "bg-accent/10 text-accent dark:text-accent-light"
          )}>
            {relationship.type.replace('-', ' ')}
          </span>
        </div>
        <p className="text-sm font-medium text-ink dark:text-ink-inverse truncate mt-0.5">
          {relationship.targetTaskTitle}
        </p>
      </div>

      <button
        onClick={onRemove}
        className={cn(
          "absolute top-2 right-2",
          "p-1 rounded-md",
          "opacity-0 group-hover:opacity-100",
          "hover:bg-danger/10 text-danger",
          "transition-all duration-150"
        )}
        aria-label="Remove relationship"
      >
        <XIcon size={12} />
      </button>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD RELATIONSHIP MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface AddRelationshipModalProps {
  task: Task
  selectedCategory: RelationshipCategory | null
  onCategorySelect: (cat: RelationshipCategory) => void
  onAdd: (targetId: string, relType?: string) => void
  onClose: () => void
}

export function AddRelationshipModal({
  task,
  selectedCategory,
  onCategorySelect,
  onAdd,
  onClose
}: AddRelationshipModalProps) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn(
          "fixed z-50 inset-x-4 top-1/2 -translate-y-1/2",
          "max-w-lg mx-auto",
          "glass-card border border-surface-200 dark:border-surface-700",
          "rounded-2xl shadow-2xl overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200/50 dark:border-surface-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl glass-subtle flex items-center justify-center">
              <LinkIcon size={20} className="text-accent dark:text-accent-light" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ink dark:text-ink-inverse">
                Add Relationship
              </h3>
              <p className="text-xs text-ink-muted dark:text-ink-inverse-muted">
                Connect this task to other items
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 text-ink-muted transition-colors"
            aria-label="Close"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {!selectedCategory ? (
            <CategorySelector onSelect={onCategorySelect} />
          ) : (
            <RelationshipPicker
              task={task}
              category={selectedCategory}
              onBack={() => onCategorySelect(null as any)}
              onAdd={onAdd}
            />
          )}
        </div>
      </motion.div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY SELECTOR
// ─────────────────────────────────────────────────────────────────────────────

function CategorySelector({ onSelect }: { onSelect: (cat: RelationshipCategory) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted dark:text-ink-inverse-muted mb-4">
        What would you like to link to this task?
      </p>
      
      <div className="grid grid-cols-2 gap-3">
        {RELATIONSHIP_CATEGORIES.map(cat => (
          <motion.button
            key={cat.id}
            whileHover={{ scale: cat.enabled ? 1.02 : 1 }}
            whileTap={{ scale: cat.enabled ? 0.98 : 1 }}
            onClick={() => cat.enabled && onSelect(cat.id)}
            disabled={!cat.enabled}
            className={cn(
              "relative p-4 rounded-xl text-left transition-all duration-200",
              "glass-card border",
              cat.enabled 
                ? "border-surface-200/50 dark:border-surface-700/50 hover:border-accent/30 hover:elevated cursor-pointer"
                : "border-surface-200/30 dark:border-surface-700/30 opacity-60 cursor-not-allowed"
            )}
          >
            {/* Coming Soon Badge */}
            {!cat.enabled && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-700 text-[8px] font-bold uppercase text-ink-muted">
                <LockIcon size={8} />
                Soon
              </div>
            )}
            
            <div className={cn(
              "w-10 h-10 rounded-xl glass-subtle flex items-center justify-center mb-3",
              cat.enabled ? cat.color : "text-ink-muted"
            )}>
              {cat.icon}
            </div>
            
            <h4 className={cn(
              "text-sm font-semibold mb-0.5",
              cat.enabled ? "text-ink dark:text-ink-inverse" : "text-ink-muted dark:text-ink-inverse-muted"
            )}>
              {cat.label}
            </h4>
            
            <p className="text-xs text-ink-muted dark:text-ink-inverse-muted line-clamp-1">
              {cat.description}
            </p>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP PICKER
// ─────────────────────────────────────────────────────────────────────────────

interface RelationshipPickerProps {
  task: Task
  category: RelationshipCategory
  onBack: () => void
  onAdd: (targetId: string, relType?: string) => void
}

function RelationshipPicker({ task, category, onBack, onAdd }: RelationshipPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRelType, setSelectedRelType] = useState('relates-to')
  const tasks = useTaskStore(state => state.tasks)

  // Filter tasks (excluding current task)
  const filteredTasks = tasks.filter(t => 
    t.id !== task.id && 
    (t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
     t.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  ).slice(0, 8)

  const categoryConfig = RELATIONSHIP_CATEGORIES.find(c => c.id === category)

  return (
    <div className="space-y-4">
      {/* Back button and header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back to categories"
          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 text-ink-muted transition-colors"
        >
          <ChevronIcon size={16} className="rotate-90" />
        </button>
        <div className={cn(
          "w-8 h-8 rounded-lg glass-subtle flex items-center justify-center",
          categoryConfig?.color
        )}>
          {categoryConfig?.icon}
        </div>
        <span className="text-sm font-medium text-ink dark:text-ink-inverse">
          Link to {categoryConfig?.label}
        </span>
      </div>

      {/* Relationship Type (for tasks) */}
      {category === 'task' && (
        <div className="flex flex-wrap gap-1.5">
          {TASK_RELATIONSHIP_TYPES.map(rt => (
            <button
              key={rt.value}
              onClick={() => setSelectedRelType(rt.value)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                selectedRelType === rt.value
                  ? "glass-bold bg-accent/10 text-accent dark:text-accent-light border border-accent/20"
                  : "glass-subtle text-ink-muted dark:text-ink-inverse-muted hover:text-ink"
              )}
            >
              {rt.label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={`Search ${category}s...`}
          className={cn(
            "w-full pl-10 pr-4 py-2.5 rounded-xl",
            "glass-subtle border border-surface-200/50 dark:border-surface-700/50",
            "text-sm text-ink dark:text-ink-inverse",
            "placeholder:text-ink-muted/50",
            "focus:outline-none focus:border-accent/50",
            "transition-colors"
          )}
        />
      </div>

      {/* Results */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {filteredTasks.length > 0 ? (
          filteredTasks.map(t => (
            <motion.button
              key={t.id}
              whileHover={{ x: 4 }}
              onClick={() => onAdd(t.id, selectedRelType)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl text-left",
                "glass-subtle hover:glass-card",
                "transition-all duration-150 group"
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
                <TaskIcon size={14} className="text-ink-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink dark:text-ink-inverse truncate">
                  {t.title}
                </p>
                <p className="text-xs text-ink-muted dark:text-ink-inverse-muted">
                  {t.status} • {t.priority}
                </p>
              </div>
              <ArrowIcon size={14} className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          ))
        ) : (
          <div className="text-center py-8 text-ink-muted dark:text-ink-inverse-muted">
            <TaskIcon size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No {category}s found</p>
          </div>
        )}
      </div>
    </div>
  )
}
