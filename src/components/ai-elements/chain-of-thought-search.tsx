/**
 * Chain of Thought - Search Components
 *
 * Rich visualization for web search results within Chain of Thought.
 * Supports multiple search providers and tool patterns.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'
import { InlineCitation } from './sources'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SearchProvider =
  | 'perplexity'
  | 'brave'
  | 'pubmed'
  | 'openfda'
  | 'datacommons'
  | 'pophive'
  | 'cms'
  | 'apify'
  | 'google-flights'
  | 'airbnb'
  | 'arxiv'
  | 'program-integrity'

export interface SearchResult {
  id: string
  title: string
  url: string
  snippet?: string
  favicon?: string
  thumbnail?: string
  date?: string
  author?: string
  source?: string
  relevanceScore?: number
  metadata?: Record<string, any>
}

export interface SearchToolCall {
  tool: string
  query: string
  filters?: Record<string, any>
  timestamp: number
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtSearch
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtSearchProps {
  provider: SearchProvider
  query: string
  results: SearchResult[]
  isSearching?: boolean
  duration?: number
  error?: string
  className?: string
  onResultClick?: (result: SearchResult) => void
  onExpandPreview?: (result: SearchResult) => void
}

export function ChainOfThoughtSearch({
  provider,
  query,
  results,
  isSearching = false,
  duration,
  error,
  className,
  onResultClick,
  onExpandPreview
}: ChainOfThoughtSearchProps) {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  const config = getProviderConfig(provider)

  const toggleExpanded = (resultId: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev)
      if (next.has(resultId)) {
        next.delete(resultId)
      } else {
        next.add(resultId)
      }
      return next
    })
  }

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      config.borderColor,
      className
    )}>
      {/* Search Header */}
      <div className={cn(
        'px-4 py-3',
        config.bgColor
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <config.Icon className={cn('w-4 h-4', config.iconColor)} />
            <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
              Searching {config.label}
            </span>
            <span className={cn(
              'text-label px-1.5 py-0.5 rounded',
              config.badgeBg,
              config.badgeText
            )}>
              {provider}
            </span>
          </div>

          {isSearching && (
            <div className="flex items-center gap-2">
              <Loader size={12} />
              <span className="text-body-xs text-ink-muted dark:text-ink-inverse-muted">
                Searching...
              </span>
            </div>
          )}

          {!isSearching && duration && (
            <span className="text-body-xs text-ink-muted dark:text-ink-inverse-muted">
              {duration}ms
            </span>
          )}
        </div>

        {/* Query Display */}
        <div className="mt-2 p-2 rounded-lg bg-surface-0/50 dark:bg-surface-900/50">
          <code className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary font-mono">
            "{query}"
          </code>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <p className="text-body-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        </div>
      )}

      {/* Results */}
      {!error && results.length > 0 && (
        <div className="border-t border-surface-200 dark:border-surface-700">
          <div className="divide-y divide-surface-200 dark:divide-surface-700">
            {results.map((result, index) => (
              <SearchResultCard
                key={result.id}
                result={result}
                index={index + 1}
                isExpanded={expandedResults.has(result.id)}
                onToggleExpand={() => toggleExpanded(result.id)}
                onClick={() => onResultClick?.(result)}
                onExpandPreview={() => onExpandPreview?.(result)}
              />
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!error && !isSearching && results.length === 0 && (
        <div className="px-4 py-8 text-center border-t border-surface-200 dark:border-surface-700">
          <p className="text-body-sm text-ink-muted dark:text-ink-inverse-muted">
            No results found for this search.
          </p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchResultCard
// ─────────────────────────────────────────────────────────────────────────────

interface SearchResultCardProps {
  result: SearchResult
  index: number
  isExpanded: boolean
  onToggleExpand: () => void
  onClick?: () => void
  onExpandPreview?: () => void
}

function SearchResultCard({
  result,
  index,
  isExpanded,
  onToggleExpand,
  onClick,
  onExpandPreview
}: SearchResultCardProps) {
  const domain = getDomainFromUrl(result.url)

  return (
    <div className="group">
      {/* Main Result */}
      <div
        className="px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          {/* Citation Number */}
          <div className="flex-shrink-0 mt-0.5">
            <InlineCitation
              index={index}
              href={result.url}
              title={result.title}
            />
          </div>

          {/* Favicon/Thumbnail */}
          <div className="flex-shrink-0">
            {result.thumbnail ? (
              <img
                src={result.thumbnail}
                alt=""
                className="w-16 h-12 rounded object-cover"
              />
            ) : result.favicon ? (
              <img
                src={result.favicon}
                alt=""
                className="w-5 h-5 rounded"
              />
            ) : (
              <LinkIcon className="w-5 h-5 text-ink-muted dark:text-ink-inverse-muted" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-body-sm font-medium text-ink dark:text-ink-inverse line-clamp-2 group-hover:text-accent dark:group-hover:text-accent-light">
              {result.title}
            </h4>

            {result.snippet && (
              <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary mt-1 line-clamp-2">
                {result.snippet}
              </p>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-label text-ink-muted dark:text-ink-inverse-muted">
                {domain}
              </span>

              {result.date && (
                <span className="text-label text-ink-muted dark:text-ink-inverse-muted">
                  {formatDate(result.date)}
                </span>
              )}

              {result.author && (
                <span className="text-label text-ink-muted dark:text-ink-inverse-muted">
                  {result.author}
                </span>
              )}

              {result.relevanceScore !== undefined && (
                <div className={cn(
                  'px-1.5 py-0.5 rounded text-label font-medium',
                  result.relevanceScore >= 0.8
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : result.relevanceScore >= 0.5
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                )}>
                  {Math.round(result.relevanceScore * 100)}%
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand()
              }}
              className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700"
              title="Toggle details"
            >
              <ChevronIcon
                className={cn(
                  'w-3.5 h-3.5 text-ink-muted dark:text-ink-inverse-muted transition-transform',
                  isExpanded && 'rotate-180'
                )}
              />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onExpandPreview?.()
              }}
              className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700"
              title="Preview"
            >
              <ExpandIcon className="w-3.5 h-3.5 text-ink-muted dark:text-ink-inverse-muted" />
            </button>

            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700"
              title="Open in new tab"
            >
              <ExternalLinkIcon className="w-3.5 h-3.5 text-ink-muted dark:text-ink-inverse-muted" />
            </a>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && result.metadata && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 bg-surface-50 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700">
              <div className="space-y-2">
                {Object.entries(result.metadata).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-2">
                    <span className="text-label text-ink-muted dark:text-ink-inverse-muted capitalize">
                      {key.replace(/_/g, ' ')}:
                    </span>
                    <span className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtSearchImages
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtSearchImagesProps {
  images: Array<{
    id: string
    url: string
    thumbnail?: string
    title?: string
    source?: string
    width?: number
    height?: number
  }>
  className?: string
  onImageClick?: (image: any) => void
}

export function ChainOfThoughtSearchImages({
  images,
  className,
  onImageClick
}: ChainOfThoughtSearchImagesProps) {
  return (
    <div className={cn(
      'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2',
      className
    )}>
      {images.map((image) => (
        <motion.div
          key={image.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative group cursor-pointer rounded-lg overflow-hidden bg-surface-100 dark:bg-surface-800"
          onClick={() => onImageClick?.(image)}
        >
          <img
            src={image.thumbnail || image.url}
            alt={image.title || ''}
            className="w-full h-24 object-cover"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-2">
              {image.title && (
                <p className="text-label text-white line-clamp-1">
                  {image.title}
                </p>
              )}
              {image.source && (
                <p className="text-[10px] text-white/80">
                  {image.source}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function getProviderConfig(provider: SearchProvider) {
  const configs: Record<SearchProvider, {
    Icon: React.FC<{ className?: string }>
    label: string
    iconColor: string
    bgColor: string
    borderColor: string
    badgeBg: string
    badgeText: string
  }> = {
    perplexity: {
      Icon: SearchIcon,
      label: 'Perplexity',
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
      badgeBg: 'bg-purple-100 dark:bg-purple-900/30',
      badgeText: 'text-purple-600 dark:text-purple-400',
    },
    brave: {
      Icon: SearchIcon,
      label: 'Brave Search',
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
      badgeBg: 'bg-orange-100 dark:bg-orange-900/30',
      badgeText: 'text-orange-600 dark:text-orange-400',
    },
    pubmed: {
      Icon: MedicalIcon,
      label: 'PubMed',
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
      badgeText: 'text-blue-600 dark:text-blue-400',
    },
    openfda: {
      Icon: MedicalIcon,
      label: 'OpenFDA',
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      badgeBg: 'bg-red-100 dark:bg-red-900/30',
      badgeText: 'text-red-600 dark:text-red-400',
    },
    datacommons: {
      Icon: DatabaseIcon,
      label: 'Data Commons',
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      badgeBg: 'bg-green-100 dark:bg-green-900/30',
      badgeText: 'text-green-600 dark:text-green-400',
    },
    pophive: {
      Icon: ChartIcon,
      label: 'popHIVE',
      iconColor: 'text-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      borderColor: 'border-indigo-200 dark:border-indigo-800',
      badgeBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      badgeText: 'text-indigo-600 dark:text-indigo-400',
    },
    cms: {
      Icon: DocumentIcon,
      label: 'CMS',
      iconColor: 'text-cyan-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      borderColor: 'border-cyan-200 dark:border-cyan-800',
      badgeBg: 'bg-cyan-100 dark:bg-cyan-900/30',
      badgeText: 'text-cyan-600 dark:text-cyan-400',
    },
    apify: {
      Icon: BotIcon,
      label: 'Apify',
      iconColor: 'text-lime-500',
      bgColor: 'bg-lime-50 dark:bg-lime-900/20',
      borderColor: 'border-lime-200 dark:border-lime-800',
      badgeBg: 'bg-lime-100 dark:bg-lime-900/30',
      badgeText: 'text-lime-600 dark:text-lime-400',
    },
    'google-flights': {
      Icon: PlaneIcon,
      label: 'Google Flights',
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
      badgeText: 'text-blue-600 dark:text-blue-400',
    },
    airbnb: {
      Icon: HomeIcon,
      label: 'Airbnb',
      iconColor: 'text-rose-500',
      bgColor: 'bg-rose-50 dark:bg-rose-900/20',
      borderColor: 'border-rose-200 dark:border-rose-800',
      badgeBg: 'bg-rose-100 dark:bg-rose-900/30',
      badgeText: 'text-rose-600 dark:text-rose-400',
    },
    arxiv: {
      Icon: AcademicIcon,
      label: 'arXiv',
      iconColor: 'text-gray-500',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      borderColor: 'border-gray-200 dark:border-gray-800',
      badgeBg: 'bg-gray-100 dark:bg-gray-900/30',
      badgeText: 'text-gray-600 dark:text-gray-400',
    },
    'program-integrity': {
      Icon: ShieldIcon,
      label: 'Program Integrity Alliance',
      iconColor: 'text-teal-500',
      bgColor: 'bg-teal-50 dark:bg-teal-900/20',
      borderColor: 'border-teal-200 dark:border-teal-800',
      badgeBg: 'bg-teal-100 dark:bg-teal-900/30',
      badgeText: 'text-teal-600 dark:text-teal-400',
    },
  }
  return configs[provider]
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return date.toLocaleDateString()
  } catch {
    return dateStr
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Detection
// ─────────────────────────────────────────────────────────────────────────────

export function detectSearchProvider(toolName: string): SearchProvider | null {
  const mappings: Record<string, SearchProvider> = {
    'brave_web_search': 'brave',
    'mcp__brave__brave_web_search': 'brave',
    'mcp__brave__brave_local_search': 'brave',
    'mcp__brave__brave_news_search': 'brave',
    'mcp__brave__brave_image_search': 'brave',
    'mcp__brave__brave_video_search': 'brave',
    'perplexity_search': 'perplexity',
    'pubmed_search': 'pubmed',
    'openfda_search': 'openfda',
    'datacommons_search': 'datacommons',
    'pophive_search': 'pophive',
    'cms_search': 'cms',
    'apify_search': 'apify',
    'google_flights_search': 'google-flights',
    'airbnb_search': 'airbnb',
    'arxiv_search': 'arxiv',
    'program_integrity_search': 'program-integrity',
  }

  const normalized = toolName.toLowerCase()
  for (const [pattern, provider] of Object.entries(mappings)) {
    if (normalized.includes(pattern)) {
      return provider
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
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

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function MedicalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v6M15 2v6M9 18v6M15 18v6M3 9h6M3 15h6M15 9h6M15 15h6M9 9h6v6H9z" />
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

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
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

function BotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  )
}

function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1V17l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  )
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function AcademicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}