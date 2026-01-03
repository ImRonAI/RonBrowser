/**
 * Branch Components
 * 
 * Manage multiple conversation branches or alternative responses.
 */

import React, { useState, createContext, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface BranchContextValue {
  currentBranch: number
  totalBranches: number
  setCurrentBranch: (index: number) => void
  goToPrevious: () => void
  goToNext: () => void
}

const BranchContext = createContext<BranchContextValue | null>(null)

function useBranch() {
  const context = useContext(BranchContext)
  if (!context) {
    throw new Error('useBranch must be used within a Branch')
  }
  return context
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch
// ─────────────────────────────────────────────────────────────────────────────

interface BranchProps {
  defaultBranch?: number
  children: React.ReactNode
  className?: string
}

export function Branch({ defaultBranch = 0, children, className }: BranchProps) {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch)
  
  // Count total branches from BranchMessages children
  let totalBranches = 0
  React.Children.forEach(children, child => {
    if (React.isValidElement(child) && child.type === BranchMessages) {
      totalBranches = React.Children.count(child.props.children)
    }
  })

  const goToPrevious = () => {
    setCurrentBranch(prev => Math.max(0, prev - 1))
  }

  const goToNext = () => {
    setCurrentBranch(prev => Math.min(totalBranches - 1, prev + 1))
  }

  return (
    <BranchContext.Provider value={{ 
      currentBranch, 
      totalBranches, 
      setCurrentBranch, 
      goToPrevious, 
      goToNext 
    }}>
      <div className={cn('relative', className)}>
        {children}
      </div>
    </BranchContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BranchMessages
// ─────────────────────────────────────────────────────────────────────────────

interface BranchMessagesProps {
  children: React.ReactNode
  className?: string
}

export function BranchMessages({ children, className }: BranchMessagesProps) {
  const { currentBranch } = useBranch()
  const childrenArray = React.Children.toArray(children)

  return (
    <div className={cn('relative', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBranch}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {childrenArray[currentBranch]}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BranchSelector
// ─────────────────────────────────────────────────────────────────────────────

interface BranchSelectorProps {
  from?: 'user' | 'assistant'
  className?: string
  children?: React.ReactNode
}

export function BranchSelector({ from, className, children }: BranchSelectorProps) {
  const { totalBranches } = useBranch()

  // Don't render if only one branch
  if (totalBranches <= 1) return null

  return (
    <div 
      className={cn(
        'flex items-center gap-1',
        from === 'user' && 'justify-end',
        className
      )}
    >
      {children || (
        <>
          <BranchPrevious />
          <BranchPage />
          <BranchNext />
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BranchPrevious
// ─────────────────────────────────────────────────────────────────────────────

interface BranchPreviousProps {
  className?: string
}

export function BranchPrevious({ className }: BranchPreviousProps) {
  const { currentBranch, goToPrevious } = useBranch()
  const isDisabled = currentBranch === 0

  return (
    <motion.button
      onClick={goToPrevious}
      disabled={isDisabled}
      whileHover={{ scale: isDisabled ? 1 : 1.1 }}
      whileTap={{ scale: isDisabled ? 1 : 0.9 }}
      className={cn(
        'w-6 h-6 rounded-md flex items-center justify-center',
        'hover:bg-surface-100 dark:hover:bg-surface-700',
        'transition-colors duration-200',
        isDisabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      <ChevronLeftIcon className="w-3.5 h-3.5 text-ink-muted dark:text-ink-inverse-muted" />
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BranchNext
// ─────────────────────────────────────────────────────────────────────────────

interface BranchNextProps {
  className?: string
}

export function BranchNext({ className }: BranchNextProps) {
  const { currentBranch, totalBranches, goToNext } = useBranch()
  const isDisabled = currentBranch === totalBranches - 1

  return (
    <motion.button
      onClick={goToNext}
      disabled={isDisabled}
      whileHover={{ scale: isDisabled ? 1 : 1.1 }}
      whileTap={{ scale: isDisabled ? 1 : 0.9 }}
      className={cn(
        'w-6 h-6 rounded-md flex items-center justify-center',
        'hover:bg-surface-100 dark:hover:bg-surface-700',
        'transition-colors duration-200',
        isDisabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      <ChevronRightIcon className="w-3.5 h-3.5 text-ink-muted dark:text-ink-inverse-muted" />
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BranchPage
// ─────────────────────────────────────────────────────────────────────────────

interface BranchPageProps {
  className?: string
}

export function BranchPage({ className }: BranchPageProps) {
  const { currentBranch, totalBranches } = useBranch()

  return (
    <span className={cn(
      'text-label text-ink-muted dark:text-ink-inverse-muted',
      'min-w-[3rem] text-center',
      className
    )}>
      {currentBranch + 1} / {totalBranches}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

