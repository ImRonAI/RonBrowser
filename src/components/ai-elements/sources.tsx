/**
 * Sources Components
 * 
 * Display source citations and references for AI responses.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// Sources
// ─────────────────────────────────────────────────────────────────────────────

interface SourcesProps {
  children: React.ReactNode
  className?: string
}

export function Sources({ children, className }: SourcesProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn('relative', className)}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          if (child.type === SourcesTrigger) {
            return React.cloneElement(child as React.ReactElement<SourcesTriggerProps>, {
              isOpen,
              onClick: () => setIsOpen(!isOpen)
            })
          }
          if (child.type === SourcesContent) {
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
// SourcesTrigger
// ─────────────────────────────────────────────────────────────────────────────

interface SourcesTriggerProps {
  count: number
  isOpen?: boolean
  onClick?: () => void
  className?: string
}

export function SourcesTrigger({ count, isOpen, onClick, className }: SourcesTriggerProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'flex items-center gap-2',
        'px-3 py-1.5 rounded-lg',
        'bg-blue-50 dark:bg-blue-900/20',
        'hover:bg-blue-100 dark:hover:bg-blue-900/30',
        'text-blue-600 dark:text-blue-400',
        'transition-colors duration-200',
        className
      )}
    >
      <DocumentIcon className="w-3.5 h-3.5" />
      <span className="text-body-xs font-medium">
        {count} source{count !== 1 ? 's' : ''}
      </span>
      <ChevronIcon 
        className={cn(
          'w-3 h-3 transition-transform duration-200',
          isOpen && 'rotate-180'
        )} 
      />
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SourcesContent
// ─────────────────────────────────────────────────────────────────────────────

interface SourcesContentProps {
  children: React.ReactNode
  className?: string
}

export function SourcesContent({ children, className }: SourcesContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'mt-2 p-2 rounded-xl',
        'bg-surface-50 dark:bg-surface-800',
        'border border-surface-200 dark:border-surface-700',
        'space-y-1',
        'overflow-hidden',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Source
// ─────────────────────────────────────────────────────────────────────────────

interface SourceProps {
  href: string
  title: string
  snippet?: string
  favicon?: string
  className?: string
}

export function Source({ href, title, snippet, favicon, className }: SourceProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block p-2 rounded-lg',
        'hover:bg-surface-100 dark:hover:bg-surface-700',
        'transition-colors duration-200',
        'group',
        className
      )}
    >
      <div className="flex items-start gap-2">
        {favicon ? (
          <img src={favicon} alt="" className="w-4 h-4 rounded mt-0.5" />
        ) : (
          <LinkIcon className="w-4 h-4 text-ink-muted dark:text-ink-inverse-muted mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-ink dark:text-ink-inverse truncate group-hover:text-accent dark:group-hover:text-accent-light">
            {title}
          </p>
          {snippet && (
            <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary mt-0.5 line-clamp-2">
              {snippet}
            </p>
          )}
          <p className="text-label text-ink-muted dark:text-ink-inverse-muted mt-1 truncate">
            {new URL(href).hostname}
          </p>
        </div>
        <ExternalLinkIcon className="w-3.5 h-3.5 text-ink-muted dark:text-ink-inverse-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </a>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineCitation
// ─────────────────────────────────────────────────────────────────────────────

interface InlineCitationProps {
  index: number
  href: string
  title: string
  className?: string
}

export function InlineCitation({ index, href, title, className }: InlineCitationProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={cn(
        'inline-flex items-center justify-center',
        'w-4 h-4 rounded-full',
        'bg-blue-100 dark:bg-blue-900/30',
        'text-blue-600 dark:text-blue-400',
        'text-[10px] font-medium',
        'hover:bg-blue-200 dark:hover:bg-blue-900/50',
        'transition-colors duration-200',
        'cursor-pointer',
        className
      )}
    >
      {index}
    </a>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
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
