/**
 * Ron Tab - Premium AI Chat Interface
 * 
 * Inspired by bolt.new, lovable.dev, and v0.app
 * Sophisticated, minimal, and undeniably beautiful.
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { FullTask, TaskConversation } from '@/pages/types/task'
import { useTaskStore } from '@/stores/taskStore'

// AI SDK v6 - useChat with DefaultChatTransport for UIMessageStream
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport, type TextUIPart } from 'ai'
import { ChainOfThoughtMessage } from '@/components/ai-elements/chain-of-thought-message'
import { useOrchestrationStore } from '@/stores/orchestrationStore'
import { handleOrchestrationDataPart } from '@/utils/orchestration-stream'
import {
  Plus as PlusIcon,
  History as HistoryIcon,
  ChevronDown as ChevronDownIcon,
  ArrowUp as ArrowUpIcon
} from 'lucide-react'

// Context Picker
import { ContextPicker, SelectedContexts, type ContextItem } from '@/components/agent-panel/ContextPicker'

// Text Attachment Components
import { TextAttachmentCard } from '@/components/ai-elements/text-attachment-card'
import { fileToDataUrl, makePastedTextFilename } from '@/utils/file-utils'
import type { TextAttachment } from '@/components/ai-elements/types'

// Preview Panel
import { PreviewPanel } from '@/components/ai-elements/preview-panel'
import { usePreviewStore } from '@/stores/previewStore'

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

type MessagePart = UIMessage['parts'][number]

const LARGE_PASTE_THRESHOLD_CHARS = 2000

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function RonTab({ task }: RonTabProps) {
  // Store Access
  const updateTask = useTaskStore(state => state.updateTask)
  
  // State for conversation management
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  // 1. INITIALIZATION ONLY
  // Load latest conversation on mount. 
  // IMPORTANT: We do NOT put this in a useEffect dependant on 'task', 
  // or we risk loops if we update the task.
  useEffect(() => {
    if (activeConversationId) return 

    if (task.conversations && task.conversations.length > 0) {
      // Sort by lastActiveAt desc
      const sorted = [...task.conversations].sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      setActiveConversationId(sorted[0].id)
    } else {
      // Start new if none
      const newId = `conv-${Date.now()}`
      setActiveConversationId(newId)
    }
  }, []) // Empty dependency array = absolute safety from render loops.


  // 2. CHAT HOOK - AI SDK v6 compatible
  const [input, setInput] = useState('')
  
  const { messages, setMessages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: SUPERAGENT_API,
      body: () => ({
        session_id: activeConversationId
          ? `task-${task.id}-${activeConversationId}`
          : `task-${task.id}-new`,
      }),
    }),
    id: activeConversationId || 'new',
    // 3. SAFE PERSISTENCE
    // We only save to the store when the AI generation FINISHES.
    // This happens once per turn, preventing any rapid render cycles.
    onData: (dataPart) => {
      handleOrchestrationDataPart(dataPart as { type: string; data?: any })
    },
    onFinish: () => {
      if (!activeConversationId) return
      
      const fullHistory = messages || []
      const existingConvs = task.conversations || []
      const currentConv = existingConvs.find(c => c.id === activeConversationId)
      
      const newConv: TaskConversation = {
        id: activeConversationId,
        taskId: task.id,
        createdAt: currentConv?.createdAt || Date.now(),
        lastActiveAt: Date.now(),
        messageCount: fullHistory.length,
        messages: fullHistory as any
      }
      
      const others = existingConvs.filter(c => c.id !== activeConversationId)
      
      // Update global store
      updateTask(task.id, { conversations: [newConv, ...others] })
    }
  })

  // 4. LOAD MESSAGES ON SWITCH
  // When the USER explicitly switches chats (updates activeConversationId), we load the messages.
  useEffect(() => {
    if (!activeConversationId) return
    
    // We strictly look for the conversation in the props
    const conv = task.conversations?.find(c => c.id === activeConversationId)
    if (conv) {
       setMessages(conv.messages as any)
    } else {
       setMessages([])
    }
  }, [activeConversationId]) // Only runs when ID changes, not when messages/task change.


  // 5. AUTO SCROLL
  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])


  // 6. EVENT HANDLERS
  const handleCreateNewChat = () => {
    const newId = `conv-${Date.now()}`
    setActiveConversationId(newId)
    setMessages([])
    setIsHistoryOpen(false)
    useOrchestrationStore.getState().reset()
  }

  const handleSwitchChat = (convId: string) => {
    const conv = task.conversations?.find(c => c.id === convId)
    if (conv) {
      setActiveConversationId(convId)
      setMessages(conv.messages as any)
    }
    setIsHistoryOpen(false)
    useOrchestrationStore.getState().reset()
  }
  
  // Custom submit to handle context injection
  const handleCustomSubmit = (text?: string) => {
    const messageText = text || input
    if (!messageText.trim() && textAttachments.length === 0) return

    // Ensure we have an active ID
    if (!activeConversationId) {
        setActiveConversationId(`conv-${Date.now()}`)
    }

    // Include task context in the message via system instruction prefix if needed
    // or just rely on the backend provided tools. 
    // Here we append context for clarity.
    const contextPrefix = `[System] Task Context: ID="${task.id}" Title="${task.title}" Status="${task.status}"\n\n`
    
    // AI SDK v6: Convert attachments to FileUIPart format for sendMessage
    // FileUIPart = { type: 'file', mediaType: string, filename?: string, url: string (data URL) }
    let files: { type: 'file'; mediaType: string; filename: string; url: string }[] | undefined
    
    if (textAttachments.length > 0) {
      files = textAttachments.map((item) => ({
        type: 'file' as const,
        mediaType: item.file.type || 'text/plain',
        filename: item.file.name,
        url: item.dataUrl,  // Already a data URL from handlePaste
      }))
    }
    
    // Using sendMessage with files array in AI SDK v6 format
    sendMessage({ 
      text: contextPrefix + (messageText || 'Sent with attachments'),
      files,
    } as any)
    
    // Reset local state
    if (!text) setInput('')
    setSelectedContexts([])
    setTextAttachments([])
  }


  // 7. INPUT STATE (Attachments/Context)
  const [selectedContexts, setSelectedContexts] = useState<ContextItem[]>([])
  const [textAttachments, setTextAttachments] = useState<TextAttachment[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  const isTyping = status === 'streaming' || status === 'submitted'
  const isEmpty = messages.length === 0

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCustomSubmit()
    }
  }


  // Preview panel state
  const isPreviewOpen = usePreviewStore(state => state.isOpen)

  return (
    <div className="h-full flex flex-col bg-surface-0 dark:bg-surface-900 relative">
      {/* Header Toolbar */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between z-20 bg-surface-0/80 dark:bg-surface-900/80 backdrop-blur-md">
        <div className="relative">
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-sm font-medium text-ink dark:text-ink-inverse transition-colors"
            aria-label="History"
          >
            <HistoryIcon size={14} className="text-ink-muted" />
            <span className="truncate max-w-[150px]">
              {(messages[0]?.parts?.find((p: any) => p.type === 'text') as any)?.text?.slice(0, 20) + '...' || 'New Chat'}
            </span>
            <ChevronDownIcon size={14} className={cn("text-ink-muted transition-transform", isHistoryOpen && "rotate-180")} />
          </button>

          {/* History Dropdown */}
          <AnimatePresence>
            {isHistoryOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-0 mt-2 w-64 p-2 rounded-xl glass-card border border-surface-200 dark:border-surface-700 shadow-xl"
              >
                <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-surface-100/50 dark:border-surface-700/50">
                   <span className="text-[10px] font-bold uppercase text-ink-muted">Recent Chats</span>
                   <button 
                     onClick={handleCreateNewChat} 
                     className="p-1 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-md"
                     aria-label="New Chat"
                   >
                     <PlusIcon size={14} />
                   </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {task.conversations?.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSwitchChat(c.id)}
                      className={cn(
                        "w-full text-left px-2 py-2 rounded-lg text-xs truncate transition-colors",
                        activeConversationId === c.id 
                          ? "bg-accent/10 text-accent font-medium" 
                          : "hover:bg-surface-100 dark:hover:bg-surface-800 text-ink-muted"
                      )}
                    >
                      {c.messages[0]?.content || 'Empty Chat'}
                      <div className="text-[9px] opacity-60 mt-0.5">
                        {new Date(c.lastActiveAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                  {(!task.conversations || task.conversations.length === 0) && (
                    <div className="text-center py-4 text-xs text-ink-muted">No history</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button 
          onClick={handleCreateNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-xs font-medium transition-colors"
        >
          <PlusIcon size={14} />
          <span>New Chat</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-full flex flex-col"
        >
          {isEmpty ? (
            <EmptyState task={task} onSubmit={handleCustomSubmit} />
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6" id="messages-container">
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
          {/* Contexts & Attachments */}
          <SelectedContexts
            contexts={selectedContexts}
            onRemove={(id) => setSelectedContexts(prev => prev.filter(c => c.id !== id))}
            className="mb-3"
          />
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
              <motion.button
                onClick={() => handleCustomSubmit()}
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

      {/* Sliding Preview Panel - positioned absolutely on the right */}
      <AnimatePresence>
        {isPreviewOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute right-0 top-0 bottom-0 z-30"
          >
            <PreviewPanel variant="sliding" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ task, onSubmit }: { task: FullTask; onSubmit: (text: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative mb-10"
      >
        <div className="w-16 h-16 rounded-2xl bg-ink dark:bg-ink-inverse flex items-center justify-center">
          <span className="text-2xl font-display font-light text-surface-0 dark:text-surface-900">R</span>
        </div>
        <motion.div
          className="absolute inset-0 rounded-2xl border border-ink/20 dark:border-ink-inverse/20"
          animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      </motion.div>

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
// MESSAGE BUBBLE
// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: { id: string; role: string; parts: MessagePart[] } }) {
  const isUser = message.role === 'user'

  if (isUser) {
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
