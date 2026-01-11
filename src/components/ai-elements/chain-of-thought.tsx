/**
 * Chain of Thought Components
 * 
 * Visualize step-by-step reasoning process of AI.
 * 
 * Implementation follows official Vercel AI Elements pattern:
 * - React Context for state sharing (no cloneElement)
 * - Controlled/uncontrolled via open/defaultOpen/onOpenChange
 * - Auto-open on streaming, auto-close when complete
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtContextValue {
  isOpen: boolean
  toggle: () => void
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue>({
  isOpen: false,
  toggle: () => {},
})

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThought (Root)
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtProps {
  children: React.ReactNode
  /** Controlled open state */
  open?: boolean
  /** Uncontrolled default open state */
  defaultOpen?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  /** Is content actively streaming */
  isStreaming?: boolean
  /** Delay before auto-collapse after streaming ends (0 to disable) */
  autoCollapseDelay?: number
  className?: string
}

export function ChainOfThought({ 
  children, 
  open: controlledOpen,
  defaultOpen = false, 
  onOpenChange,
  isStreaming = false,
  autoCollapseDelay = 3000,
  className 
}: ChainOfThoughtProps) {
  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback((newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }, [isControlled, onOpenChange])

  const toggle = useCallback(() => {
    setOpen(!isOpen)
  }, [isOpen, setOpen])

  // Auto-open when streaming starts
  useEffect(() => {
    if (isStreaming && !isOpen) {
      setOpen(true)
    }
  }, [isStreaming, isOpen, setOpen])

  // Auto-collapse after streaming completes
  useEffect(() => {
    if (!isStreaming && isOpen && autoCollapseDelay > 0) {
      const timer = setTimeout(() => setOpen(false), autoCollapseDelay)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, isOpen, autoCollapseDelay, setOpen])

  return (
    <ChainOfThoughtContext.Provider value={{ isOpen, toggle }}>
      <div className={cn(
        'rounded-xl border border-surface-200/60 dark:border-surface-700/60',
        'overflow-hidden backdrop-blur-xl',
        'bg-surface-0/60 dark:bg-surface-900/60',
        className
      )}>
        {children}
      </div>
    </ChainOfThoughtContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtHeader
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtHeaderProps {
  children: React.ReactNode
  className?: string
}

export function ChainOfThoughtHeader({ children, className }: ChainOfThoughtHeaderProps) {
  const { isOpen, toggle } = useContext(ChainOfThoughtContext)

  return (
    <button
      onClick={toggle}
      className={cn(
        'w-full flex items-center justify-between',
        'px-4 py-3',
        'bg-surface-50/60 dark:bg-surface-800/60 backdrop-blur-sm',
        'hover:bg-surface-100/80 dark:hover:bg-surface-700/80',
        'transition-colors duration-200',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <BrainIcon className="w-4 h-4 text-accent dark:text-accent-light" />
        <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
          {children}
        </span>
      </div>
      
      <ChevronIcon 
        className={cn(
          'w-4 h-4 text-ink-muted dark:text-ink-inverse-muted',
          'transition-transform duration-200',
          isOpen && 'rotate-180'
        )} 
      />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtContent
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtContentProps {
  children: React.ReactNode
  className?: string
}

export function ChainOfThoughtContent({ children, className }: ChainOfThoughtContentProps) {
  const { isOpen } = useContext(ChainOfThoughtContext)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn('overflow-hidden', className)}
        >
          <div className="p-4 space-y-3">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtStep
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtStepProps {
  label: string
  description?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  icon?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export function ChainOfThoughtStep({ 
  label, 
  description, 
  status, 
  icon,
  children,
  className 
}: ChainOfThoughtStepProps) {
  return (
    <div className={cn('flex gap-3', className)}>
      {/* Status indicator */}
      <div className="flex flex-col items-center">
        <StepStatusIndicator status={status} icon={icon} />
        <div className="w-px flex-1 bg-surface-200 dark:bg-surface-700 mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-body-sm font-medium text-ink dark:text-ink-inverse">
              {label}
            </h4>
            {description && (
              <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary mt-0.5">
                {description}
              </p>
            )}
          </div>
          
          {status === 'running' && (
            <span className="text-label text-accent dark:text-accent-light">Running...</span>
          )}
        </div>

        {children && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="mt-2"
          >
            {children}
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StepStatusIndicator
// ─────────────────────────────────────────────────────────────────────────────

function StepStatusIndicator({ 
  status, 
  icon 
}: { 
  status: 'pending' | 'running' | 'complete' | 'error'
  icon?: React.ReactNode
}) {
  const config = {
    pending: { bg: 'bg-surface-200 dark:bg-surface-700', color: 'text-ink-muted' },
    running: { bg: 'bg-accent/10 dark:bg-accent-light/10', color: 'text-accent dark:text-accent-light' },
    complete: { bg: 'bg-green-100 dark:bg-green-900/30', color: 'text-green-600 dark:text-green-400' },
    error: { bg: 'bg-red-100 dark:bg-red-900/30', color: 'text-red-600 dark:text-red-400' },
  }

  const { bg, color } = config[status]

  return (
    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', bg)}>
      {status === 'running' ? (
        <Loader size={12} />
      ) : status === 'complete' ? (
        <CheckIcon className={cn('w-3 h-3', color)} />
      ) : status === 'error' ? (
        <XIcon className={cn('w-3 h-3', color)} />
      ) : icon ? (
        <span className={cn('w-3 h-3', color)}>{icon}</span>
      ) : (
        <div className={cn('w-2 h-2 rounded-full bg-current', color)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtSearchResults
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtSearchResultsProps {
  children: React.ReactNode
  className?: string
}

export function ChainOfThoughtSearchResults({ children, className }: ChainOfThoughtSearchResultsProps) {
  return (
    <div className={cn(
      'space-y-2 p-3 rounded-lg',
      'bg-surface-50/60 dark:bg-surface-800/60 backdrop-blur-sm',
      className
    )}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtSearchResult
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtSearchResultProps {
  children: React.ReactNode
  className?: string
}

export function ChainOfThoughtSearchResult({ children, className }: ChainOfThoughtSearchResultProps) {
  return (
    <div className={cn(
      'text-body-xs text-ink-secondary dark:text-ink-inverse-secondary',
      'pl-3 border-l-2 border-surface-300 dark:border-surface-600',
      className
    )}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtImage
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtImageProps {
  caption?: string
  children: React.ReactNode
  className?: string
}

export function ChainOfThoughtImage({ caption, children, className }: ChainOfThoughtImageProps) {
  return (
    <figure className={cn('space-y-2', className)}>
      <div className="rounded-lg overflow-hidden">
        {children}
      </div>
      {caption && (
        <figcaption className="text-body-xs text-ink-muted dark:text-ink-inverse-muted text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
