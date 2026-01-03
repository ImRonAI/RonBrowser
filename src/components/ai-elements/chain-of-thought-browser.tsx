/**
 * Chain of Thought - Browser Automation Components
 * 
 * Visualize browser actions like navigation, clicking, typing.
 */

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BrowserActionType = 
  | 'navigate'
  | 'click'
  | 'type'
  | 'scroll'
  | 'extract'
  | 'screenshot'
  | 'wait'
  | 'hover'
  | 'select'

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtBrowserPreview
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtBrowserPreviewProps {
  url: string
  screenshot?: string
  title?: string
  isLive?: boolean
  height?: number
  highlightSelector?: string
  className?: string
  children?: React.ReactNode
}

export function ChainOfThoughtBrowserPreview({
  url,
  screenshot,
  title,
  isLive = false,
  height = 200,
  highlightSelector,
  className,
  children
}: ChainOfThoughtBrowserPreviewProps) {
  return (
    <div className={cn(
      'rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden',
      className
    )}>
      {/* Mini browser chrome */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        
        {/* URL bar */}
        <div className="flex-1 flex items-center gap-2 px-2 py-1 rounded bg-surface-0 dark:bg-surface-900 text-body-xs">
          <LockIcon className="w-3 h-3 text-green-500" />
          <span className="text-ink-secondary dark:text-ink-inverse-secondary truncate">
            {url}
          </span>
        </div>
      </div>
      
      {/* Content area */}
      <div className="relative" style={{ height }}>
        {isLive ? (
          <iframe
            src={url}
            className="w-full h-full"
            sandbox="allow-scripts allow-same-origin"
            title={title || 'Browser preview'}
          />
        ) : screenshot ? (
          <img 
            src={screenshot} 
            alt={title || 'Page screenshot'}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-50 dark:bg-surface-850">
            <span className="text-body-sm text-ink-muted dark:text-ink-inverse-muted">
              No preview available
            </span>
          </div>
        )}
        
        {/* Highlight overlay for selector */}
        {highlightSelector && (
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute bg-cyan-500/20 border-2 border-cyan-500 rounded"
              style={{
                top: '30%',
                left: '20%',
                width: '60%',
                height: '20%',
              }}
            >
              <span className="absolute -top-6 left-0 text-label bg-cyan-500 text-white px-1.5 py-0.5 rounded">
                {highlightSelector}
              </span>
            </motion.div>
          </div>
        )}
      </div>

      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtBrowserAction
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtBrowserActionProps {
  action: BrowserActionType
  target?: string
  value?: string
  duration?: number
  status: 'pending' | 'running' | 'complete' | 'error'
  className?: string
}

export function ChainOfThoughtBrowserAction({
  action,
  target,
  value,
  duration,
  status,
  className
}: ChainOfThoughtBrowserActionProps) {
  const config = getBrowserActionConfig(action)

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg',
      'bg-cyan-50 dark:bg-cyan-900/20',
      'border border-cyan-200 dark:border-cyan-800',
      className
    )}>
      {/* Action icon */}
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center',
        'bg-cyan-100 dark:bg-cyan-900/40'
      )}>
        {status === 'running' ? (
          <Loader size={16} />
        ) : (
          <config.Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
        )}
      </div>
      
      {/* Action details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            {config.label}
          </span>
          <span className="text-label px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
            browser
          </span>
        </div>
        
        {target && (
          <code className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary font-mono mt-0.5 block truncate">
            {target}
          </code>
        )}
        
        {value && (
          <p className="text-body-xs text-ink-muted dark:text-ink-inverse-muted mt-0.5">
            Value: "{value}"
          </p>
        )}
      </div>
      
      {/* Duration */}
      {duration !== undefined && status === 'complete' && (
        <span className="text-label text-ink-muted dark:text-ink-inverse-muted">
          {duration}ms
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtBrowserSequence
// ─────────────────────────────────────────────────────────────────────────────

interface BrowserSequenceStep {
  id: string
  action: BrowserActionType
  target?: string
  value?: string
  screenshot?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  duration?: number
}

interface ChainOfThoughtBrowserSequenceProps {
  steps: BrowserSequenceStep[]
  showScreenshots?: boolean
  className?: string
}

export function ChainOfThoughtBrowserSequence({
  steps,
  showScreenshots = false,
  className
}: ChainOfThoughtBrowserSequenceProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex gap-3">
          {/* Step number */}
          <div className="flex flex-col items-center">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-label font-medium',
              step.status === 'complete' 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : step.status === 'running'
                  ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                  : step.status === 'error'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-surface-200 text-ink-muted dark:bg-surface-700 dark:text-ink-inverse-muted'
            )}>
              {step.status === 'complete' ? '✓' : step.status === 'error' ? '✕' : index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className="w-px flex-1 bg-surface-200 dark:bg-surface-700 my-1" />
            )}
          </div>
          
          {/* Action content */}
          <div className="flex-1 pb-3">
            <ChainOfThoughtBrowserAction
              action={step.action}
              target={step.target}
              value={step.value}
              status={step.status}
              duration={step.duration}
            />
            
            {showScreenshots && step.screenshot && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2"
              >
                <ChainOfThoughtBrowserPreview
                  url={step.target || ''}
                  screenshot={step.screenshot}
                  height={150}
                />
              </motion.div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getBrowserActionConfig(action: BrowserActionType) {
  const configs: Record<BrowserActionType, { Icon: React.FC<{ className?: string }>; label: string }> = {
    navigate: { Icon: GlobeIcon, label: 'Navigate' },
    click: { Icon: CursorClickIcon, label: 'Click' },
    type: { Icon: KeyboardIcon, label: 'Type' },
    scroll: { Icon: ScrollIcon, label: 'Scroll' },
    extract: { Icon: ExtractIcon, label: 'Extract' },
    screenshot: { Icon: CameraIcon, label: 'Screenshot' },
    wait: { Icon: ClockIcon, label: 'Wait' },
    hover: { Icon: CursorIcon, label: 'Hover' },
    select: { Icon: ListIcon, label: 'Select' },
  }
  return configs[action]
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function CursorClickIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9l5 12 1.774-5.226L21 14 9 9z" />
      <path d="M16.071 16.071l4.243 4.243" />
    </svg>
  )
}

function CursorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4l7.07 17 2.51-7.39L21 11.07 4 4z"/>
    </svg>
  )
}

function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
    </svg>
  )
}

function ScrollIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M5 10l7-7 7 7M5 14l7 7 7-7" />
    </svg>
  )
}

function ExtractIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}


