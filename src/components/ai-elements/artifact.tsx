/**
 * Artifact Components
 * 
 * Display AI-generated artifacts like charts, tables, and code.
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// Artifact
// ─────────────────────────────────────────────────────────────────────────────

interface ArtifactProps {
  children: React.ReactNode
  className?: string
}

export function Artifact({ children, className }: ArtifactProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-xl border border-surface-200 dark:border-surface-700',
        'bg-surface-0 dark:bg-surface-800',
        'overflow-hidden',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactHeader
// ─────────────────────────────────────────────────────────────────────────────

interface ArtifactHeaderProps {
  children: React.ReactNode
  className?: string
}

export function ArtifactHeader({ children, className }: ArtifactHeaderProps) {
  return (
    <div className={cn(
      'flex items-center justify-between',
      'px-4 py-3',
      'border-b border-surface-200 dark:border-surface-700',
      className
    )}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactTitle
// ─────────────────────────────────────────────────────────────────────────────

interface ArtifactTitleProps {
  children: React.ReactNode
  className?: string
}

export function ArtifactTitle({ children, className }: ArtifactTitleProps) {
  return (
    <h4 className={cn(
      'text-body-sm font-semibold text-ink dark:text-ink-inverse',
      className
    )}>
      {children}
    </h4>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactDescription
// ─────────────────────────────────────────────────────────────────────────────

interface ArtifactDescriptionProps {
  children: React.ReactNode
  className?: string
}

export function ArtifactDescription({ children, className }: ArtifactDescriptionProps) {
  return (
    <p className={cn(
      'text-body-xs text-ink-secondary dark:text-ink-inverse-secondary',
      className
    )}>
      {children}
    </p>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactActions
// ─────────────────────────────────────────────────────────────────────────────

interface ArtifactActionsProps {
  children: React.ReactNode
  className?: string
}

export function ArtifactActions({ children, className }: ArtifactActionsProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactAction
// ─────────────────────────────────────────────────────────────────────────────

interface ArtifactActionProps {
  tooltip: string
  icon: React.ReactNode
  onClick?: () => void
  className?: string
}

export function ArtifactAction({ tooltip, icon, onClick, className }: ArtifactActionProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      title={tooltip}
      className={cn(
        'w-7 h-7 rounded-lg',
        'flex items-center justify-center',
        'text-ink-muted dark:text-ink-inverse-muted',
        'hover:bg-surface-100 dark:hover:bg-surface-700',
        'hover:text-ink dark:hover:text-ink-inverse',
        'transition-colors duration-200',
        className
      )}
    >
      {icon}
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactClose
// ─────────────────────────────────────────────────────────────────────────────

interface ArtifactCloseProps {
  onClick?: () => void
  className?: string
}

export function ArtifactClose({ onClick, className }: ArtifactCloseProps) {
  return (
    <ArtifactAction
      tooltip="Close"
      icon={<XIcon className="w-4 h-4" />}
      onClick={onClick}
      className={className}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactContent
// ─────────────────────────────────────────────────────────────────────────────

interface ArtifactContentProps {
  children: React.ReactNode
  className?: string
}

export function ArtifactContent({ children, className }: ArtifactContentProps) {
  return (
    <div className={cn('p-4', className)}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactCode
// ─────────────────────────────────────────────────────────────────────────────

interface ArtifactCodeProps {
  code: string
  language?: string
  showLineNumbers?: boolean
  className?: string
}

export function ArtifactCode({ code, language, showLineNumbers = true, className }: ArtifactCodeProps) {
  const [copied, setCopied] = useState(false)
  const lines = code.split('\n')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('relative', className)}>
      {/* Language badge and copy button */}
      <div className="absolute top-2 right-2 flex items-center gap-2">
        {language && (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase text-ink-muted dark:text-ink-inverse-muted bg-surface-200 dark:bg-surface-700">
            {language}
          </span>
        )}
        <motion.button
          onClick={handleCopy}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'p-1.5 rounded-md',
            'text-ink-muted dark:text-ink-inverse-muted',
            'hover:bg-surface-200 dark:hover:bg-surface-600',
            'transition-colors duration-200'
          )}
        >
          {copied ? (
            <CheckIcon className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <CopyIcon className="w-3.5 h-3.5" />
          )}
        </motion.button>
      </div>

      {/* Code content */}
      <pre className={cn(
        'p-4 rounded-lg overflow-x-auto',
        'bg-surface-900 dark:bg-surface-950',
        'font-mono text-body-xs text-surface-100'
      )}>
        {lines.map((line, i) => (
          <div key={i} className="flex">
            {showLineNumbers && (
              <span className="w-8 flex-shrink-0 text-right pr-4 text-surface-500 select-none">
                {i + 1}
              </span>
            )}
            <code>{line}</code>
          </div>
        ))}
      </pre>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GeneratedImage
// ─────────────────────────────────────────────────────────────────────────────

interface GeneratedImageProps {
  base64?: string
  src?: string
  mediaType?: string
  alt: string
  className?: string
}

export function GeneratedImage({ base64, src, mediaType, alt, className }: GeneratedImageProps) {
  const imageSrc = base64 ? `data:${mediaType || 'image/png'};base64,${base64}` : src

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn('rounded-xl overflow-hidden', className)}
    >
      <img 
        src={imageSrc} 
        alt={alt}
        className="w-full h-auto"
      />
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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
