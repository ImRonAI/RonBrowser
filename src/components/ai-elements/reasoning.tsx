/**
 * Reasoning Component
 * 
 * Collapsible interface to display AI thinking processes with auto-collapse behavior.
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

interface ReasoningContextValue {
  isOpen: boolean
  toggle: () => void
  isStreaming: boolean
  duration: number
}

const ReasoningContext = createContext<ReasoningContextValue>({
  isOpen: false,
  toggle: () => {},
  isStreaming: false,
  duration: 0,
})

// ─────────────────────────────────────────────────────────────────────────────
// Reasoning (Root)
// ─────────────────────────────────────────────────────────────────────────────

interface ReasoningProps {
  duration?: number
  isStreaming?: boolean
  /** Controlled open state */
  open?: boolean
  /** Uncontrolled default open state */
  defaultOpen?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  autoCollapseDelay?: number
  children: React.ReactNode
  className?: string
}

export function Reasoning({ 
  duration = 0, 
  isStreaming = false, 
  open: controlledOpen,
  defaultOpen = true,
  onOpenChange,
  autoCollapseDelay = 2000,
  children,
  className 
}: ReasoningProps) {
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
    <ReasoningContext.Provider value={{ isOpen, toggle, isStreaming, duration }}>
      <div className={cn('w-full', className)}>
        {children}
      </div>
    </ReasoningContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ReasoningTrigger
// ─────────────────────────────────────────────────────────────────────────────

interface ReasoningTriggerProps {
  className?: string
}

export function ReasoningTrigger({ className }: ReasoningTriggerProps) {
  const { isOpen, toggle, isStreaming, duration } = useContext(ReasoningContext)
  const durationSeconds = duration ? Math.round(duration / 1000) : 0

  return (
    <motion.button
      onClick={toggle}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'flex items-center gap-2',
        'px-3 py-2 rounded-lg',
        'bg-accent/5 dark:bg-accent-light/5',
        'hover:bg-accent/10 dark:hover:bg-accent-light/10',
        'transition-colors duration-200',
        className
      )}
    >
      {isStreaming ? (
        <Loader size={14} />
      ) : (
        <BrainIcon className="w-3.5 h-3.5 text-accent dark:text-accent-light" />
      )}
      
      <span className="text-body-xs font-medium text-accent dark:text-accent-light">
        {isStreaming ? 'Thinking...' : `Thought for ${durationSeconds}s`}
      </span>
      
      <ChevronIcon 
        className={cn(
          'w-3 h-3 text-accent dark:text-accent-light',
          'transition-transform duration-200',
          isOpen && 'rotate-180'
        )} 
      />
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ReasoningContent
// ─────────────────────────────────────────────────────────────────────────────

interface ReasoningContentProps {
  children: React.ReactNode
  className?: string
}

export function ReasoningContent({ children, className }: ReasoningContentProps) {
  const { isOpen } = useContext(ReasoningContext)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'mt-2 px-3 py-2 rounded-lg',
            'bg-surface-50/60 dark:bg-surface-800/60 backdrop-blur-sm',
            'border-l-2 border-accent/30 dark:border-accent-light/30',
            'overflow-hidden',
            className
          )}
        >
          <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary italic">
            {children}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
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
