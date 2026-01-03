/**
 * Chain of Thought - Code Components
 * 
 * Visualize code generation, execution, and terminal output.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtCodeGeneration
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtCodeGenerationProps {
  code: string
  language: string
  filename?: string
  description?: string
  isStreaming?: boolean
  status: 'pending' | 'running' | 'complete' | 'error'
  className?: string
}

export function ChainOfThoughtCodeGeneration({
  code,
  language,
  filename,
  description,
  isStreaming,
  status,
  className
}: ChainOfThoughtCodeGenerationProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn(
      'rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <CodeIcon className="w-4 h-4 text-emerald-500" />
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            {filename || 'Generated Code'}
          </span>
          <span className="text-label px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
            {language}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {status === 'running' && isStreaming && (
            <span className="text-label text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              />
              Generating...
            </span>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          >
            {copied ? (
              <CheckIcon className="w-4 h-4 text-green-500" />
            ) : (
              <CopyIcon className="w-4 h-4 text-ink-muted dark:text-ink-inverse-muted" />
            )}
          </button>
        </div>
      </div>

      {/* Code block */}
      <pre className={cn(
        'p-4 overflow-x-auto',
        'bg-surface-900 dark:bg-surface-950',
        'font-mono text-body-xs text-surface-100'
      )}>
        <code>{code}</code>
        {isStreaming && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="inline-block w-2 h-4 bg-emerald-500 ml-0.5"
          />
        )}
      </pre>

      {/* Description */}
      {description && (
        <div className="px-3 py-2 bg-surface-50 dark:bg-surface-850 border-t border-surface-200 dark:border-surface-700">
          <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary">
            {description}
          </p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtCodeExecution
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtCodeExecutionProps {
  code: string
  language: string
  status: 'pending' | 'running' | 'complete' | 'error'
  output?: string
  error?: string
  executionTime?: number
  memoryUsage?: string
  className?: string
  children?: React.ReactNode
}

export function ChainOfThoughtCodeExecution({
  code,
  language,
  status,
  output,
  error,
  executionTime,
  memoryUsage,
  className,
  children
}: ChainOfThoughtCodeExecutionProps) {
  const [showCode, setShowCode] = useState(true)

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      error 
        ? 'border-red-300 dark:border-red-800' 
        : 'border-surface-200 dark:border-surface-700',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <PlayIcon className="w-4 h-4 text-blue-500" />
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            Code Execution
          </span>
          <span className="text-label px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            {language}
          </span>
          {status === 'running' && <Loader size={14} />}
        </div>

        <div className="flex items-center gap-3">
          {executionTime !== undefined && status === 'complete' && (
            <span className="text-label text-ink-muted">{executionTime}ms</span>
          )}
          {memoryUsage && (
            <span className="text-label text-ink-muted">{memoryUsage}</span>
          )}
          <button 
            onClick={() => setShowCode(!showCode)}
            className="text-label text-ink-muted hover:text-ink dark:hover:text-ink-inverse transition-colors"
          >
            {showCode ? 'Hide' : 'Show'} code
          </button>
        </div>
      </div>

      {/* Code (collapsible) */}
      <AnimatePresence>
        {showCode && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden border-b border-surface-200 dark:border-surface-700"
          >
            <pre className={cn(
              'p-4 overflow-x-auto',
              'bg-surface-900 dark:bg-surface-950',
              'font-mono text-body-xs text-surface-100'
            )}>
              <code>{code}</code>
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Output */}
      {(output || error) && (
        <div className={cn(
          'p-3',
          error ? 'bg-red-50 dark:bg-red-900/10' : 'bg-surface-50 dark:bg-surface-850'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <TerminalIcon className={cn(
              'w-4 h-4',
              error ? 'text-red-500' : 'text-ink-muted dark:text-ink-inverse-muted'
            )} />
            <span className={cn(
              'text-label font-medium',
              error ? 'text-red-600 dark:text-red-400' : 'text-ink-muted dark:text-ink-inverse-muted'
            )}>
              {error ? 'Error' : 'Output'}
            </span>
          </div>
          <pre className={cn(
            'text-body-xs font-mono whitespace-pre-wrap',
            error ? 'text-red-600 dark:text-red-400' : 'text-ink dark:text-ink-inverse'
          )}>
            {error || output}
          </pre>
        </div>
      )}

      {/* Generated charts/images */}
      {children && (
        <div className="p-3 border-t border-surface-200 dark:border-surface-700">
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtTerminalOutput
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtTerminalOutputProps {
  command: string
  output: string
  exitCode?: number
  duration?: number
  cwd?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  className?: string
}

export function ChainOfThoughtTerminalOutput({
  command,
  output,
  exitCode,
  duration,
  cwd,
  status,
  className
}: ChainOfThoughtTerminalOutputProps) {
  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      exitCode !== undefined && exitCode !== 0
        ? 'border-red-300 dark:border-red-800'
        : 'border-surface-200 dark:border-surface-700',
      className
    )}>
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-800 border-b border-surface-700">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-body-xs text-surface-400 ml-2">
            {cwd || 'Terminal'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {status === 'running' && <Loader size={12} />}
          {exitCode !== undefined && (
            <span className={cn(
              'text-label px-1.5 py-0.5 rounded',
              exitCode === 0 
                ? 'bg-green-900/30 text-green-400' 
                : 'bg-red-900/30 text-red-400'
            )}>
              exit {exitCode}
            </span>
          )}
          {duration !== undefined && (
            <span className="text-label text-surface-500">{duration}ms</span>
          )}
        </div>
      </div>

      {/* Terminal content */}
      <div className="p-3 bg-surface-900 font-mono text-body-xs">
        {/* Command */}
        <div className="flex items-center gap-2 text-surface-300 mb-2">
          <span className="text-green-400">$</span>
          <span>{command}</span>
        </div>
        
        {/* Output */}
        <pre className={cn(
          'whitespace-pre-wrap',
          exitCode !== undefined && exitCode !== 0
            ? 'text-red-400'
            : 'text-surface-200'
        )}>
          {output}
        </pre>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

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


