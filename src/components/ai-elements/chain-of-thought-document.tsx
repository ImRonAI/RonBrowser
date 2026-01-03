/**
 * Chain of Thought - Document Components
 * 
 * Visualize document creation, editing, and preview (Zoom Workspace, Google Docs, etc.)
 */

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentAction = 'create' | 'edit' | 'share' | 'export'
export type DocumentType = 'doc' | 'sheet' | 'slide' | 'pdf' | 'note'

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtDocument
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtDocumentProps {
  action: DocumentAction
  documentType: DocumentType
  title: string
  status: 'pending' | 'running' | 'complete' | 'error'
  lastModified?: Date
  collaborators?: string[]
  className?: string
  children?: React.ReactNode
}

export function ChainOfThoughtDocument({
  action,
  documentType,
  title,
  status,
  lastModified,
  collaborators,
  className,
  children
}: ChainOfThoughtDocumentProps) {
  const docConfig = getDocTypeConfig(documentType)
  const actionConfig = getDocActionConfig(action)

  return (
    <div className={cn(
      'rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          {status === 'running' ? (
            <Loader size={16} />
          ) : (
            <docConfig.Icon className={cn('w-4 h-4', docConfig.color)} />
          )}
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            {actionConfig.label}
          </span>
          <span className={cn(
            'text-label px-1.5 py-0.5 rounded uppercase',
            docConfig.badgeBg, docConfig.badgeText
          )}>
            {documentType}
          </span>
        </div>
      </div>

      {/* Document info */}
      <div className="p-3 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-lg flex items-center justify-center',
            docConfig.bgColor
          )}>
            <docConfig.Icon className={cn('w-6 h-6', docConfig.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-medium text-ink dark:text-ink-inverse truncate">
              {title}
            </p>
            {lastModified && (
              <p className="text-body-xs text-ink-muted dark:text-ink-inverse-muted">
                Modified {lastModified.toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {collaborators && collaborators.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-label text-ink-muted dark:text-ink-inverse-muted">Shared with:</span>
            <div className="flex -space-x-2">
              {collaborators.slice(0, 3).map((c, i) => (
                <div 
                  key={i}
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-white dark:border-surface-800 flex items-center justify-center"
                  title={c}
                >
                  <span className="text-[10px] text-white font-medium">{c.charAt(0).toUpperCase()}</span>
                </div>
              ))}
              {collaborators.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-surface-200 dark:bg-surface-700 border-2 border-white dark:border-surface-800 flex items-center justify-center">
                  <span className="text-[10px] text-ink-muted dark:text-ink-inverse-muted">+{collaborators.length - 3}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Document preview/content */}
      {children && (
        <div className="p-3">
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtDocumentPreview
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtDocumentPreviewProps {
  documentType: DocumentType
  content: string
  isStreaming?: boolean
  className?: string
}

export function ChainOfThoughtDocumentPreview({
  documentType,
  content,
  isStreaming,
  className
}: ChainOfThoughtDocumentPreviewProps) {
  return (
    <div className={cn(
      'rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden',
      className
    )}>
      {/* Document chrome */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-50 dark:bg-surface-850 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <span className="text-label text-ink-muted dark:text-ink-inverse-muted ml-2">
          {documentType === 'doc' ? 'Document' : 
           documentType === 'sheet' ? 'Spreadsheet' :
           documentType === 'slide' ? 'Presentation' :
           documentType === 'pdf' ? 'PDF' : 'Note'}
        </span>
      </div>

      {/* Content area - styled like a document */}
      <div className="p-6 bg-white dark:bg-surface-900 min-h-[200px]">
        {documentType === 'doc' || documentType === 'note' ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-ink dark:text-ink-inverse">
              {content}
              {isStreaming && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block w-2 h-4 bg-accent ml-0.5"
                />
              )}
            </p>
          </div>
        ) : documentType === 'sheet' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-body-xs">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="px-2 py-1 text-left font-medium text-ink-muted dark:text-ink-inverse-muted w-10"></th>
                  <th className="px-2 py-1 text-left font-medium text-ink-muted dark:text-ink-inverse-muted">A</th>
                  <th className="px-2 py-1 text-left font-medium text-ink-muted dark:text-ink-inverse-muted">B</th>
                  <th className="px-2 py-1 text-left font-medium text-ink-muted dark:text-ink-inverse-muted">C</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map(row => (
                  <tr key={row} className="border-b border-surface-200 dark:border-surface-700">
                    <td className="px-2 py-1 text-ink-muted dark:text-ink-inverse-muted">{row}</td>
                    <td className="px-2 py-1 text-ink dark:text-ink-inverse">Data</td>
                    <td className="px-2 py-1 text-ink dark:text-ink-inverse">Data</td>
                    <td className="px-2 py-1 text-ink dark:text-ink-inverse">Data</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : documentType === 'slide' ? (
          <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <p className="text-white text-display-sm font-medium">Slide Preview</p>
          </div>
        ) : (
          <p className="text-ink dark:text-ink-inverse whitespace-pre-wrap">{content}</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDocTypeConfig(type: DocumentType) {
  const configs: Record<DocumentType, {
    Icon: React.FC<{ className?: string }>
    color: string
    bgColor: string
    badgeBg: string
    badgeText: string
  }> = {
    doc: {
      Icon: DocIcon,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
      badgeText: 'text-blue-700 dark:text-blue-300',
    },
    sheet: {
      Icon: SheetIcon,
      color: 'text-green-500',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      badgeBg: 'bg-green-100 dark:bg-green-900/30',
      badgeText: 'text-green-700 dark:text-green-300',
    },
    slide: {
      Icon: SlideIcon,
      color: 'text-amber-500',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
      badgeText: 'text-amber-700 dark:text-amber-300',
    },
    pdf: {
      Icon: PdfIcon,
      color: 'text-red-500',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      badgeBg: 'bg-red-100 dark:bg-red-900/30',
      badgeText: 'text-red-700 dark:text-red-300',
    },
    note: {
      Icon: NoteIcon,
      color: 'text-purple-500',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      badgeBg: 'bg-purple-100 dark:bg-purple-900/30',
      badgeText: 'text-purple-700 dark:text-purple-300',
    },
  }
  return configs[type]
}

function getDocActionConfig(action: DocumentAction) {
  const configs: Record<DocumentAction, { label: string }> = {
    create: { label: 'Create Document' },
    edit: { label: 'Edit Document' },
    share: { label: 'Share Document' },
    export: { label: 'Export Document' },
  }
  return configs[action]
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function SheetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}

function SlideIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  )
}

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h.01" />
      <path d="M11 13h5" />
      <path d="M8 17h.01" />
      <path d="M11 17h5" />
    </svg>
  )
}


