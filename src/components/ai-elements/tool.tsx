/**
 * Tool Components
 * 
 * Display tool execution details with collapsible input/output.
 * 
 * Implementation follows official Vercel AI Elements pattern:
 * - Memoized components to prevent unnecessary re-renders
 * - React Context for state sharing (no cloneElement)
 * - Controlled/uncontrolled via open/defaultOpen/onOpenChange
 */

'use client'

import React, { useState, useCallback, createContext, useContext, memo, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { cn } from '@/utils/cn'
import { Loader } from './loader'
import type { ToolState } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface ToolContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  isStreaming?: boolean
  duration?: number
}

const ToolContext = createContext<ToolContextValue>({
  isOpen: false,
  setIsOpen: () => {},
  isStreaming: false,
  duration: undefined,
})

export const useTool = () => useContext(ToolContext)

// ─────────────────────────────────────────────────────────────────────────────
// Tool Name Mapping
// ─────────────────────────────────────────────────────────────────────────────

function getToolDisplayName(toolName: string): string {
  const name = toolName.toLowerCase()

  // Code Execution Tools
  if (name.includes('code') || name.includes('execute')) return 'Code Execution'
  if (name.includes('python')) return 'Python Execution'
  if (name.includes('javascript')) return 'JavaScript Execution'

  // Browser/Computer Tools
  if (name.includes('browser')) return 'Browser Tool'
  if (name.includes('computer')) return 'Computer Control'
  if (name.includes('screenshot')) return 'Screenshot'
  if (name.includes('scrape')) return 'Web Scrape'
  if (name.includes('navigate')) return 'Navigate'
  if (name.includes('click')) return 'Click'
  if (name.includes('type')) return 'Type'

  // File Operations
  if (name.includes('write')) return 'File Write'
  if (name.includes('read')) return 'File Read'
  if (name.includes('edit')) return 'File Edit'
  if (name.includes('bash') || name.includes('shell')) return 'Terminal'

  // Search Tools
  if (name.includes('search')) return 'Search'
  if (name.includes('perplexity')) return 'Perplexity'

  // AI/Agent Tools
  if (name.includes('agent')) return 'Agent'
  if (name.includes('task')) return 'Task'

  // MCP Server Tools
  if (name.includes('mcp__')) {
    const parts = name.split('__')
    if (parts.length >= 2) {
      return parts[1].split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    }
  }

  // Default: Title Case
  return toolName
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool (Root) - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ToolProps {
  children: React.ReactNode
  /** Controlled open state */
  open?: boolean
  /** Uncontrolled default open state */
  defaultOpen?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  /** Whether the tool is currently streaming */
  isStreaming?: boolean
  /** Duration of the tool execution in seconds */
  duration?: number
  className?: string
}

export const Tool = memo(function Tool({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  isStreaming = false,
  duration: durationProp,
  className
}: ToolProps) {
  // Use Radix's useControllableState for open state
  const [isOpen, setIsOpen] = useControllableState({
    prop: controlledOpen,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  })

  // Use Radix's useControllableState for duration
  const [duration, setDuration] = useControllableState({
    prop: durationProp,
    defaultProp: undefined,
  })

  // Track auto-close state and start time
  const [hasAutoClosed, setHasAutoClosed] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)

  const AUTO_CLOSE_DELAY = 1000
  const MS_IN_S = 1000

  // Track duration when streaming starts and ends
  useEffect(() => {
    if (isStreaming) {
      if (startTime === null) {
        setStartTime(Date.now())
      }
      if (!isOpen) {
        setIsOpen(true)  // Auto-open when streaming starts
      }
      setHasAutoClosed(false)
    } else if (startTime !== null) {
      // Streaming ended, calculate duration
      setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S))
      setStartTime(null)
    }
  }, [isStreaming, startTime, setDuration, isOpen, setIsOpen])

  // Auto-close when streaming ends (only if defaultOpen is true)
  useEffect(() => {
    if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
      const timer = setTimeout(() => {
        setIsOpen(false)
        setHasAutoClosed(true)
      }, AUTO_CLOSE_DELAY)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed])

  const contextValue = useMemo(() => ({
    isOpen,
    setIsOpen,
    isStreaming,
    duration,
  }), [isOpen, setIsOpen, isStreaming, duration])

  return (
    <ToolContext.Provider value={contextValue}>
      <div className={cn(
        'rounded-xl border border-surface-200/60 dark:border-surface-700/60',
        'overflow-hidden',
        'bg-gradient-to-br from-surface-0/80 to-surface-50/60',
        'dark:from-surface-900/80 dark:to-surface-850/60',
        'shadow-sm',
        className
      )}>
        {children}
      </div>
    </ToolContext.Provider>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ToolHeader - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ToolHeaderProps {
  title: string
  type?: string
  state: ToolState
  className?: string
}

export const ToolHeader = memo(function ToolHeader({ 
  title, 
  type, 
  state, 
  className 
}: ToolHeaderProps) {
  const { isOpen, setIsOpen, duration, isStreaming } = useTool()
  const displayName = getToolDisplayName(title)

  const handleClick = useCallback(() => {
    setIsOpen(!isOpen)
  }, [isOpen, setIsOpen])

  const statusLabel =
    state === 'running'
      ? 'Running'
      : state === 'success'
        ? 'Completed'
        : state === 'error'
          ? 'Error'
          : 'Pending'
  const durationLabel = duration ? `${duration}s` : null

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-3 p-3',
        'bg-surface-50/60 dark:bg-surface-800/60',
        'hover:bg-surface-100/80 dark:hover:bg-surface-700/80',
        'transition-colors duration-200',
        'text-left',
        className
      )}
    >
      <ToolStateIndicator state={state} />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse truncate">
            {displayName}
          </span>
          {type && (
            <span className="text-label text-ink-muted dark:text-ink-inverse-muted px-1.5 py-0.5 bg-surface-200 dark:bg-surface-700 rounded flex-shrink-0">
              {type}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-ink-muted dark:text-ink-inverse-muted">
        <span className={cn(
          'uppercase tracking-wide',
          state === 'error' && 'text-red-500',
          state === 'success' && 'text-emerald-500',
          (state === 'running' || isStreaming) && 'text-blue-500'
        )}>
          {statusLabel}
        </span>
        {durationLabel && (state === 'success' || state === 'error') && (
          <span>{durationLabel}</span>
        )}
      </div>
      
      <ChevronIcon 
        className={cn(
          'w-4 h-4 text-ink-muted dark:text-ink-inverse-muted flex-shrink-0',
          'transition-transform duration-200',
          isOpen && 'rotate-180'
        )} 
      />
    </button>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ToolStateIndicator - Memoized
// ─────────────────────────────────────────────────────────────────────────────

const ToolStateIndicator = memo(function ToolStateIndicator({ state }: { state: ToolState }) {
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
    <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', config.bg)}>
      {state === 'running' ? (
        <Loader size={14} />
      ) : IconComponent ? (
        <IconComponent className={cn('w-3.5 h-3.5', config.color)} />
      ) : null}
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ToolContent - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ToolContentProps {
  children: React.ReactNode
  className?: string
}

export const ToolContent = memo(function ToolContent({ children, className }: ToolContentProps) {
  const { isOpen } = useTool()

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ 
            height: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 0.15 }
          }}
          className={cn('overflow-hidden', className)}
        >
          <div className="p-3 pt-0 space-y-3">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ToolInput - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ToolInputProps {
  input: Record<string, unknown> | string
  isStreaming?: boolean
  className?: string
}

export const ToolInput = memo(function ToolInput({ input, isStreaming, className }: ToolInputProps) {
  const displayValue = useMemo(() => {
    if (typeof input === 'string') return input
    try {
      return JSON.stringify(input, null, 2)
    } catch {
      return String(input)
    }
  }, [input])

  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-label text-ink-muted dark:text-ink-inverse-muted font-medium uppercase tracking-wide">
        Input
      </label>
      <div className="relative">
        <pre className={cn(
          'p-3 rounded-lg',
          'bg-surface-100/60 dark:bg-surface-900/60',
          'border border-surface-200/50 dark:border-surface-700/50',
          'text-body-xs text-ink dark:text-ink-inverse font-mono',
          'overflow-x-auto max-h-48 scrollbar-thin'
        )}>
          {displayValue}
        </pre>
        {isStreaming && (
          <div className="absolute top-2 right-2">
            <Loader size={12} />
          </div>
        )}
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ToolOutput - Memoized
// ─────────────────────────────────────────────────────────────────────────────

interface ToolOutputProps {
  output?: string | unknown
  errorText?: string
  className?: string
}

// Check if output contains image content block
function extractImageFromOutput(output: unknown): { base64: string; format: string } | null {
  if (!output) return null
  
  // Handle array of content blocks (Bedrock/Strands format)
  if (Array.isArray(output)) {
    for (const block of output) {
      if (block?.image?.source?.bytes) {
        return { base64: block.image.source.bytes, format: block.image.format || 'png' }
      }
    }
  }
  
  // Handle single content block
  if (typeof output === 'object' && output !== null) {
    const obj = output as Record<string, any>
    if (obj.image?.source?.bytes) {
      return { base64: obj.image.source.bytes, format: obj.image.format || 'png' }
    }
  }
  
  return null
}

export const ToolOutput = memo(function ToolOutput({ output, errorText, className }: ToolOutputProps) {
  const hasError = !!errorText
  
  // Check for image content
  const imageData = extractImageFromOutput(output)
  
  if (imageData) {
    const src = `data:image/${imageData.format};base64,${imageData.base64}`
    return (
      <div className={cn('space-y-1.5', className)}>
        <label className="text-label font-medium text-ink-muted dark:text-ink-inverse-muted uppercase tracking-wide">
          Screenshot
        </label>
        <div className="rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800">
          <img 
            src={src} 
            alt="Screenshot" 
            className="max-w-full h-auto"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    )
  }

  // Text output  
  const displayValue = errorText || (typeof output === 'string' ? output : JSON.stringify(output, null, 2))

  if (!displayValue) return null

  return (
    <div className={cn('space-y-1.5', className)}>
      <label className={cn(
        'text-label font-medium uppercase tracking-wide',
        hasError ? 'text-red-500' : 'text-ink-muted dark:text-ink-inverse-muted'
      )}>
        {hasError ? 'Error' : 'Output'}
      </label>
      <pre className={cn(
        'p-3 rounded-lg text-body-xs font-mono overflow-x-auto max-h-64 scrollbar-thin',
        hasError 
          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800' 
          : 'bg-surface-100/60 dark:bg-surface-900/60 border border-surface-200/50 dark:border-surface-700/50 text-ink dark:text-ink-inverse'
      )}>
        {displayValue}
      </pre>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper function to map AI SDK tool states
// ─────────────────────────────────────────────────────────────────────────────

export function mapToolPartState(state: string): ToolState {
  switch (state) {
    case 'input-streaming':
      return 'running'  // Changed from 'pending' to show active state
    case 'input-available':
      return 'running'  // Changed from 'input-available' to show active state
    case 'output-available':
      return 'success'
    case 'output-error':
      return 'error'
    default:
      return 'pending'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons - Memoized
// ─────────────────────────────────────────────────────────────────────────────

const ClockIcon = memo(function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
})

const CheckIcon = memo(function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
})

const XIcon = memo(function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
})

const PlayIcon = memo(function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
})

const ChevronIcon = memo(function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
})
