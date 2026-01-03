/**
 * Actions Components
 * 
 * Message action buttons like copy, retry, regenerate.
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

interface ActionsProps {
  children: React.ReactNode
  className?: string
}

export function Actions({ children, className }: ActionsProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Action
// ─────────────────────────────────────────────────────────────────────────────

interface ActionProps {
  tooltip: string
  label?: string
  variant?: 'ghost' | 'default'
  size?: 'sm' | 'md'
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}

export function Action({ 
  tooltip, 
  label, 
  variant = 'ghost',
  size = 'sm',
  onClick, 
  disabled,
  children,
  className 
}: ActionProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      title={tooltip}
      className={cn(
        'rounded-lg flex items-center justify-center gap-1.5',
        'transition-colors duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // Size
        size === 'sm' && 'p-1.5',
        size === 'md' && 'px-2.5 py-1.5',
        // Variant
        variant === 'ghost' && [
          'text-ink-muted dark:text-ink-inverse-muted',
          'hover:bg-surface-100 dark:hover:bg-surface-700',
          'hover:text-ink dark:hover:text-ink-inverse',
        ],
        variant === 'default' && [
          'bg-surface-100 dark:bg-surface-700',
          'text-ink dark:text-ink-inverse',
          'hover:bg-surface-200 dark:hover:bg-surface-600',
        ],
        className
      )}
    >
      <span className={cn(size === 'sm' && 'w-4 h-4', size === 'md' && 'w-4 h-4')}>
        {children}
      </span>
      {label && (
        <span className="text-body-xs font-medium">{label}</span>
      )}
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CopyAction
// ─────────────────────────────────────────────────────────────────────────────

interface CopyActionProps {
  text: string
  className?: string
}

export function CopyAction({ text, className }: CopyActionProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Action 
      tooltip={copied ? 'Copied!' : 'Copy'} 
      onClick={handleCopy}
      className={className}
    >
      {copied ? (
        <CheckIcon className="w-full h-full text-green-500" />
      ) : (
        <CopyIcon className="w-full h-full" />
      )}
    </Action>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RetryAction
// ─────────────────────────────────────────────────────────────────────────────

interface RetryActionProps {
  onClick: () => void
  className?: string
}

export function RetryAction({ onClick, className }: RetryActionProps) {
  return (
    <Action tooltip="Retry" onClick={onClick} className={className}>
      <RefreshIcon className="w-full h-full" />
    </Action>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RegenerateAction
// ─────────────────────────────────────────────────────────────────────────────

interface RegenerateActionProps {
  onClick: () => void
  className?: string
}

export function RegenerateAction({ onClick, className }: RegenerateActionProps) {
  return (
    <Action tooltip="Regenerate response" onClick={onClick} className={className}>
      <SparklesIcon className="w-full h-full" />
    </Action>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ThumbsUpAction / ThumbsDownAction
// ─────────────────────────────────────────────────────────────────────────────

interface FeedbackActionProps {
  onClick: () => void
  active?: boolean
  className?: string
}

export function ThumbsUpAction({ onClick, active, className }: FeedbackActionProps) {
  return (
    <Action 
      tooltip="Good response" 
      onClick={onClick}
      className={cn(active && 'text-green-500 dark:text-green-400', className)}
    >
      <ThumbsUpIcon className="w-full h-full" />
    </Action>
  )
}

export function ThumbsDownAction({ onClick, active, className }: FeedbackActionProps) {
  return (
    <Action 
      tooltip="Bad response" 
      onClick={onClick}
      className={cn(active && 'text-red-500 dark:text-red-400', className)}
    >
      <ThumbsDownIcon className="w-full h-full" />
    </Action>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
    </svg>
  )
}

function ThumbsUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  )
}

function ThumbsDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  )
}

