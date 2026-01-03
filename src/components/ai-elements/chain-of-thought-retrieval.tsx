/**
 * Chain of Thought - Retrieval Components
 * 
 * Unified visualization for data retrieval from databases, APIs, web, vector stores.
 */

import React from 'react'
import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RetrievalSourceType = 
  | 'web'
  | 'database'
  | 'api'
  | 'vector'
  | 'file'
  | 'cache'
  | 'browser'

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtRetrieval
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtRetrievalProps {
  sourceType: RetrievalSourceType
  sourceName: string
  query: string | object
  resultCount?: number
  duration?: number
  children?: React.ReactNode
  className?: string
}

export function ChainOfThoughtRetrieval({
  sourceType,
  sourceName,
  query,
  resultCount,
  duration,
  children,
  className
}: ChainOfThoughtRetrievalProps) {
  const config = getSourceConfig(sourceType)

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden',
      config.borderColor,
      className
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2',
        config.bgColor
      )}>
        <div className="flex items-center gap-2">
          <config.Icon className={cn('w-4 h-4', config.iconColor)} />
          <span className="text-body-xs font-medium text-ink dark:text-ink-inverse">
            {sourceName}
          </span>
          <span className={cn(
            'text-label px-1.5 py-0.5 rounded',
            config.badgeBg, config.badgeText
          )}>
            {sourceType}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-body-xs text-ink-muted dark:text-ink-inverse-muted">
          {resultCount !== undefined && (
            <span>{resultCount} result{resultCount !== 1 ? 's' : ''}</span>
          )}
          {duration !== undefined && (
            <span>{duration}ms</span>
          )}
        </div>
      </div>
      
      {/* Query display */}
      <div className="px-3 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
        <code className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary font-mono break-all">
          {typeof query === 'string' ? query : JSON.stringify(query, null, 2)}
        </code>
      </div>
      
      {/* Results */}
      {children && (
        <div className="p-2 space-y-1">
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtRetrievalItem
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtRetrievalItemProps {
  title: string
  content?: string
  url?: string
  table?: string
  confidence?: number
  sourceType: RetrievalSourceType
  className?: string
}

export function ChainOfThoughtRetrievalItem({
  title,
  content,
  url,
  table,
  confidence,
  sourceType,
  className
}: ChainOfThoughtRetrievalItemProps) {
  return (
    <div className={cn(
      'p-2 rounded-lg',
      'bg-surface-50 dark:bg-surface-800',
      'hover:bg-surface-100 dark:hover:bg-surface-700',
      'transition-colors',
      className
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-ink dark:text-ink-inverse truncate">
            {title}
          </p>
          
          {/* Context-specific metadata */}
          {table && (
            <p className="text-label text-ink-muted dark:text-ink-inverse-muted mt-0.5">
              Table: <code className="text-amber-600 dark:text-amber-400">{table}</code>
            </p>
          )}
          {url && (
            <p className="text-label text-ink-muted dark:text-ink-inverse-muted mt-0.5 truncate">
              {(() => {
                try {
                  return new URL(url).hostname
                } catch {
                  return url
                }
              })()}
            </p>
          )}
          
          {content && (
            <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary mt-1 line-clamp-2">
              {content}
            </p>
          )}
        </div>
        
        {/* Confidence score for vector search */}
        {confidence !== undefined && (
          <div className="flex-shrink-0">
            <div className={cn(
              'px-1.5 py-0.5 rounded text-label font-medium',
              confidence >= 0.8 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : confidence >= 0.5
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            )}>
              {Math.round(confidence * 100)}%
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Source Configuration
// ─────────────────────────────────────────────────────────────────────────────

function getSourceConfig(type: RetrievalSourceType) {
  const configs: Record<RetrievalSourceType, {
    Icon: React.FC<{ className?: string }>
    iconColor: string
    bgColor: string
    borderColor: string
    badgeBg: string
    badgeText: string
  }> = {
    web: {
      Icon: GlobeIcon,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
      badgeText: 'text-blue-600 dark:text-blue-400',
    },
    database: {
      Icon: DatabaseIcon,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      borderColor: 'border-amber-200 dark:border-amber-800',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
      badgeText: 'text-amber-600 dark:text-amber-400',
    },
    api: {
      Icon: BoltIcon,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
      badgeBg: 'bg-purple-100 dark:bg-purple-900/30',
      badgeText: 'text-purple-600 dark:text-purple-400',
    },
    vector: {
      Icon: BrainIcon,
      iconColor: 'text-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      borderColor: 'border-indigo-200 dark:border-indigo-800',
      badgeBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      badgeText: 'text-indigo-600 dark:text-indigo-400',
    },
    file: {
      Icon: DocumentIcon,
      iconColor: 'text-gray-500',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      borderColor: 'border-gray-200 dark:border-gray-700',
      badgeBg: 'bg-gray-100 dark:bg-gray-800',
      badgeText: 'text-gray-600 dark:text-gray-400',
    },
    cache: {
      Icon: LightningIcon,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      badgeBg: 'bg-green-100 dark:bg-green-900/30',
      badgeText: 'text-green-600 dark:text-green-400',
    },
    browser: {
      Icon: ScreenIcon,
      iconColor: 'text-cyan-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      borderColor: 'border-cyan-200 dark:border-cyan-800',
      badgeBg: 'bg-cyan-100 dark:bg-cyan-900/30',
      badgeText: 'text-cyan-600 dark:text-cyan-400',
    },
  }
  return configs[type]
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  )
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function LightningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function ScreenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}


