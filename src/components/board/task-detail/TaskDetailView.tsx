import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { Task } from '@/pages/types/task'
import { TaskMetadataSidebar } from './TaskMetadataSidebar'
import { DescriptionTab } from './tabs/DescriptionTab'
import { RonTab } from './tabs/RonTab'
import { CommsTab } from './tabs/CommsTab'
import { HistoryTab } from './tabs/HistoryTab'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

// Sophisticated easing
const EASE = [0.16, 1, 0.3, 1] as const

type ViewMode = 'normal' | 'fullscreen'

type TabId = 'description' | 'ron' | 'comms' | 'history'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  { id: 'description', label: 'Description', icon: <DocumentIcon /> },
  { id: 'ron', label: 'Ron', icon: <SparklesIcon /> },
  { id: 'comms', label: 'Comms', icon: <MessageIcon /> },
  { id: 'history', label: 'History', icon: <ClockIcon /> },
]

interface TaskDetailViewProps {
  task: Task
  onClose: () => void
  onUpdate?: (task: Task) => void
  onTaskClick?: (taskId: string) => void
}

export function TaskDetailView({ task, onClose, onUpdate, onTaskClick }: TaskDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('description')
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  const toggleFullscreen = () => {
    setViewMode(prev => prev === 'fullscreen' ? 'normal' : 'fullscreen')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-surface-900/50 dark:bg-surface-950/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.35, ease: EASE }}
        className={cn(
          "relative z-10",
          "bg-surface-0 dark:bg-surface-950",
          "rounded-2xl",
          "border border-surface-200 dark:border-white/[0.06]",
          "shadow-2xl shadow-surface-900/20 dark:shadow-[0_0_80px_rgba(99,102,241,0.08)]",
          "overflow-hidden",
          "flex flex-col",
          viewMode === 'fullscreen'
            ? "w-full h-full max-w-none max-h-none rounded-none border-0"
            : "w-full max-w-5xl h-full max-h-[85vh]"
        )}
      >
        {/* Header */}
        <TaskDetailHeader 
          task={task} 
          onClose={onClose} 
          onToggleFullscreen={toggleFullscreen}
        />

        {/* Main Content - Two Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Tabbed Content */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-surface-200 dark:border-surface-800">
            {/* Tab Navigation */}
            <TabNavigation 
              tabs={TABS} 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
            />

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === 'description' && (
                  <TabPanel key="description">
                    <DescriptionTab 
                      task={task} 
                      onUpdate={onUpdate}
                      onTaskClick={onTaskClick}
                    />
                  </TabPanel>
                )}
                {activeTab === 'ron' && (
                  <TabPanel key="ron">
                    <ErrorBoundary componentName="RonTab">
                      <RonTab task={task} />
                    </ErrorBoundary>
                  </TabPanel>
                )}
                {activeTab === 'comms' && (
                  <TabPanel key="comms">
                    <CommsTab task={task} />
                  </TabPanel>
                )}
                {activeTab === 'history' && (
                  <TabPanel key="history">
                    <HistoryTab task={task} />
                  </TabPanel>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Panel - Metadata Sidebar */}
          <TaskMetadataSidebar 
            task={task} 
            onUpdate={onUpdate} 
            onTaskClick={onTaskClick}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────

interface TaskDetailHeaderProps {
  task: Task
  onClose: () => void
  onToggleFullscreen: () => void
}

function TaskDetailHeader({ task, onClose, onToggleFullscreen }: TaskDetailHeaderProps) {
  return (
    <div className={cn(
      "flex-shrink-0",
      "px-4 py-3",
      "border-b border-surface-200 dark:border-white/[0.06]",
      "bg-surface-50/80 dark:bg-surface-900/80 backdrop-blur-xl"
    )}>
      <div className="flex items-center justify-between gap-4">
        {/* Left: Window Controls - Unified indigo/surface palette */}
        <div className="flex items-center gap-2">
          {/* Close */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className={cn(
              "group w-8 h-8 rounded-lg",
              "bg-surface-200 dark:bg-surface-800",
              "hover:bg-indigo-500",
              "flex items-center justify-center",
              "transition-colors duration-200"
            )}
            aria-label="Close"
          >
            <CloseIcon className="w-4 h-4 text-ink-muted group-hover:text-white transition-colors" />
          </motion.button>
          
          {/* Minimize */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className={cn(
              "group w-8 h-8 rounded-lg",
              "bg-surface-200 dark:bg-surface-800",
              "hover:bg-indigo-500/80",
              "flex items-center justify-center",
              "transition-colors duration-200"
            )}
            aria-label="Minimize"
          >
            <MinimizeIcon className="w-4 h-4 text-ink-muted group-hover:text-white transition-colors" />
          </motion.button>
          
          {/* Fullscreen */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggleFullscreen}
            className={cn(
              "group w-8 h-8 rounded-lg",
              "bg-surface-200 dark:bg-surface-800",
              "hover:bg-indigo-500/60",
              "flex items-center justify-center",
              "transition-colors duration-200"
            )}
            aria-label="Fullscreen"
          >
            <ExpandIcon className="w-4 h-4 text-ink-muted group-hover:text-white transition-colors" />
          </motion.button>
        </div>

        {/* Center: Title & Metadata */}
        <div className="flex-1 min-w-0 flex items-center justify-center gap-3">
          {/* Task Type Icon */}
          {task.type && (
            <span className={cn(
              "flex-shrink-0",
              "w-7 h-7 rounded-lg",
              "bg-indigo-500/10 dark:bg-indigo-500/20",
              "flex items-center justify-center",
              "text-indigo-600 dark:text-indigo-400"
            )}>
              <TaskTypeIcon type={task.type} />
            </span>
          )}
          
          {/* Task ID */}
          <span className={cn(
            "text-label uppercase tracking-wider",
            "text-ink-muted dark:text-ink-inverse-muted"
          )}>
            {task.id}
          </span>

          {/* Title */}
          <h2 className={cn(
            "text-body-sm font-medium",
            "text-ink dark:text-ink-inverse",
            "truncate max-w-md"
          )}>
            {task.title}
          </h2>

          {/* Health Indicator */}
          {task.healthIndicator && (
            <HealthBadge indicator={task.healthIndicator} />
          )}
        </div>

        {/* Right: More Options */}
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "p-2 rounded-lg",
              "text-ink-muted dark:text-ink-inverse-muted",
              "hover:bg-surface-200 dark:hover:bg-surface-800",
              "hover:text-ink dark:hover:text-ink-inverse",
              "transition-colors duration-200"
            )}
            aria-label="More options"
          >
            <MoreIcon className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

interface TabNavigationProps {
  tabs: Tab[]
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className={cn(
      "flex-shrink-0",
      "px-4 pt-3",
      "border-b border-surface-200 dark:border-white/[0.06]"
    )}>
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative",
              "flex items-center gap-2",
              "px-4 py-2.5",
              "text-body-sm font-medium",
              "rounded-t-lg",
              "transition-colors duration-200",
              activeTab === tab.id
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse'
            )}
          >
            <span className="w-4 h-4">{tab.icon}</span>
            <span>{tab.label}</span>
            
            {/* Active Indicator */}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-0.5",
                  "bg-gradient-to-r from-indigo-500 to-violet-500",
                  "shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                )}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB PANEL WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function TabPanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15, ease: EASE }}
      className="h-full overflow-hidden"
    >
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH BADGE - Using indigo/violet spectrum only
// ─────────────────────────────────────────────────────────────────────────────

function HealthBadge({ indicator }: { indicator: Task['healthIndicator'] }) {
  const config = {
    'on-track': { 
      icon: (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      ), 
      label: 'On Track', 
      color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
    },
    'at-risk': { 
      icon: (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <circle cx="12" cy="16" r="1" fill="currentColor" />
        </svg>
      ), 
      label: 'At Risk', 
      color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' 
    },
    'critical': { 
      icon: (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ), 
      label: 'Critical', 
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' 
    },
    'blocked': { 
      icon: (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ), 
      label: 'Blocked', 
      color: 'bg-surface-200 dark:bg-surface-700 text-ink-muted dark:text-ink-inverse-muted' 
    },
  }
  
  const { icon, label, color } = config[indicator || 'on-track']
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5",
      "px-2 py-1 rounded-md",
      "text-[10px] font-semibold uppercase tracking-wider",
      color
    )}>
      {icon}
      <span>{label}</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK TYPE ICON
// ─────────────────────────────────────────────────────────────────────────────

function TaskTypeIcon({ type }: { type: Task['type'] }) {
  const iconClass = "w-4 h-4 text-indigo-600 dark:text-indigo-400"
  
  switch (type) {
    case 'feature':
      return <SparklesIcon className={iconClass} />
    case 'bug':
      return <BugIcon className={iconClass} />
    case 'improvement':
      return <LightningIcon className={iconClass} />
    case 'research':
      return <SearchIcon className={iconClass} />
    case 'documentation':
      return <DocumentIcon className={iconClass} />
    case 'support':
      return <MessageIcon className={iconClass} />
    default:
      return <DocumentIcon className={iconClass} />
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
    </svg>
  )
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-5 h-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function MinimizeIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-5 h-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-5 h-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-5 h-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  )
}

function BugIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="6" width="8" height="14" rx="4" />
      <path d="M19 8l-3 1.5" />
      <path d="M5 8l3 1.5" />
      <path d="M19 16l-3-1.5" />
      <path d="M5 16l3-1.5" />
      <path d="M12 6V2" />
      <path d="M19 12h3" />
      <path d="M2 12h3" />
    </svg>
  )
}

function LightningIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
