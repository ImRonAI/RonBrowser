/**
 * Tool Components
 * 
 * Display tool execution details with collapsible input/output.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'
import type { ToolState } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Tool
// ─────────────────────────────────────────────────────────────────────────────

interface ToolProps {
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}

export function Tool({ children, defaultOpen = false, className }: ToolProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cn('rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden', className)}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          if (child.type === ToolHeader) {
            return React.cloneElement(child as React.ReactElement<ToolHeaderProps>, {
              isOpen,
              onClick: () => setIsOpen(!isOpen)
            })
          }
          if (child.type === ToolContent) {
            return (
              <AnimatePresence>
                {isOpen && child}
              </AnimatePresence>
            )
          }
        }
        return child
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolHeader
// ─────────────────────────────────────────────────────────────────────────────

interface ToolHeaderProps {
  title: string
  type?: string
  state: ToolState
  isOpen?: boolean
  onClick?: () => void
  className?: string
}

export function ToolHeader({ title, type, state, isOpen, onClick, className }: ToolHeaderProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3',
        'bg-surface-50 dark:bg-surface-800',
        'hover:bg-surface-100 dark:hover:bg-surface-700',
        'transition-colors duration-200',
        className
      )}
    >
      <ToolStateIndicator state={state} />
      
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            {title}
          </span>
          {type && (
            <span className="text-label text-ink-muted dark:text-ink-inverse-muted px-1.5 py-0.5 bg-surface-200 dark:bg-surface-700 rounded">
              {type}
            </span>
          )}
        </div>
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
// ToolStateIndicator
// ─────────────────────────────────────────────────────────────────────────────

function ToolStateIndicator({ state }: { state: ToolState }) {
  const stateConfig = {
    pending: { icon: ClockIcon, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    running: { icon: null, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    success: { icon: CheckIcon, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
    error: { icon: XIcon, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
    'input-available': { icon: PlayIcon, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  }

  const config = stateConfig[state]
  const IconComponent = config.icon

  return (
    <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center', config.bg)}>
      {state === 'running' ? (
        <Loader size={14} />
      ) : IconComponent ? (
        <IconComponent className={cn('w-3.5 h-3.5', config.color)} />
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolContent
// ─────────────────────────────────────────────────────────────────────────────

interface ToolContentProps {
  children: React.ReactNode
  className?: string
}

export function ToolContent({ children, className }: ToolContentProps) {
  return (
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: 'auto' }}
      exit={{ height: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn('overflow-hidden', className)}
    >
      <div className="p-3 pt-0 space-y-3">
        {children}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolInput
// ─────────────────────────────────────────────────────────────────────────────

interface ToolInputProps {
  input: Record<string, unknown> | string
  className?: string
}

export function ToolInput({ input, className }: ToolInputProps) {
  const displayValue = typeof input === 'string' ? input : JSON.stringify(input, null, 2)

  return (
    <div className={cn('space-y-1', className)}>
      <label className="text-label text-ink-muted dark:text-ink-inverse-muted font-medium">
        Input
      </label>
      <pre className="p-3 rounded-lg bg-surface-100 dark:bg-surface-900 text-body-xs text-ink dark:text-ink-inverse font-mono overflow-x-auto">
        {displayValue}
      </pre>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolOutput
// ─────────────────────────────────────────────────────────────────────────────

interface ToolOutputProps {
  output?: string
  errorText?: string
  className?: string
}

export function ToolOutput({ output, errorText, className }: ToolOutputProps) {
  const hasError = !!errorText
  const displayValue = errorText || output

  if (!displayValue) return null

  return (
    <div className={cn('space-y-1', className)}>
      <label className={cn(
        'text-label font-medium',
        hasError ? 'text-red-500' : 'text-ink-muted dark:text-ink-inverse-muted'
      )}>
        {hasError ? 'Error' : 'Output'}
      </label>
      <pre className={cn(
        'p-3 rounded-lg text-body-xs font-mono overflow-x-auto',
        hasError 
          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
          : 'bg-surface-100 dark:bg-surface-900 text-ink dark:text-ink-inverse'
      )}>
        {displayValue}
      </pre>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
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
