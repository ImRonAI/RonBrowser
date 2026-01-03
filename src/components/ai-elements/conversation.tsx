/**
 * Conversation Components
 * 
 * Container for chat messages with auto-scroll behavior and proper message layout.
 */

import React, { useRef, useEffect, useState, useCallback, createContext, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface ConversationContextValue {
  scrollToBottom: () => void
  isAtBottom: boolean
  setIsAtBottom: (value: boolean) => void
}

const ConversationContext = createContext<ConversationContextValue | null>(null)

export function useConversation() {
  const context = useContext(ConversationContext)
  if (!context) {
    throw new Error('useConversation must be used within a Conversation')
  }
  return context
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation
// ─────────────────────────────────────────────────────────────────────────────

interface ConversationProps {
  children: React.ReactNode
  className?: string
}

export function Conversation({ children, className }: ConversationProps) {
  const [isAtBottom, setIsAtBottom] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [])

  return (
    <ConversationContext.Provider value={{ scrollToBottom, isAtBottom, setIsAtBottom }}>
      <div 
        ref={containerRef}
        className={cn(
          'flex flex-col h-full',
          className
        )}
      >
        {children}
      </div>
    </ConversationContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConversationContent
// ─────────────────────────────────────────────────────────────────────────────

interface ConversationContentProps {
  children: React.ReactNode
  className?: string
}

export function ConversationContent({ children, className }: ConversationContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { setIsAtBottom } = useConversation()

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isBottom = scrollHeight - scrollTop - clientHeight < 100
    setIsAtBottom(isBottom)
  }, [setIsAtBottom])

  // Auto-scroll on new content
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new MutationObserver(() => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200
      
      if (isNearBottom) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        })
      }
    })

    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        'flex-1 overflow-y-auto overflow-x-hidden',
        'scrollbar-thin scrollbar-thumb-surface-300 dark:scrollbar-thumb-surface-600',
        'scrollbar-track-transparent',
        className
      )}
    >
      <div className="max-w-4xl mx-auto px-4 py-6">
        <AnimatePresence mode="popLayout">
          {children}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConversationScrollButton
// ─────────────────────────────────────────────────────────────────────────────

interface ConversationScrollButtonProps {
  className?: string
}

export function ConversationScrollButton({ className }: ConversationScrollButtonProps) {
  const { scrollToBottom, isAtBottom } = useConversation()

  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          onClick={scrollToBottom}
          className={cn(
            'absolute bottom-24 left-1/2 -translate-x-1/2',
            'flex items-center gap-2 px-4 py-2 rounded-full',
            'bg-surface-900 dark:bg-surface-100',
            'text-white dark:text-ink',
            'text-body-sm font-medium',
            'shadow-lg hover:shadow-xl',
            'transition-shadow duration-200',
            className
          )}
        >
          <ArrowDownIcon className="w-4 h-4" />
          <span>Scroll to bottom</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConversationEmptyState
// ─────────────────────────────────────────────────────────────────────────────

interface ConversationEmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}

export function ConversationEmptyState({ 
  icon, 
  title, 
  description, 
  children,
  className 
}: ConversationEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex-1 flex flex-col items-center justify-center p-8',
        className
      )}
    >
      {icon && (
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          {icon}
        </motion.div>
      )}
      
      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="text-display-sm font-semibold text-ink dark:text-ink-inverse mb-2 text-center"
      >
        {title}
      </motion.h3>
      
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-body-md text-ink-secondary dark:text-ink-inverse-secondary text-center max-w-md"
        >
          {description}
        </motion.p>
      )}
      
      {children && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 w-full"
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  )
}
