/**
 * Chain of Thought - File Operations Components
 * 
 * Visualize file creation, editing, deletion, and movement.
 */

import React from 'react'
import { cn } from '@/utils/cn'
import { Loader } from './loader'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FileAction = 'create' | 'edit' | 'delete' | 'rename' | 'move'

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtFileEdit
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtFileEditProps {
  action: FileAction
  filepath: string
  newPath?: string
  language?: string
  diff?: {
    additions: number
    deletions: number
  }
  preview?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  className?: string
}

export function ChainOfThoughtFileEdit({
  action,
  filepath,
  newPath,
  language,
  diff,
  preview,
  status,
  className
}: ChainOfThoughtFileEditProps) {
  const config = getFileActionConfig(action)

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
          {language && (
            <span className="text-label px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-700 text-ink-muted dark:text-ink-inverse-muted">
              {language}
            </span>
          )}
        </div>

        {diff && (
          <div className="flex items-center gap-2 text-label">
            <span className="text-green-600 dark:text-green-400">+{diff.additions}</span>
            <span className="text-red-600 dark:text-red-400">-{diff.deletions}</span>
          </div>
        )}
      </div>

      {/* File path */}
      <div className="px-3 py-2 bg-surface-50 dark:bg-surface-850 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <FileIcon className="w-4 h-4 text-ink-muted dark:text-ink-inverse-muted flex-shrink-0" />
          <code className="text-body-xs font-mono text-ink-secondary dark:text-ink-inverse-secondary truncate">
            {filepath}
          </code>
          {newPath && (
            <>
              <ArrowRightIcon className="w-4 h-4 text-ink-muted dark:text-ink-inverse-muted flex-shrink-0" />
              <code className="text-body-xs font-mono text-ink-secondary dark:text-ink-inverse-secondary truncate">
                {newPath}
              </code>
            </>
          )}
        </div>
      </div>

      {/* Code preview */}
      {preview && (
        <pre className={cn(
          'p-3 overflow-x-auto',
          'bg-surface-900 dark:bg-surface-950',
          'font-mono text-body-xs text-surface-100'
        )}>
          <code>{preview}</code>
        </pre>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtFileDiff
// ─────────────────────────────────────────────────────────────────────────────

interface DiffLine {
  type: 'add' | 'remove' | 'context'
  content: string
  lineNumber?: number
}

interface ChainOfThoughtFileDiffProps {
  filepath: string
  lines: DiffLine[]
  className?: string
}

export function ChainOfThoughtFileDiff({
  filepath,
  lines,
  className
}: ChainOfThoughtFileDiffProps) {
  return (
    <div className={cn(
      'rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
        <DiffIcon className="w-4 h-4 text-ink-muted dark:text-ink-inverse-muted" />
        <code className="text-body-xs font-mono text-ink-secondary dark:text-ink-inverse-secondary">
          {filepath}
        </code>
      </div>

      {/* Diff content */}
      <div className="bg-surface-900 dark:bg-surface-950 font-mono text-body-xs overflow-x-auto">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              line.type === 'add' && 'bg-green-900/30',
              line.type === 'remove' && 'bg-red-900/30'
            )}
          >
            <span className={cn(
              'w-8 flex-shrink-0 text-right pr-2 select-none',
              line.type === 'add' ? 'text-green-500' :
              line.type === 'remove' ? 'text-red-500' :
              'text-surface-500'
            )}>
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            <code className={cn(
              'flex-1 px-2 py-0.5',
              line.type === 'add' ? 'text-green-300' :
              line.type === 'remove' ? 'text-red-300' :
              'text-surface-300'
            )}>
              {line.content}
            </code>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getFileActionConfig(action: FileAction) {
  const configs: Record<FileAction, {
    Icon: React.FC<{ className?: string }>
    label: string
    iconColor: string
    borderColor: string
    bgColor: string
  }> = {
    create: { 
      Icon: FilePlusIcon, 
      label: 'Create File',
      iconColor: 'text-green-500',
      borderColor: 'border-green-200 dark:border-green-800',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    edit: { 
      Icon: FileEditIcon, 
      label: 'Edit File',
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-200 dark:border-blue-800',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    delete: { 
      Icon: FileMinusIcon, 
      label: 'Delete File',
      iconColor: 'text-red-500',
      borderColor: 'border-red-200 dark:border-red-800',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    },
    rename: { 
      Icon: FileRenameIcon, 
      label: 'Rename File',
      iconColor: 'text-amber-500',
      borderColor: 'border-amber-200 dark:border-amber-800',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20'
    },
    move: { 
      Icon: FileMoveIcon, 
      label: 'Move File',
      iconColor: 'text-purple-500',
      borderColor: 'border-purple-200 dark:border-purple-800',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    },
  }
  return configs[action]
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function FilePlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  )
}

function FileEditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M12 18l-4-4 4-4" />
      <path d="M8 14h8" />
    </svg>
  )
}

function FileMinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  )
}

function FileRenameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h2l5-5" />
    </svg>
  )
}

function FileMoveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M12 12l4 4-4 4" />
      <path d="M8 16h8" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function DiffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" />
      <rect x="2" y="6" width="8" height="6" rx="1" />
      <rect x="14" y="12" width="8" height="6" rx="1" />
    </svg>
  )
}


