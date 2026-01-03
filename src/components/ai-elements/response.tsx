/**
 * Response Component
 * 
 * Renders AI response content with streaming support and markdown formatting.
 */

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

interface ResponseProps {
  children: React.ReactNode
  isStreaming?: boolean
  className?: string
}

export function Response({ children, isStreaming, className }: ResponseProps) {
  return (
    <div 
      className={cn(
        'text-body-md whitespace-pre-wrap break-words',
        'prose prose-sm dark:prose-invert',
        'prose-p:my-2 prose-p:leading-relaxed',
        'prose-headings:font-semibold prose-headings:text-ink dark:prose-headings:text-ink-inverse',
        'prose-ul:my-2 prose-ol:my-2',
        'prose-li:my-0.5',
        'prose-code:text-accent dark:prose-code:text-accent-light',
        'prose-code:bg-surface-100 dark:prose-code:bg-surface-800',
        'prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
        'prose-pre:bg-surface-900 dark:prose-pre:bg-surface-950',
        'prose-pre:rounded-xl prose-pre:p-4',
        'max-w-none',
        className
      )}
    >
      {children}
      {isStreaming && (
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="inline-block w-1.5 h-5 ml-0.5 bg-current rounded-sm"
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ResponseMarkdown
// ─────────────────────────────────────────────────────────────────────────────

interface ResponseMarkdownProps {
  content: string
  isStreaming?: boolean
  className?: string
}

export function ResponseMarkdown({ content, isStreaming, className }: ResponseMarkdownProps) {
  // Basic markdown parsing (can be enhanced with a proper markdown library)
  const formattedContent = formatMarkdown(content)
  
  return (
    <Response isStreaming={isStreaming} className={className}>
      <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
    </Response>
  )
}

// Simple markdown formatter
function formatMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Lists
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br>')
}

