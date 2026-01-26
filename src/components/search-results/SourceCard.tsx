/**
 * SourceCard
 * 
 * Compact citation card with favicon, domain, title, snippet, and citation badge.
 * Features hover actions: Visit Site, Send to Ron, Send to Coding, Attach to Task, Start Task.
 */

import { useState } from 'react'
import { 
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftRightIcon,
  CodeBracketIcon,
  PaperClipIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface SourceData {
  id: string
  url: string
  title: string
  snippet: string
  domain: string
  type: 'web' | 'academic' | 'video' | 'social' | 'code'
  favicon?: string
}

interface SourceCardProps {
  source: SourceData
  citationNumber?: number
  selected?: boolean
  onSelectionChange?: (selected: boolean) => void
  onVisitSite?: () => void
  onSendToRon?: () => void
  onSendToCoding?: () => void
  onAttachToTask?: () => void
  onStartTask?: () => void
  onPreview?: () => void
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get favicon URL
// ─────────────────────────────────────────────────────────────────────────────
function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get type icon color
// ─────────────────────────────────────────────────────────────────────────────
function getTypeAccent(type: SourceData['type']): string {
  switch (type) {
    case 'academic':
      return 'text-amber-400'
    case 'video':
      return 'text-red-400'
    case 'code':
      return 'text-green-400'
    case 'social':
      return 'text-blue-400'
    default:
      return 'text-slate-400'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function SourceCard({
  source,
  citationNumber,
  selected = false,
  onSelectionChange,
  onVisitSite,
  onSendToRon,
  onSendToCoding,
  onAttachToTask,
  onStartTask,
  onPreview,
  className = '',
}: SourceCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [faviconError, setFaviconError] = useState(false)

  const handleClick = () => {
    if (onPreview) {
      onPreview()
    } else if (onVisitSite) {
      onVisitSite()
    } else {
      window.open(source.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      className={`
        group relative w-full
        rounded-xl overflow-hidden
        border border-surface-200 dark:border-surface-700
        bg-surface-0 dark:bg-surface-800
        transition-all duration-300 ease-out
        hover:shadow-md hover:border-surface-300 dark:hover:border-surface-600
        cursor-pointer
        ${className}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Ambient Highlight Overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-surface-100/60 via-transparent to-surface-200/40 dark:from-surface-700/30 dark:to-surface-800/20 pointer-events-none" />

      {/* Checkbox for Let's Chat context selection - Top Right */}
      {onSelectionChange && (
        <div className="absolute top-2 right-2 z-20">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation()
              onSelectionChange(e.target.checked)
            }}
            onClick={(e) => e.stopPropagation()}
            className="
              w-5 h-5 rounded
              border-2 border-white/30
              bg-white/10 backdrop-blur-md
              checked:bg-gradient-to-br checked:from-purple-500 checked:to-purple-700
              checked:border-purple-400
              transition-all duration-200
              cursor-pointer
              hover:border-white/50
              focus:outline-none focus:ring-2 focus:ring-purple-500/50
            "
            title="Select for Let's Chat context"
          />
        </div>
      )}

      {/* Citation badge */}
      {citationNumber !== undefined && (
        <div
          className="
            absolute top-2 left-2 z-10
            w-5 h-5 flex items-center justify-center
            bg-gradient-to-br from-purple-500 to-purple-700
            text-white text-[10px] font-bold
            rounded-full shadow-md
            border border-purple-400/50
          "
        >
          {citationNumber}
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 p-3">
        {/* Header: favicon + domain */}
        <div className="flex items-center gap-2 mb-2">
          {/* Favicon */}
          <div className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 dark:bg-surface-700 overflow-hidden">
            {!faviconError ? (
              <img 
                src={source.favicon || getFaviconUrl(source.domain)}
                alt=""
                className="w-4 h-4 object-contain"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <div className={`text-xs font-bold ${getTypeAccent(source.type)}`}>
                {source.domain.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Domain + type indicator */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className={`text-xs font-medium truncate ${getTypeAccent(source.type)}`}>
              {source.domain}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-ink-muted dark:text-ink-inverse-muted">
              {source.type}
            </span>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-ink dark:text-ink-inverse line-clamp-2 mb-1 leading-tight">
          {source.title}
        </h4>

        {/* Snippet */}
        <p className="text-xs text-ink-secondary dark:text-ink-inverse-secondary line-clamp-2 leading-relaxed">
          {source.snippet}
        </p>
      </div>

      {/* Hover actions */}
      <div
        className={`
          absolute inset-0 z-20 flex items-center justify-center gap-1.5
          bg-surface-0/95 dark:bg-surface-800/95
          transition-opacity duration-200
          ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      >
        {/* Visit Site */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            window.open(source.url, '_blank', 'noopener,noreferrer')
          }}
          className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
          title="Visit Site"
        >
          <ArrowTopRightOnSquareIcon className="w-4 h-4 text-ink dark:text-ink-inverse" />
        </button>

        {/* Send to Ron */}
        {onSendToRon && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSendToRon()
            }}
            className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-teal-500/20 transition-colors"
            title="Send to Ron"
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4 text-teal-400" />
          </button>
        )}

        {/* Send to Coding */}
        {onSendToCoding && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSendToCoding()
            }}
            className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-blue-500/20 transition-colors"
            title="Send to Coding Agent"
          >
            <CodeBracketIcon className="w-4 h-4 text-blue-400" />
          </button>
        )}

        {/* Attach to Task */}
        {onAttachToTask && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAttachToTask()
            }}
            className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-amber-500/20 transition-colors"
            title="Attach to Task"
          >
            <PaperClipIcon className="w-4 h-4 text-amber-400" />
          </button>
        )}

        {/* Start Task */}
        {onStartTask && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStartTask()
            }}
            className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-purple-500/20 transition-colors"
            title="Start Task"
          >
            <PlayIcon className="w-4 h-4 text-purple-400" />
          </button>
        )}
      </div>
    </div>
  )
}

export default SourceCard
