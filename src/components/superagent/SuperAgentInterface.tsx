/**
 * SuperAgent Interface
 * 
 * A refined, premium AI agent interface with:
 * - Elegant centered input that drops on first message
 * - "The Collaborative Agent Browser OS..." tagline in Raleway light
 * - Subtle dark purple glow aesthetic
 * - Deep Research toggle
 * - ContextPicker for tab/context selection
 * - 2000+ char paste-to-attachment feature
 * - Auto-opening preview panel for code/documents
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { ContextPicker, type ContextItem } from '@/components/agent-panel/ContextPicker'
import { TextAttachmentCard } from '@/components/ai-elements/text-attachment-card'
import { ChainOfThoughtMessage } from '@/components/ai-elements/chain-of-thought-message'
import { fileToDataUrl, makePastedTextFilename } from '@/utils/file-utils'
import type { TextAttachment } from '@/components/ai-elements/types'

// AI SDK v6
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport, type TextUIPart } from 'ai'

type MessagePart = UIMessage['parts'][number]

const EASE = [0.16, 1, 0.3, 1] as const
const LARGE_PASTE_THRESHOLD_CHARS = 2000
const SUPERAGENT_API = 'http://localhost:8765/superagent/stream'

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function SuperAgentInterface() {
  const sessionIdRef = useRef<string>(
    `superagent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: SUPERAGENT_API,
      body: () => ({
        session_id: sessionIdRef.current,
      }),
    }),
  })

  const [input, setInput] = useState('')
  const [selectedContexts, setSelectedContexts] = useState<ContextItem[]>([])
  const [textAttachments, setTextAttachments] = useState<TextAttachment[]>([])
  const [isDeepResearch, setIsDeepResearch] = useState(false)
  const [previewContent, setPreviewContent] = useState<{
    type: 'code' | 'document' | 'browser'
    content: string
    title?: string
  } | null>(null)

  const isTyping = status === 'streaming' || status === 'submitted'
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isEmpty = messages.length === 0

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [])

  const handleSubmit = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || status !== 'ready') return

    setInput('')

    let finalMessage = messageText
    if (selectedContexts.length > 0) {
      const contextString = selectedContexts.map(c => {
        if (c.type === 'tab') return `[Context: Tab] ${c.title || c.name} (${c.url || c.description})`
        return `[Context: ${c.type}] ${c.name} - ${c.description || ''}`
      }).join('\n')
      finalMessage = `Context:\n${contextString}\n\n${messageText}`
    }

    if (isDeepResearch) {
      finalMessage = `[Deep Research Mode]\n${finalMessage}`
    }

    sendMessage({ text: finalMessage })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleNewChat = () => {
    const newSessionId = `superagent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    sessionIdRef.current = newSessionId
    setMessages([])
    setInput('')
    setSelectedContexts([])
    setTextAttachments([])
    setPreviewContent(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

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

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain')
    if (text && text.length >= LARGE_PASTE_THRESHOLD_CHARS) {
      e.preventDefault()
      const file = new File([text], makePastedTextFilename(), { type: 'text/plain' })
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
    <div className="h-full flex flex-col relative overflow-hidden bg-surface-0 dark:bg-surface-900">
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.06) 0%, transparent 60%)',
            filter: 'blur(100px)',
          }}
        />
      </div>

      {/* Header - Minimal */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="relative z-10 flex-shrink-0 px-6 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
            style={{ boxShadow: '0 0 24px rgba(139, 92, 246, 0.35)' }}
          >
            <LayersIcon className="w-4 h-4 text-white" />
          </div>
          <span className="text-body-md font-medium text-ink dark:text-ink-inverse">
            SuperAgent
          </span>
        </div>

        <div className="flex items-center gap-3">
          <DeepResearchToggle enabled={isDeepResearch} onChange={setIsDeepResearch} />
          
          <button
            onClick={handleNewChat}
            className="p-2 rounded-lg text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            title="New conversation"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 min-h-0 flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            {isEmpty ? (
              <EmptyState key="empty" onSuggestionClick={handleSubmit} />
            ) : (
              <motion.div
                key="messages"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-6 py-4 space-y-4"
              >
                {messages.map((message) => (
                  <MessageBubble 
                    key={message.id} 
                    message={message}
                  />
                ))}
                
                {isTyping && messages[messages.length - 1]?.role === 'user' && (
                  <TypingIndicator />
                )}
                
                <div ref={messagesEndRef} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className={cn(
            "flex-shrink-0 px-6 pb-6 pt-2",
            isEmpty && "flex-1 flex flex-col items-center justify-center"
          )}>
            <div className={cn("w-full", isEmpty ? "max-w-2xl" : "max-w-4xl mx-auto")}>
              {/* Attachments */}
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

              {/* Context chips */}
              {selectedContexts.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedContexts.map(context => (
                    <ContextChip
                      key={context.id}
                      context={context}
                      onRemove={() => setSelectedContexts(prev => prev.filter(c => c.id !== context.id))}
                    />
                  ))}
                </div>
              )}

              {/* Input */}
              <div 
                className={cn(
                  "relative rounded-2xl transition-all duration-300",
                  "bg-surface-50/80 dark:bg-surface-800/80 backdrop-blur-sm",
                  "border",
                  input 
                    ? "border-violet-300/60 dark:border-violet-500/40" 
                    : "border-surface-200 dark:border-surface-700",
                )}
                style={{
                  boxShadow: input 
                    ? '0 0 40px rgba(139, 92, 246, 0.12)' 
                    : '0 2px 12px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div className="flex items-center gap-2 px-4 py-3">
                  <ContextPicker
                    selectedContexts={selectedContexts}
                    onContextsChange={setSelectedContexts}
                  />

                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="What would you like to accomplish?"
                    rows={1}
                    className={cn(
                      "flex-1 resize-none py-1",
                      "bg-transparent",
                      "text-body-md text-ink dark:text-ink-inverse",
                      "placeholder:text-ink-muted/50 dark:placeholder:text-ink-inverse-muted/50",
                      "outline-none",
                      "min-h-[28px] max-h-32",
                    )}
                  />
                  
                  <motion.button
                    onClick={() => handleSubmit()}
                    disabled={(!input.trim() && textAttachments.length === 0) || status !== 'ready'}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-xl",
                      "flex items-center justify-center",
                      "transition-all duration-300",
                      (input.trim() || textAttachments.length > 0) && status === 'ready'
                        ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white"
                        : "bg-surface-200 dark:bg-surface-700 text-ink-muted/40"
                    )}
                    style={{
                      boxShadow: (input.trim() || textAttachments.length > 0) && status === 'ready'
                        ? '0 0 16px rgba(139, 92, 246, 0.4)'
                        : 'none',
                    }}
                  >
                    <ArrowUpIcon className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              <p className="text-center text-[11px] text-ink-muted/40 dark:text-ink-inverse-muted/40 mt-3 tracking-wide">
                ↵ to send{isDeepResearch && ' · Deep Research enabled'}
              </p>
            </div>
          </div>
        </div>

        {/* Preview Panel - Auto opens for code/documents */}
        <AnimatePresence>
          {previewContent && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 420, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex-shrink-0 border-l border-surface-200/80 dark:border-surface-700/80 bg-surface-50/95 dark:bg-surface-850/95 backdrop-blur-sm overflow-hidden"
            >
              <div className="w-[420px] h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700">
                  <div className="flex items-center gap-2">
                    {previewContent.type === 'code' && <CodeIcon className="w-4 h-4 text-violet-500" />}
                    {previewContent.type === 'document' && <DocumentIcon className="w-4 h-4 text-violet-500" />}
                    {previewContent.type === 'browser' && <BrowserIcon className="w-4 h-4 text-violet-500" />}
                    <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
                      {previewContent.title || 'Preview'}
                    </span>
                  </div>
                  <button
                    onClick={() => setPreviewContent(null)}
                    className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    aria-label="Close preview"
                  >
                    <XIcon className="w-3.5 h-3.5 text-ink-muted" />
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-auto">
                  <pre className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary font-mono whitespace-pre-wrap">
                    {previewContent.content}
                  </pre>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State - Clean & Elegant
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  const suggestions = [
    'Research a topic in depth',
    'Analyze and summarize documents',
    'Build a workflow automation',
    'Help me code something',
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center px-6 pb-32"
    >
      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-12"
        style={{
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 300,
          fontSize: '1.25rem',
          letterSpacing: '0.15em',
          color: 'rgba(139, 92, 246, 0.55)',
        }}
      >
        The Collaborative Agent Browser OS...
      </motion.p>

      {/* Suggestions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex flex-wrap justify-center gap-2 max-w-xl"
      >
        {suggestions.map((text, i) => (
          <motion.button
            key={i}
            onClick={() => onSuggestionClick(text)}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.05 }}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "px-4 py-2 rounded-full",
              "text-body-sm text-ink-muted dark:text-ink-inverse-muted",
              "bg-surface-100/80 dark:bg-surface-800/80",
              "border border-surface-200/60 dark:border-surface-700/60",
              "hover:text-ink dark:hover:text-ink-inverse",
              "hover:border-violet-300/50 dark:hover:border-violet-500/30",
              "hover:bg-violet-50/50 dark:hover:bg-violet-900/20",
              "transition-all duration-200",
            )}
          >
            {text}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep Research Toggle
// ─────────────────────────────────────────────────────────────────────────────

function DeepResearchToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200",
        "text-[11px] font-medium tracking-wide",
        enabled
          ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
          : "text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse"
      )}
    >
      <div className={cn(
        "w-2 h-2 rounded-full transition-colors",
        enabled ? "bg-violet-500" : "bg-ink-muted/30 dark:bg-ink-inverse-muted/30"
      )} />
      Deep Research
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Bubble
// ─────────────────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: { id: string; role: string; parts: MessagePart[] }
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    const textParts = message.parts.filter(p => p.type === 'text') as TextUIPart[]
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white">
          <p className="text-body-sm leading-relaxed whitespace-pre-wrap">
            {textParts.map(p => p.text).join('')}
          </p>
        </div>
      </motion.div>
    )
  }

  const isStreaming = message.parts.some(p => (p as { state?: string }).state === 'streaming')

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
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
// Context Chip
// ─────────────────────────────────────────────────────────────────────────────

function ContextChip({ context, onRemove }: { context: ContextItem; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 border border-violet-200/60 dark:border-violet-500/30">
      {context.favicon ? (
        <img src={context.favicon} alt="" className="w-3.5 h-3.5 rounded" />
      ) : (
        <GlobeIcon className="w-3.5 h-3.5 text-violet-500" />
      )}
      <span className="text-[11px] text-ink dark:text-ink-inverse max-w-[140px] truncate">
        {context.name}
      </span>
      <button onClick={onRemove} className="p-0.5 rounded-full hover:bg-violet-100 dark:hover:bg-violet-800/40" aria-label="Remove context">
        <XIcon className="w-2.5 h-2.5 text-violet-400" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Typing Indicator
// ─────────────────────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-violet-400"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function BrowserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <circle cx="7" cy="6" r="1" fill="currentColor" />
      <circle cx="10" cy="6" r="1" fill="currentColor" />
    </svg>
  )
}

export default SuperAgentInterface
