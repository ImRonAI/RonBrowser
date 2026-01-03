/**
 * Chain of Thought - Email Components
 * 
 * Visualize email actions: check, read, compose, reply, forward, send.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EmailAction = 'check' | 'read' | 'compose' | 'reply' | 'forward' | 'send' | 'archive' | 'delete'

export interface EmailData {
  id: string
  from: { name: string; email: string }
  to: { name: string; email: string }[]
  cc?: { name: string; email: string }[]
  subject: string
  body?: string
  bodyPreview?: string
  date?: Date
  isRead?: boolean
  hasAttachments?: boolean
  labels?: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtEmail
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtEmailProps {
  action: EmailAction
  status: 'pending' | 'running' | 'complete' | 'error'
  email?: EmailData
  unreadCount?: number
  className?: string
  children?: React.ReactNode
}

export function ChainOfThoughtEmail({
  action,
  status,
  email,
  unreadCount,
  className,
  children
}: ChainOfThoughtEmailProps) {
  const config = getEmailActionConfig(action)

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      config.borderColor,
      className
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2',
        config.bgColor,
        'border-b border-surface-200 dark:border-surface-700'
      )}>
        <div className="flex items-center gap-2">
          {status === 'running' ? (
            <Loader size={16} />
          ) : (
            <config.Icon className={cn('w-4 h-4', config.iconColor)} />
          )}
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            {config.label}
          </span>
        </div>

        {action === 'check' && unreadCount !== undefined && (
          <span className="text-label px-2 py-0.5 rounded-full bg-red-500 text-white">
            {unreadCount} unread
          </span>
        )}
      </div>

      {/* Email preview/content */}
      {email && (
        <ChainOfThoughtEmailPreview email={email} action={action} />
      )}

      {/* Compose area or additional content */}
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtEmailPreview
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtEmailPreviewProps {
  email: EmailData
  action: EmailAction
  className?: string
}

export function ChainOfThoughtEmailPreview({
  email,
  action,
  className
}: ChainOfThoughtEmailPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(action === 'read')

  return (
    <div className={cn('', className)}>
      {/* Email header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 text-left hover:bg-surface-50 dark:hover:bg-surface-850 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-body-sm font-medium text-white">
              {email.from.name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={cn(
                'text-body-sm truncate',
                !email.isRead && 'font-semibold text-ink dark:text-ink-inverse'
              )}>
                {email.from.name}
              </span>
              {email.date && (
                <span className="text-label text-ink-muted dark:text-ink-inverse-muted flex-shrink-0">
                  {email.date.toLocaleDateString()}
                </span>
              )}
            </div>
            <p className={cn(
              'text-body-sm truncate',
              !email.isRead 
                ? 'text-ink dark:text-ink-inverse font-medium' 
                : 'text-ink-secondary dark:text-ink-inverse-secondary'
            )}>
              {email.subject}
            </p>
            {email.bodyPreview && !isExpanded && (
              <p className="text-body-xs text-ink-muted dark:text-ink-inverse-muted truncate mt-0.5">
                {email.bodyPreview}
              </p>
            )}

            {/* Labels/attachments */}
            <div className="flex items-center gap-2 mt-1">
              {email.hasAttachments && (
                <AttachmentIcon className="w-3.5 h-3.5 text-ink-muted dark:text-ink-inverse-muted" />
              )}
              {email.labels?.map(label => (
                <span 
                  key={label}
                  className="text-label px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-700 text-ink-muted dark:text-ink-inverse-muted"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <ChevronIcon className={cn(
            'w-4 h-4 text-ink-muted dark:text-ink-inverse-muted transition-transform flex-shrink-0',
            isExpanded && 'rotate-180'
          )} />
        </div>
      </button>

      {/* Full email body */}
      <AnimatePresence>
        {isExpanded && email.body && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-surface-200 dark:border-surface-700"
          >
            <div className="p-4">
              {/* To/CC */}
              <div className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary mb-3 space-y-1">
                <p>
                  <span className="text-ink-muted dark:text-ink-inverse-muted">To: </span>
                  {email.to.map(t => t.email).join(', ')}
                </p>
                {email.cc && email.cc.length > 0 && (
                  <p>
                    <span className="text-ink-muted dark:text-ink-inverse-muted">Cc: </span>
                    {email.cc.map(c => c.email).join(', ')}
                  </p>
                )}
              </div>

              {/* Body */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-body-sm text-ink dark:text-ink-inverse">
                  {email.body}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtEmailCompose
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtEmailComposeProps {
  to: string
  cc?: string
  subject: string
  body: string
  isStreaming?: boolean
  status: 'pending' | 'running' | 'complete' | 'error'
  className?: string
}

export function ChainOfThoughtEmailCompose({
  to,
  cc,
  subject,
  body,
  isStreaming,
  status,
  className
}: ChainOfThoughtEmailComposeProps) {
  return (
    <div className={cn(
      'rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <PenIcon className="w-4 h-4 text-green-500" />
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            Compose Email
          </span>
        </div>
        {status === 'running' && isStreaming && (
          <span className="text-label text-green-600 dark:text-green-400 flex items-center gap-1">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-green-500"
            />
            Writing...
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="p-3 space-y-2 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <span className="text-label text-ink-muted dark:text-ink-inverse-muted w-12">To:</span>
          <span className="text-body-sm text-ink dark:text-ink-inverse">{to}</span>
        </div>
        {cc && (
          <div className="flex items-center gap-2">
            <span className="text-label text-ink-muted dark:text-ink-inverse-muted w-12">Cc:</span>
            <span className="text-body-sm text-ink dark:text-ink-inverse">{cc}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-label text-ink-muted dark:text-ink-inverse-muted w-12">Subject:</span>
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">{subject}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        <p className="text-body-sm text-ink dark:text-ink-inverse whitespace-pre-wrap">
          {body}
          {isStreaming && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="inline-block w-2 h-4 bg-green-500 ml-0.5"
            />
          )}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtEmailList
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtEmailListProps {
  emails: EmailData[]
  selectedId?: string
  onSelect?: (id: string) => void
  className?: string
}

export function ChainOfThoughtEmailList({
  emails,
  selectedId,
  onSelect,
  className
}: ChainOfThoughtEmailListProps) {
  return (
    <div className={cn(
      'rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden divide-y divide-surface-200 dark:divide-surface-700',
      className
    )}>
      {emails.map(email => (
        <button
          key={email.id}
          onClick={() => onSelect?.(email.id)}
          className={cn(
            'w-full p-3 text-left hover:bg-surface-50 dark:hover:bg-surface-850 transition-colors',
            selectedId === email.id && 'bg-accent/5 dark:bg-accent-light/5'
          )}
        >
          <div className="flex items-start gap-3">
            {/* Unread indicator */}
            <div className={cn(
              'w-2 h-2 rounded-full mt-2 flex-shrink-0',
              email.isRead ? 'bg-transparent' : 'bg-blue-500'
            )} />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={cn(
                  'text-body-sm truncate',
                  !email.isRead && 'font-semibold'
                )}>
                  {email.from.name}
                </span>
                {email.date && (
                  <span className="text-label text-ink-muted dark:text-ink-inverse-muted flex-shrink-0">
                    {email.date.toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className={cn(
                'text-body-sm truncate',
                !email.isRead ? 'text-ink dark:text-ink-inverse' : 'text-ink-secondary dark:text-ink-inverse-secondary'
              )}>
                {email.subject}
              </p>
              {email.bodyPreview && (
                <p className="text-body-xs text-ink-muted dark:text-ink-inverse-muted truncate mt-0.5">
                  {email.bodyPreview}
                </p>
              )}
            </div>

            {email.hasAttachments && (
              <AttachmentIcon className="w-4 h-4 text-ink-muted dark:text-ink-inverse-muted flex-shrink-0" />
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getEmailActionConfig(action: EmailAction) {
  const configs: Record<EmailAction, {
    Icon: React.FC<{ className?: string }>
    label: string
    iconColor: string
    borderColor: string
    bgColor: string
  }> = {
    check: { 
      Icon: InboxIcon, 
      label: 'Check Email',
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-200 dark:border-blue-800',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    read: { 
      Icon: MailOpenIcon, 
      label: 'Read Email',
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-200 dark:border-blue-800',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    compose: { 
      Icon: PenIcon, 
      label: 'Compose Email',
      iconColor: 'text-green-500',
      borderColor: 'border-green-200 dark:border-green-800',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    reply: { 
      Icon: ReplyIcon, 
      label: 'Reply',
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-200 dark:border-blue-800',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    forward: { 
      Icon: ForwardIcon, 
      label: 'Forward',
      iconColor: 'text-purple-500',
      borderColor: 'border-purple-200 dark:border-purple-800',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    },
    send: { 
      Icon: SendIcon, 
      label: 'Send Email',
      iconColor: 'text-green-500',
      borderColor: 'border-green-200 dark:border-green-800',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    archive: { 
      Icon: ArchiveIcon, 
      label: 'Archive',
      iconColor: 'text-amber-500',
      borderColor: 'border-amber-200 dark:border-amber-800',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20'
    },
    delete: { 
      Icon: TrashIcon, 
      label: 'Delete',
      iconColor: 'text-red-500',
      borderColor: 'border-red-200 dark:border-red-800',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    },
  }
  return configs[action]
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}

function MailOpenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z" />
      <path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />
    </svg>
  )
}

function PenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  )
}

function ReplyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  )
}

function ForwardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  )
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function AttachmentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
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


