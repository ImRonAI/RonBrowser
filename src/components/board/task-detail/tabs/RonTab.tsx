/**
 * Ron Tab - Premium AI Chat Interface
 * 
 * Inspired by bolt.new, lovable.dev, and v0.app
 * Sophisticated, minimal, and undeniably beautiful.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { FullTask } from '@/types/task'

// AI SDK v6 - useChat with DefaultChatTransport for UIMessageStream
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport, type TextUIPart } from 'ai'
import { ChainOfThoughtMessage } from '@/components/ai-elements/chain-of-thought-message'

type MessagePart = UIMessage['parts'][number]

// Context Picker
import { ContextPicker, SelectedContexts, type ContextItem } from '@/components/agent-panel/ContextPicker'

// Text Attachment Components
import { TextAttachmentCard } from '@/components/ai-elements/text-attachment-card'
import { fileToDataUrl, makePastedTextFilename } from '@/utils/file-utils'
import type { TextAttachment } from '@/components/ai-elements/types'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

interface RonTabProps {
  task: FullTask
}

// API endpoint for superagent
const SUPERAGENT_API = 'http://localhost:8765/superagent/stream'

// Sleek, minimal suggestions
const SUGGESTIONS = [
  { text: 'Summarize this task', icon: '✦' },
  { text: 'Draft a status update', icon: '✎' },
  { text: 'What are the next steps?', icon: '→' },
  { text: 'Show agent orchestration', icon: '◎' },
]

const LARGE_PASTE_THRESHOLD_CHARS = 2000

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function RonTab({ task }: RonTabProps) {
  // AI SDK v6 useChat with DefaultChatTransport for UIMessageStream
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: SUPERAGENT_API,
    }),
  })

  const [input, setInput] = useState('')
  const [selectedContexts, setSelectedContexts] = useState<ContextItem[]>([])
  const [textAttachments, setTextAttachments] = useState<TextAttachment[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isTyping = status === 'streaming' || status === 'submitted'
  const isEmpty = messages.length === 0

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback((text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || status !== 'ready') return

    setInput('')
    setSelectedContexts([])

    // Include task context in the message
    const contextPrefix = `[Task Context: "${task.title}" - ${task.status}]\n\n`
    sendMessage({ text: contextPrefix + messageText })
  }, [input, status, task, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Handle text attachment operations
  const handleTextAttachmentRemove = (id: string) => {
    setTextAttachments(prev => prev.filter(att => att.id !== id))
  }

  const handleTextAttachmentUpdate = (
    id: string,
    next: Pick<TextAttachment, 'file' | 'dataUrl' | 'preview'>
  ) => {
    setTextAttachments(prev => prev.map(att =>
      att.id === id ? { ...att, ...next } : att
    ))
  }

  // Handle paste events - detect large pastes and convert to attachments
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain')
    if (text && text.length >= LARGE_PASTE_THRESHOLD_CHARS) {
      e.preventDefault()
      const file = new File([text], makePastedTextFilename(), {
        type: 'text/plain',
      })
      const dataUrl = await fileToDataUrl(file)
      const newAttachment: TextAttachment = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        dataUrl,
        preview: dataUrl,
      }
      setTextAttachments(prev => [...prev, newAttachment])
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface-0 dark:bg-surface-900">
      {/* Content - Pure chat with inline orchestration */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-full flex flex-col"
        >
          {isEmpty ? (
            <EmptyState task={task} onSubmit={handleSubmit} />
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
              <div className="max-w-2xl mx-auto space-y-6">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {isTyping && messages[messages.length - 1]?.role === 'user' && (
                  <TypingIndicator />
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-shrink-0 p-4 border-t border-surface-100 dark:border-surface-800"
      >
        <div className="max-w-2xl mx-auto">
          {/* Selected Contexts Display */}
          <SelectedContexts
            contexts={selectedContexts}
            onRemove={(id) => setSelectedContexts(prev => prev.filter(c => c.id !== id))}
            className="mb-3"
          />

          {/* Text Attachments (for pasted content 2000+ chars) */}
          {textAttachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {textAttachments.map(attachment => (
                <TextAttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={handleTextAttachmentRemove}
                  onUpdate={handleTextAttachmentUpdate}
                />
              ))}
            </div>
          )}

          <div className={cn(
            "rounded-2xl transition-all duration-300",
            "bg-surface-50 dark:bg-surface-850",
            "border",
            input 
              ? "border-accent/40 dark:border-accent-light/40 shadow-sm" 
              : "border-surface-200 dark:border-surface-700"
          )}>
            {/* Input Row */}
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Context Picker */}
              <ContextPicker
                selectedContexts={selectedContexts}
                onContextsChange={setSelectedContexts}
              />

              {/* Text Input */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Ask anything..."
                rows={1}
                className={cn(
                  "flex-1 resize-none",
                  "py-1.5",
                  "bg-transparent",
                  "text-body-md text-ink dark:text-ink-inverse",
                  "placeholder:text-ink-muted/60 dark:placeholder:text-ink-inverse-muted/60",
                  "outline-none",
                  "min-h-[32px] max-h-32",
                )}
              />
              
              {/* Send Button */}
              <motion.button
                onClick={() => handleSubmit()}
                disabled={(!input.trim() && textAttachments.length === 0) || isTyping}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex-shrink-0",
                  "w-8 h-8 rounded-lg",
                  "flex items-center justify-center",
                  "transition-all duration-300",
                  (input.trim() || textAttachments.length > 0) && !isTyping
                    ? "bg-ink dark:bg-ink-inverse text-surface-0 dark:text-surface-900"
                    : "bg-surface-200 dark:bg-surface-700 text-ink-muted/50 dark:text-ink-inverse-muted/50"
                )}
              >
                <ArrowUpIcon className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
          
          <p className="text-center text-body-xs text-ink-muted/50 dark:text-ink-inverse-muted/50 mt-2">
            ↵ to send · Task context included
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE - Minimal & Elegant
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ task, onSubmit }: { task: FullTask; onSubmit: (text: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-8">
      {/* Minimal logo mark */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative mb-10"
      >
        <div className="w-16 h-16 rounded-2xl bg-ink dark:bg-ink-inverse flex items-center justify-center">
          <span className="text-2xl font-display font-light text-surface-0 dark:text-surface-900">R</span>
        </div>
        {/* Subtle pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-2xl border border-ink/20 dark:border-ink-inverse/20"
          animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      </motion.div>

      {/* Headline */}
      <motion.h2
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-display-md font-display font-light text-ink dark:text-ink-inverse text-center mb-3"
      >
        How can I help?
      </motion.h2>

      <motion.p
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-body-sm text-ink-muted dark:text-ink-inverse-muted text-center mb-12 max-w-md"
      >
        I have full context of <span className="text-ink dark:text-ink-inverse font-medium">"{task.title}"</span>
      </motion.p>

      {/* Sleek Pill Suggestions */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap justify-center gap-2 max-w-lg"
      >
        {SUGGESTIONS.map((suggestion, i) => (
          <motion.button
            key={suggestion.text}
            onClick={() => onSubmit(suggestion.text)}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25 + i * 0.04 }}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "group relative",
              "inline-flex items-center gap-2",
              "px-4 py-2 rounded-full",
              "bg-surface-50 dark:bg-surface-850",
              "border border-surface-200 dark:border-surface-700",
              "hover:border-surface-300 dark:hover:border-surface-600",
              "hover:bg-surface-100 dark:hover:bg-surface-800",
              "transition-all duration-300 ease-out",
              "cursor-pointer"
            )}
          >
            <span className="text-ink-muted dark:text-ink-inverse-muted text-sm font-light opacity-60 group-hover:opacity-100 transition-opacity">
              {suggestion.icon}
            </span>
            <span className="text-body-sm text-ink-secondary dark:text-ink-inverse-secondary group-hover:text-ink dark:group-hover:text-ink-inverse transition-colors">
              {suggestion.text}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUBBLE - Clean & Modern
// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: { id: string; role: string; parts: MessagePart[] } }) {
  const isUser = message.role === 'user'

  if (isUser) {
    // User messages - extract text parts
    const textParts = message.parts.filter(p => p.type === 'text') as TextUIPart[]
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 rounded-br-md">
          <p className="text-body-sm leading-relaxed whitespace-pre-wrap">
            {textParts.map(p => p.text).join('')}
          </p>
        </div>
      </motion.div>
    )
  }

  // Assistant messages - use ChainOfThoughtMessage
  const isStreaming = message.parts.some(p => (p as { state?: string }).state === 'streaming')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="max-w-[85%]">
        <ChainOfThoughtMessage
          parts={message.parts}
          isStreaming={isStreaming}
          messageId={message.id}
        />
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPING INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-md bg-surface-100 dark:bg-surface-800 w-fit"
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-ink-muted/40 dark:bg-ink-inverse-muted/40"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}
