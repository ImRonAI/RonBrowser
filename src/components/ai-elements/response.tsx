/**
 * Response Components
 *
 * Renders AI response content with streaming support and markdown formatting.
 * Uses Streamdown from vercel/ai-elements pattern.
 */

import { memo, type ComponentProps } from 'react'
import { Streamdown } from 'streamdown'
import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// MessageResponse - Following vercel/ai-elements pattern
// ─────────────────────────────────────────────────────────────────────────────

export type MessageResponseProps = ComponentProps<typeof Streamdown>

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

MessageResponse.displayName = "MessageResponse"

// ─────────────────────────────────────────────────────────────────────────────
// ResponseMarkdown - Wrapper for backward compatibility
// ─────────────────────────────────────────────────────────────────────────────

interface ResponseMarkdownProps {
  content: string
  isStreaming?: boolean
  className?: string
}

export function ResponseMarkdown({ content, isStreaming, className }: ResponseMarkdownProps) {
  return (
    <MessageResponse
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        className
      )}
      mode={isStreaming ? 'streaming' : 'static'}
      isAnimating={isStreaming}
      parseIncompleteMarkdown={true}
    >
      {content}
    </MessageResponse>
  )
}
