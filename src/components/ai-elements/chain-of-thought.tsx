/**
 * Chain of Thought Components
 * 
 * Visualize step-by-step reasoning process of AI.
 * 
 * Implementation follows official Vercel AI Elements pattern:
 * - Single Collapsible wrapper approach (trigger and content in same root)
 * - Memoized components to prevent unnecessary re-renders
 * - Smooth animations using Framer Motion
 * - Stable state management with refs to track streaming edges
 */

'use client'

import React, { useState, useEffect, useCallback, createContext, useContext, useRef, memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue>({
  isOpen: false,
  setIsOpen: () => {},
})

export const useChainOfThought = () => useContext(ChainOfThoughtContext)

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThought (Root) - Memoized to prevent jitter
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

export const ChainOfThought = memo(function ChainOfThought({ 
  children, 
  open: controlledOpen,
  defaultOpen = false, 
  onOpenChange,
  isStreaming = false,
  autoCollapseDelay = 2000,
  className 
}: ChainOfThoughtProps) {
  // Use ref to track if we've already auto-closed to prevent repeated triggers
  const hasAutoClosedRef = useRef(false)
  const prevStreamingRef = useRef(isStreaming)
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Internal state (for uncontrolled mode)
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  
  // Support controlled/uncontrolled
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setIsOpen = useCallback((newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }, [isControlled, onOpenChange])

  // Handle streaming state changes - only on edges
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current
    prevStreamingRef.current = isStreaming

    // Rising edge: streaming just started
    if (!wasStreaming && isStreaming) {
      // Clear any pending collapse timer
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current)
        collapseTimerRef.current = null
      }
      hasAutoClosedRef.current = false
      // Don't auto-open - let user control or keep defaultOpen behavior
    }

    // Falling edge: streaming just ended
    if (wasStreaming && !isStreaming && autoCollapseDelay > 0 && !hasAutoClosedRef.current) {
      collapseTimerRef.current = setTimeout(() => {
        setIsOpen(false)
        hasAutoClosedRef.current = true
      }, autoCollapseDelay)
    }

    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current)
      }
    }
  }, [isStreaming, autoCollapseDelay, setIsOpen])

  const contextValue = useMemo(() => ({
    isOpen,
    setIsOpen,
  }), [isOpen, setIsOpen])

  return (
    <ChainOfThoughtContext.Provider value={contextValue}>
      <div className={cn(
        'rounded-xl border border-surface-200/60 dark:border-surface-700/60',
        'overflow-hidden backdrop-blur-xl',
        'bg-gradient-to-br from-surface-0/80 to-surface-50/60',
        'dark:from-surface-900/80 dark:to-surface-850/60',
        'shadow-sm',
        className
      )}>
        {children}
      </div>
    </ChainOfThoughtContext.Provider>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtHeader - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtHeaderProps {
  children?: React.ReactNode
  className?: string
}

export const ChainOfThoughtHeader = memo(function ChainOfThoughtHeader({ 
  children, 
  className 
}: ChainOfThoughtHeaderProps) {
  const { isOpen, setIsOpen } = useChainOfThought()

  const handleClick = useCallback(() => {
    setIsOpen(!isOpen)
  }, [isOpen, setIsOpen])

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-center justify-between',
        'px-4 py-3',
        'bg-surface-50/60 dark:bg-surface-800/60 backdrop-blur-sm',
        'hover:bg-surface-100/80 dark:hover:bg-surface-700/80',
        'transition-colors duration-200',
        'text-left',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <BrainIcon className="w-4 h-4 text-accent dark:text-accent-light" />
        <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
          {children ?? 'Chain of Thought'}
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
})

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtContent - Memoized with stable animations
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtContentProps {
  children: React.ReactNode
  className?: string
}

export const ChainOfThoughtContent = memo(function ChainOfThoughtContent({ 
  children, 
  className 
}: ChainOfThoughtContentProps) {
  const { isOpen } = useChainOfThought()

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ 
            height: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 0.2, delay: 0.05 }
          }}
          className={cn('overflow-hidden', className)}
        >
          <div className="p-4 space-y-3 max-h-[32rem] overflow-y-auto scrollbar-thin">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtStep - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtStepProps {
  label: string
  description?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  icon?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export const ChainOfThoughtStep = memo(function ChainOfThoughtStep({ 
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
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-body-sm font-medium text-ink dark:text-ink-inverse truncate">
              {label}
            </h4>
            {description && (
              <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary mt-0.5 truncate">
                {description}
              </p>
            )}
          </div>
          
          {status === 'running' && (
            <span className="text-label text-accent dark:text-accent-light flex-shrink-0">
              Running...
            </span>
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
})

// ─────────────────────────────────────────────────────────────────────────────
// StepStatusIndicator - Memoized
// ─────────────────────────────────────────────────────────────────────────────

const StepStatusIndicator = memo(function StepStatusIndicator({ 
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
})

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtSearchResults - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtSearchResultsProps {
  children: React.ReactNode
  title?: string
  className?: string
}

export const ChainOfThoughtSearchResults = memo(function ChainOfThoughtSearchResults({ 
  children, 
  title = 'Search Results',
  className 
}: ChainOfThoughtSearchResultsProps) {
  return (
    <div className={cn(
      'space-y-2 p-3 rounded-lg',
      'bg-surface-50/60 dark:bg-surface-800/60 backdrop-blur-sm',
      'border border-surface-200/50 dark:border-surface-700/50',
      className
    )}>
      <h5 className="text-label font-medium text-ink-muted dark:text-ink-inverse-muted">
        {title}
      </h5>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtSearchResult - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtSearchResultProps {
  children: React.ReactNode
  url?: string
  favicon?: string
  className?: string
}

export const ChainOfThoughtSearchResult = memo(function ChainOfThoughtSearchResult({ 
  children, 
  url,
  favicon,
  className 
}: ChainOfThoughtSearchResultProps) {
  return (
    <div className={cn(
      'flex items-start gap-2',
      'text-body-xs text-ink-secondary dark:text-ink-inverse-secondary',
      'p-2 rounded-md',
      'hover:bg-surface-100/60 dark:hover:bg-surface-700/60',
      'transition-colors duration-150',
      className
    )}>
      {favicon && (
        <img src={favicon} alt="" className="w-4 h-4 rounded mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate">{children}</div>
        {url && (
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-accent dark:text-accent-light hover:underline text-label truncate block"
          >
            {url}
          </a>
        )}
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtImage - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtImageProps {
  caption?: string
  children: React.ReactNode
  className?: string
}

export const ChainOfThoughtImage = memo(function ChainOfThoughtImage({ 
  caption, 
  children, 
  className 
}: ChainOfThoughtImageProps) {
  return (
    <figure className={cn('space-y-2', className)}>
      <div className="rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
        {children}
      </div>
      {caption && (
        <figcaption className="text-body-xs text-ink-muted dark:text-ink-inverse-muted text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Icons - Memoized
// ─────────────────────────────────────────────────────────────────────────────

const BrainIcon = memo(function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  )
})

const ChevronIcon = memo(function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
})

const CheckIcon = memo(function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
})

const XIcon = memo(function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
})
