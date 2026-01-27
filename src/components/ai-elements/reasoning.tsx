/**
 * Reasoning Component
 * 
 * Collapsible interface to display AI thinking processes with auto-collapse behavior.
 * 
 * Implementation follows official Vercel AI Elements pattern:
 * - Memoized components to prevent re-renders
 * - Duration tracking when streaming starts/ends
 * - Auto-open on streaming, auto-close when complete (once only)
 */

'use client'

import React, { useState, useEffect, useCallback, createContext, useContext, useRef, memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'
import { ResponseMarkdown } from './response'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const AUTO_CLOSE_DELAY = 1500

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface ReasoningContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  markUserInteraction: () => void
  isStreaming: boolean
  duration: number
}

const ReasoningContext = createContext<ReasoningContextValue>({
  isOpen: false,
  setIsOpen: () => {},
  markUserInteraction: () => {},
  isStreaming: false,
  duration: 0,
})

export const useReasoning = () => useContext(ReasoningContext)

// ─────────────────────────────────────────────────────────────────────────────
// Reasoning (Root) - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ReasoningProps {
  isStreaming?: boolean
  /** Duration in milliseconds (optional, will be calculated if not provided) */
  duration?: number
  /** Controlled open state */
  open?: boolean
  /** Uncontrolled default open state */
  defaultOpen?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  /** Delay before auto-collapse after streaming ends */
  autoCollapseDelay?: number
  children: React.ReactNode
  className?: string
}

export const Reasoning = memo(function Reasoning({ 
  isStreaming = false, 
  duration: durationProp,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  autoCollapseDelay = AUTO_CLOSE_DELAY,
  children,
  className 
}: ReasoningProps) {
  // State
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const [internalDuration, setInternalDuration] = useState(0)
  
  // Use provided duration or internal tracked duration
  const duration = durationProp ?? internalDuration
  
  // Refs to track edges and prevent repeated auto-close
  const hasAutoClosedRef = useRef(false)
  const startTimeRef = useRef<number | null>(null)
  const prevStreamingRef = useRef(isStreaming)
  const userInteractedRef = useRef(false)
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Controlled/uncontrolled
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setIsOpen = useCallback((newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }, [isControlled, onOpenChange])

  const markUserInteraction = useCallback(() => {
    userInteractedRef.current = true
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
    hasAutoClosedRef.current = true
  }, [])

  // Track duration and handle auto-open/close on streaming edges
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current
    prevStreamingRef.current = isStreaming

    // Rising edge: streaming started
    if (!wasStreaming && isStreaming) {
      startTimeRef.current = Date.now()
      hasAutoClosedRef.current = false
      userInteractedRef.current = false
      // Auto-open when streaming starts
      if (!isOpen) {
        setIsOpen(true)
      }
    }

    // Falling edge: streaming ended
    if (wasStreaming && !isStreaming) {
      // Calculate duration (only if not provided externally)
      if (durationProp === undefined && startTimeRef.current !== null) {
        setInternalDuration(Math.round((Date.now() - startTimeRef.current) / 1000))
        startTimeRef.current = null
      }
      
      // Auto-close after delay (once only)
      if (isOpen && !hasAutoClosedRef.current && !userInteractedRef.current) {
        collapseTimerRef.current = setTimeout(() => {
          setIsOpen(false)
          hasAutoClosedRef.current = true
          collapseTimerRef.current = null
        }, autoCollapseDelay)
        return () => {
          if (collapseTimerRef.current) {
            clearTimeout(collapseTimerRef.current)
            collapseTimerRef.current = null
          }
        }
      }

      if (!isOpen) {
        hasAutoClosedRef.current = true
      }
    }
  }, [isStreaming, isOpen, autoCollapseDelay, durationProp, setIsOpen])

  const contextValue = useMemo(() => ({
    isOpen,
    setIsOpen,
    markUserInteraction,
    isStreaming,
    duration,
  }), [isOpen, setIsOpen, markUserInteraction, isStreaming, duration])

  return (
    <ReasoningContext.Provider value={contextValue}>
      <div className={cn('w-full', className)}>
        {children}
      </div>
    </ReasoningContext.Provider>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ReasoningTrigger - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ReasoningTriggerProps {
  title?: string
  className?: string
}

export const ReasoningTrigger = memo(function ReasoningTrigger({ 
  title = 'Thinking',
  className 
}: ReasoningTriggerProps) {
  const { isOpen, setIsOpen, markUserInteraction, isStreaming, duration } = useReasoning()

  const handleClick = useCallback(() => {
    markUserInteraction()
    if (isStreaming) {
      if (!isOpen) {
        setIsOpen(true)
      }
      return
    }
    setIsOpen(!isOpen)
  }, [isOpen, isStreaming, setIsOpen, markUserInteraction])

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2',
        'px-3 py-2 rounded-lg',
        'bg-violet-50 dark:bg-violet-900/20',
        'hover:bg-violet-100 dark:hover:bg-violet-900/30',
        'transition-colors duration-200',
        'text-sm',
        className
      )}
    >
      {isStreaming ? (
        <Loader size={14} />
      ) : (
        <BrainIcon className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
      )}
      
      <span className="font-medium text-violet-700 dark:text-violet-300">
        {isStreaming || duration === 0 
          ? `${title}...` 
          : `Thought for ${duration}s`
        }
      </span>
      
      <ChevronIcon 
        className={cn(
          'w-3.5 h-3.5 text-violet-500 dark:text-violet-400',
          'transition-transform duration-200',
          isOpen && 'rotate-180'
        )} 
      />
    </button>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ReasoningContent - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ReasoningContentProps {
  children: React.ReactNode
  className?: string
}

export const ReasoningContent = memo(function ReasoningContent({ 
  children, 
  className 
}: ReasoningContentProps) {
  const { isOpen } = useReasoning()

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ 
            height: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 0.2 }
          }}
          className={cn(
            'mt-2 overflow-hidden',
            className
          )}
        >
          <div className={cn(
            'px-4 py-3 rounded-lg',
            'bg-violet-50/50 dark:bg-violet-900/10',
            'border-l-2 border-violet-300 dark:border-violet-700',
          )}>
            {typeof children === 'string' ? (
              <ResponseMarkdown 
                content={children} 
                className="text-sm text-ink-secondary dark:text-ink-inverse-secondary leading-relaxed"
              />
            ) : (
              <div className="text-sm text-ink-secondary dark:text-ink-inverse-secondary leading-relaxed">
                {children}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
