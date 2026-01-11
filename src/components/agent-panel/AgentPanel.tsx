import { useState, useRef, useEffect, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Transition } from '@headlessui/react'
import { XMarkIcon, PlusIcon, ClockIcon } from '@heroicons/react/24/outline'
import { useAgentStore } from '@/stores/agentStore'
import { cn } from '@/utils/cn'
import { ContextPicker, type ContextItem } from './ContextPicker'
import { AskRonOptions } from '@/components/ai-elements/ask-ron-options'
import { TextAttachmentCard } from '@/components/ai-elements/text-attachment-card'
import { fileToDataUrl, makePastedTextFilename } from '@/utils/file-utils'
import type { TextAttachment } from '@/components/ai-elements/types'

// AI SDK v6 - useChat with DefaultChatTransport for UIMessageStream
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport, type TextUIPart } from 'ai'
import { ChainOfThoughtMessage } from '@/components/ai-elements/chain-of-thought-message'

type MessagePart = UIMessage['parts'][number]

const EASE = [0.16, 1, 0.3, 1] as const
const LARGE_PASTE_THRESHOLD_CHARS = 2000

// Sleek pill suggestions - minimal & elegant
const SUGGESTIONS = [
  { icon: '◎', text: 'Navigate this page' },
  { icon: '✦', text: 'Search the web' },
  { icon: '∑', text: 'Summarize content' },
  { icon: '?', text: 'What can you do?' },
]

// API endpoint for superagent
const SUPERAGENT_API = 'http://localhost:8765/superagent/stream'

export function AgentPanel() {
  const {
    isPanelOpen,
    closePanel,
    interactionMode,
    setInteractionMode,
    isViewingScreen,
    screenshotData,
    askRonStep,
    askRonSelectedText,
    askRonSourceUrl,
    askRonOptions,
    askRonThinkingText,
    setAskRonStep,
    selectAskRonOption,
    closeAskRon
  } = useAgentStore()

  // Session management
  const {
    sessionsList,
    isLoadingSessions,
    fetchSessions,
    startNewChat,
    loadSession,
  } = useAgentStore()

  const [showHistory, setShowHistory] = useState(false)

  // Fetch sessions when panel opens
  useEffect(() => {
    if (isPanelOpen) {
      fetchSessions()
    }
  }, [isPanelOpen, fetchSessions])

  // Use useRef to hold the session ID for stable reference in body callback
  const sessionIdRef = useRef<string>(
    useAgentStore.getState().currentSessionId || `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  )

  // AI SDK v6 useChat with DefaultChatTransport for UIMessageStream
  // body option adds session_id to every request per AI SDK docs
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: SUPERAGENT_API,
      body: () => {
        console.log('[AgentPanel] Sending request with session_id:', sessionIdRef.current)
        return {
          session_id: sessionIdRef.current,
        }
      },
    }),
  })

  const [input, setInput] = useState('')
  const [selectedContexts, setSelectedContexts] = useState<ContextItem[]>([])
  const [textAttachments, setTextAttachments] = useState<TextAttachment[]>([])

  const isTyping = status === 'streaming' || status === 'submitted'
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isPanelOpen && interactionMode === 'text') {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isPanelOpen, interactionMode])

  const handleSubmit = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || status !== 'ready') return

    setInput('')
    setSelectedContexts([])

    // Serialize context if present
    let finalMessage = messageText
    if (selectedContexts.length > 0) {
      const contextString = selectedContexts.map(c => {
        if (c.type === 'tab') return `[Context: Tab] ${c.title || c.name} (${c.url || c.description})`
        return `[Context: ${c.type}] ${c.name} - ${c.description || ''}`
      }).join('\n')
      
      finalMessage = `Context:\n${contextString}\n\n${messageText}`
    }

    // Send message via AI SDK useChat
    sendMessage({ text: finalMessage })
  }

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

  const isEmpty = messages.length === 0

  return (
    <Transition.Root show={isPanelOpen} as={Fragment}>
      <div className="absolute inset-0 z-50 flex pointer-events-none">
        <Transition.Child
          as={Fragment}
          enter="transform transition ease-smooth duration-400"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="transform transition ease-smooth duration-400"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
        >
          <div className="relative ml-auto w-[420px] h-full pointer-events-auto">
            {/* Panel Container */}
            <div className="h-full flex flex-col bg-surface-50 dark:bg-surface-850 border-l border-surface-200 dark:border-surface-700 shadow-dramatic">
              
              {/* Header - Ultra Minimal */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex-shrink-0 px-5 py-4 flex items-center justify-between border-b border-surface-100 dark:border-surface-800"
              >
                <div className="flex items-center gap-3">
                  {/* Minimal Ron Logo */}
                  <div className="w-8 h-8 rounded-xl bg-ink dark:bg-ink-inverse flex items-center justify-center">
                    <span className="text-sm font-display font-light text-surface-0 dark:text-surface-900">R</span>
                  </div>
                  <h2 className="text-body-md font-medium text-ink dark:text-ink-inverse">
                    Ron
                  </h2>
                </div>

                <div className="flex items-center gap-1">
                  {/* New Chat Button */}
                  <motion.button
                    onClick={startNewChat}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-lg text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    title="New Chat"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </motion.button>

                  {/* History Button */}
                  <div className="relative">
                    <motion.button
                      onClick={() => setShowHistory(!showHistory)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        showHistory
                          ? "text-ink dark:text-ink-inverse bg-surface-100 dark:bg-surface-800"
                          : "text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse hover:bg-surface-100 dark:hover:bg-surface-800"
                      )}
                      title="Chat History"
                    >
                      <ClockIcon className="w-5 h-5" />
                    </motion.button>

                    {/* History Dropdown */}
                    <AnimatePresence>
                      {showHistory && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 w-64 max-h-80 overflow-y-auto rounded-xl bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700 shadow-lg z-50"
                        >
                          <div className="p-2">
                            <p className="px-2 py-1 text-label text-ink-muted dark:text-ink-inverse-muted uppercase tracking-wider">Recent Chats</p>
                            {isLoadingSessions ? (
                              <div className="px-2 py-4 text-center text-body-sm text-ink-muted dark:text-ink-inverse-muted">Loading...</div>
                            ) : sessionsList.length === 0 ? (
                              <div className="px-2 py-4 text-center text-body-sm text-ink-muted dark:text-ink-inverse-muted">No previous chats</div>
                            ) : (
                              sessionsList.slice(0, 10).map((session) => (
                                <button
                                  key={session.session_id}
                                  onClick={() => {
                                    loadSession(session.session_id)
                                    setShowHistory(false)
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                                >
                                  <p className="text-body-sm text-ink dark:text-ink-inverse truncate">{session.summary}</p>
                                  <p className="text-body-xs text-ink-muted dark:text-ink-inverse-muted">
                                    {new Date(session.created_at).toLocaleDateString()}
                                  </p>
                                </button>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Mode Toggle */}
                  <ModeToggle 
                    mode={interactionMode} 
                    onChange={setInteractionMode} 
                  />
                  
                  {/* Close Button */}
                  <motion.button
                    onClick={closePanel}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-lg text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </motion.button>
                </div>
              </motion.div>

              {/* Vision Active Banner */}
              <AnimatePresence>
                {isViewingScreen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex-shrink-0 overflow-hidden"
                  >
                    <div className="px-5 py-4 bg-gradient-to-r from-accent/5 to-accent-light/5 dark:from-accent/10 dark:to-accent-light/10 border-b border-accent/20 dark:border-accent-light/20">
                      <div className="flex items-center gap-3 mb-3">
                        <motion.div
                          className="w-2 h-2 rounded-full bg-accent dark:bg-accent-light"
                          animate={{ opacity: [1, 0.4, 1], scale: [1, 0.8, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <span className="text-label uppercase tracking-wider text-accent dark:text-accent-light">
                          Analyzing Screen
                        </span>
                      </div>
                      {screenshotData && (
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
                          <img src={screenshotData} alt="Screen" className="w-full h-full object-cover" />
                          <motion.div
                            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent dark:via-accent-light to-transparent"
                            animate={{ top: ['0%', '100%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Content Area */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <AnimatePresence mode="wait">
                  {interactionMode === 'voice' ? (
                    <VoiceMode key="voice" />
                  ) : (
                    <TextMode
                      key="text"
                      messages={messages}
                      isEmpty={isEmpty}
                      isTyping={isTyping}
                      onSuggestionClick={handleSubmit}
                      messagesEndRef={messagesEndRef}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Input Area - Only for text mode */}
              {interactionMode === 'text' && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, ease: EASE }}
                  className="flex-shrink-0 p-4 border-t border-surface-100 dark:border-surface-800"
                >
                  {/* Ask Ron Options - Inline listbox */}
                  <AnimatePresence>
                    {askRonStep !== 'closed' && askRonStep !== undefined && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="mb-3"
                      >
                        <AskRonOptions 
                          selectedText={askRonSelectedText || ''}
                          sourceUrl={askRonSourceUrl || ''}
                          isLoading={askRonStep === 'loading' || askRonStep === 'executing'}
                          thinkingText={askRonThinkingText}
                          options={askRonOptions}
                          onSelectOption={selectAskRonOption}
                          onSelectSomethingElse={() => setAskRonStep('custom-prompt')}
                          onClose={closeAskRon}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Text Attachments (for pasted content 2000+ chars) */}
                  {textAttachments.length > 0 && (
                    <div className="mb-3 px-1 flex flex-wrap gap-2">
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

                  {/* Selected Context Chips */}
                  {selectedContexts.length > 0 && (
                    <div className="mb-3 px-1 flex flex-wrap gap-2">
                      {selectedContexts.map(context => (
                        <ContextChip
                          key={context.id}
                          context={context}
                          onRemove={() => setSelectedContexts(prev => prev.filter(c => c.id !== context.id))}
                        />
                      ))}
                    </div>
                  )}

                  {/* Input Container */}
                  <div className={cn(
                    "relative rounded-2xl overflow-visible transition-all duration-300",
                    "bg-surface-50 dark:bg-surface-850",
                    "border",
                    input 
                      ? "border-surface-300 dark:border-surface-600 shadow-sm" 
                      : "border-surface-200 dark:border-surface-700",
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
                        disabled={(!input.trim() && textAttachments.length === 0) || status !== 'ready'}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "flex-shrink-0",
                          "w-8 h-8 rounded-lg",
                          "flex items-center justify-center",
                          "transition-all duration-300",
                          (input.trim() || textAttachments.length > 0) && status === 'ready'
                            ? "bg-ink dark:bg-ink-inverse text-surface-0 dark:text-surface-900"
                            : "bg-surface-200 dark:bg-surface-700 text-ink-muted/50 dark:text-ink-inverse-muted/50"
                        )}
                      >
                        <ArrowUpIcon className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Minimal footer hint */}
                  <p className="text-center text-body-xs text-ink-muted/40 dark:text-ink-inverse-muted/40 mt-2">
                    ↵ to send
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition.Root>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE TOGGLE - Elegant pill switcher
// ─────────────────────────────────────────────────────────────────────────────

interface ModeToggleProps {
  mode: 'voice' | 'text'
  onChange: (mode: 'voice' | 'text') => void
}

function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="relative flex items-center p-1 rounded-xl bg-surface-100 dark:bg-surface-800">
      {/* Sliding indicator */}
      <motion.div
        className="absolute top-1 bottom-1 rounded-lg bg-surface-0 dark:bg-surface-700 shadow-soft"
        layoutId="mode-indicator"
        initial={false}
        animate={{
          left: mode === 'voice' ? 4 : 'calc(50%)',
          right: mode === 'voice' ? 'calc(50%)' : 4,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
      
      <button
        onClick={() => onChange('voice')}
        aria-label="Voice Mode"
        className={cn(
          "relative z-10 px-3 py-1.5 rounded-lg transition-colors",
          mode === 'voice' ? "text-ink dark:text-ink-inverse" : "text-ink-muted dark:text-ink-inverse-muted"
        )}
      >
        <MicIcon className="w-4 h-4" />
      </button>
      <button
        onClick={() => onChange('text')}
        aria-label="Text Mode"
        className={cn(
          "relative z-10 px-3 py-1.5 rounded-lg transition-colors",
          mode === 'text' ? "text-ink dark:text-ink-inverse" : "text-ink-muted dark:text-ink-inverse-muted"
        )}
      >
        <ChatIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE MODE - Minimal & Elegant
// ─────────────────────────────────────────────────────────────────────────────

function VoiceMode() {
  const [isListening, setIsListening] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ ease: EASE }}
      className="h-full flex flex-col items-center justify-center px-8"
    >
      {/* Voice Orb - Ultra minimal */}
      <motion.button
        onClick={() => setIsListening(!isListening)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="relative"
      >
        {/* Subtle pulse rings */}
        {isListening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border border-ink/10 dark:border-ink-inverse/10"
              animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border border-ink/10 dark:border-ink-inverse/10"
              animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
          </>
        )}
        
        {/* Main orb */}
        <div className={cn(
          "relative w-24 h-24 rounded-full",
          "flex items-center justify-center",
          "transition-all duration-500",
          isListening
            ? "bg-ink dark:bg-ink-inverse"
            : "bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
        )}>
          <MicIcon className={cn(
            "w-8 h-8 transition-colors duration-300",
            isListening ? "text-surface-0 dark:text-surface-900" : "text-ink-muted dark:text-ink-inverse-muted"
          )} />
        </div>
      </motion.button>

      {/* Status text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-8 text-body-sm text-ink-muted dark:text-ink-inverse-muted text-center"
      >
        {isListening ? (
          <span className="flex items-center gap-2">
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-ink dark:bg-ink-inverse"
            />
            Listening
          </span>
        ) : (
          "Tap to speak"
        )}
      </motion.p>

      {/* Keyboard hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-3 text-body-xs text-ink-muted/40 dark:text-ink-inverse-muted/40"
      >
        or press Space
      </motion.p>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT MODE - Chat interface
// ─────────────────────────────────────────────────────────────────────────────

interface TextModeProps {
  messages: Array<{ id: string; role: string; parts: MessagePart[] }>
  isEmpty: boolean
  isTyping: boolean
  onSuggestionClick: (text: string) => void
  messagesEndRef: React.RefObject<HTMLDivElement | null>
}

function TextMode({ messages, isEmpty, isTyping, onSuggestionClick, messagesEndRef }: TextModeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ ease: EASE }}
      className="h-full flex flex-col overflow-hidden min-h-0"
    >
      {isEmpty ? (
        <EmptyState onSuggestionClick={onSuggestionClick} />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {/* Typing indicator */}
          {isTyping && messages[messages.length - 1]?.role === 'user' && (
            <TypingIndicator />
          )}
          
          <div ref={messagesEndRef} />
        </div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE - Minimal & Refined
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      {/* Minimal logo mark */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative mb-10"
      >
        <div className="w-14 h-14 rounded-2xl bg-ink dark:bg-ink-inverse flex items-center justify-center">
          <span className="text-xl font-display font-light text-surface-0 dark:text-surface-900">R</span>
        </div>
        {/* Subtle pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-2xl border border-ink/20 dark:border-ink-inverse/20"
          animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      </motion.div>

      {/* Title */}
      <motion.h3
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-display-sm font-display font-light text-ink dark:text-ink-inverse text-center mb-2"
      >
        How can I help?
      </motion.h3>

      <motion.p
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-body-sm text-ink-muted/70 dark:text-ink-inverse-muted/70 text-center mb-10 max-w-xs"
      >
        Browse, search, analyze, and accomplish.
      </motion.p>

      {/* Sleek Pill Suggestions */}
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap justify-center gap-2 px-2"
      >
        {SUGGESTIONS.map((suggestion, i) => (
          <motion.button
            key={i}
            onClick={() => onSuggestionClick(suggestion.text)}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25 + i * 0.04 }}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "group",
              "inline-flex items-center gap-2",
              "px-4 py-2 rounded-full",
              "bg-surface-50 dark:bg-surface-850",
              "border border-surface-200 dark:border-surface-700",
              "hover:border-surface-300 dark:hover:border-surface-600",
              "hover:bg-surface-100 dark:hover:bg-surface-800",
              "transition-all duration-300 ease-out",
            )}
          >
            <span className="text-ink-muted/50 dark:text-ink-inverse-muted/50 text-sm font-light group-hover:text-ink-muted dark:group-hover:text-ink-inverse-muted transition-colors">
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
    // User messages - just show text
    const textParts = message.parts.filter(p => p.type === 'text') as TextUIPart[]
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gradient-to-br from-accent to-accent-light text-white rounded-br-md">
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
      className="flex items-center gap-2"
    >
      <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-md bg-surface-100 dark:bg-surface-800">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-ink-muted dark:bg-ink-inverse-muted"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT CHIP
// ─────────────────────────────────────────────────────────────────────────────

function ContextChip({ context, onRemove }: { context: ContextItem; onRemove: () => void }) {
  return (
    <div
      className={cn(
        'group inline-flex items-center gap-2 pl-2 pr-1 py-1 rounded-full',
        'bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700'
      )}
    >
      {context.favicon ? (
        <img src={context.favicon} alt="" className="w-4 h-4 rounded" />
      ) : (
        <GlobeIcon className="w-4 h-4 text-ink-muted dark:text-ink-inverse-muted" />
      )}
      <span className="text-body-xs text-ink dark:text-ink-inverse max-w-[160px] truncate">
        {context.name}
      </span>
      <button
        onClick={onRemove}
        className="w-5 h-5 rounded-full hover:bg-surface-200 dark:hover:bg-surface-700 flex items-center justify-center"
        aria-label="Remove attachment"
      >
        <XSmallIcon className="w-3 h-3 text-ink-muted dark:text-ink-inverse-muted" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function XSmallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
