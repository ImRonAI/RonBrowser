import { useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Transition } from '@headlessui/react'
import { XMarkIcon, PlusIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useAgentUi } from '@/context/AgentUiContext'
import { subscribeAgentPanelMessages } from '@/services/agentChatBridge'
import { cn } from '@/utils/cn'
import { ContextPicker, type ContextItem } from './ContextPicker'
import { AskRonOptions } from '@/components/ai-elements/ask-ron-options'
import { TextAttachmentCard } from '@/components/ai-elements/text-attachment-card'
import { fileToDataUrl, makePastedTextFilename } from '@/utils/file-utils'
import type { TextAttachment } from '@/components/ai-elements/types'
import { Persona, type PersonaState } from '@/components/ai-elements/persona'
import { ChatHistory } from '@/components/search-results/ChatHistory'

// AI SDK v6 - useChat with DefaultChatTransport for UIMessageStream
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport, getToolName, isToolUIPart, type TextUIPart } from 'ai'
import { ChainOfThoughtMessage } from '@/components/ai-elements/chain-of-thought-message'
import { handleOrchestrationDataPart } from '@/utils/orchestration-stream'
import { useOrchestrationStore } from '@/stores/orchestrationStore'

// Preview Panel
import { AccordionPreview } from '@/components/ai-elements/preview-panel'
import { usePreviewStore } from '@/stores/previewStore'

type MessagePart = UIMessage['parts'][number]
type OrchestrationToolStatus = 'running' | 'success' | 'error'

const EASE = [0.16, 1, 0.3, 1] as const
const LARGE_PASTE_THRESHOLD_CHARS = 2000
const MAIN_SEARCH_BAR_ID = 'main-search-bar'

const shouldSkipAutoFocus = () => {
  if (typeof document === 'undefined') return false
  const activeElement = document.activeElement as HTMLElement | null
  return activeElement?.id === MAIN_SEARCH_BAR_ID
}

// Sleek pill suggestions - minimal & elegant
const SUGGESTIONS = [
  { icon: '◎', text: 'Navigate this page' },
  { icon: '✦', text: 'Search the web' },
  { icon: '∑', text: 'Summarize content' },
  { icon: '?', text: 'What can you do?' },
]

// Single SuperAgent endpoint for all panel conversations (voice input is transcribed client-side).
const SUPERAGENT_API = 'http://localhost:8765/agents/super/stream'

function toOrchestrationToolStatus(state: unknown): OrchestrationToolStatus {
  if (state === 'output-error' || state === 'output-denied') return 'error'
  if (state === 'output-available' || state === 'approval-responded') return 'success'
  return 'running'
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function toStringValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function extractLiveToolExecutions(messages: UIMessage[]) {
  const toolMap = new Map<
    string,
    {
      id: string
      name: string
      status: OrchestrationToolStatus
      input?: Record<string, unknown>
      output?: string
      error?: string
      timestamp: number
    }
  >()

  messages.forEach((message) => {
    message.parts.forEach((part, index) => {
      if (!isToolUIPart(part)) return

      const toolPart = part as {
        state?: unknown
        toolCallId?: unknown
        toolName?: unknown
        input?: unknown
        output?: unknown
        errorText?: unknown
        error?: unknown
      }

      const toolCallId =
        typeof toolPart.toolCallId === 'string' && toolPart.toolCallId
          ? toolPart.toolCallId
          : `${message.id}-tool-${index}`
      const toolName =
        (typeof toolPart.toolName === 'string' && toolPart.toolName) ||
        getToolName(part as any) ||
        toolCallId

      const existing = toolMap.get(toolCallId)
      toolMap.set(toolCallId, {
        id: toolCallId,
        name: toolName,
        status: toOrchestrationToolStatus(toolPart.state),
        input: toRecord(toolPart.input),
        output: toStringValue(toolPart.output),
        error: toStringValue(toolPart.errorText ?? toolPart.error),
        timestamp: existing?.timestamp || Date.now(),
      })
    })
  })

  return Array.from(toolMap.values())
}

function hydrateParts(content: unknown): MessagePart[] {
  if (typeof content === 'string') return [{ type: 'text', text: content } as MessagePart]
  if (!Array.isArray(content)) return [{ type: 'text', text: '' } as MessagePart]

  return content.flatMap((block: any): MessagePart[] => {
    if (typeof block === 'string') return [{ type: 'text', text: block } as MessagePart]
    if (block?.type === 'text') return [{ type: 'text', text: block.text || '' } as MessagePart]
    if (block?.type === 'reasoning' || block?.type === 'thinking') {
      return [{ type: 'reasoning', text: block.text || block.content || '', state: 'done' } as MessagePart]
    }
    if (block?.type?.startsWith?.('data-')) return [block as MessagePart]
    if (block?.type === 'dynamic-tool' || block?.type?.startsWith?.('tool-')) return [block as MessagePart]
    if (block?.type === 'source-url' || block?.type === 'source-document' || block?.type === 'file') return [block as MessagePart]
    return []
  })
}

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
    askRonPendingPrompt,
    setAskRonStep,
    selectAskRonOption,
    closeAskRon,
    consumeAskRonPendingPrompt,
  } = useAgentUi()

  const [showHistory, setShowHistory] = useState(false)
  const trackedToolStreamAgentIdsRef = useRef<Set<string>>(new Set())

  // Wrapper for ChatHistory component
  const handleLoadHistorySession = (sid: string) => {
    const previousSessionId = sessionIdRef.current
    if (previousSessionId && previousSessionId !== sid) {
      useOrchestrationStore.getState().clearStreamingData(`panel-session:${previousSessionId}`)
    }
    sessionIdRef.current = sid

    // Fetch and hydrate chat history into UIMessage parts.
    fetch(`http://localhost:8765/chat-sessions/${sid}`)
      .then(res => res.json())
      .then(data => {
        const loadedMessages: UIMessage[] = data.messages.map((msg: any, i: number) => {
          const parts = hydrateParts(msg.content)

          return {
            id: `msg-${sid}-${i}`,
            role: msg.role,
            content: '',
            parts,
          }
        })
        setMessages(loadedMessages)
      })
      .catch(err => console.error("Failed to hydrate chat:", err))
  }

  // Use useRef to hold the session ID for stable reference in body callback
  const sessionIdRef = useRef<string>(
    `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  )
  const transport = useMemo(() => (
    new DefaultChatTransport({
      api: SUPERAGENT_API,
      body: () => {
        return {
          session_id: sessionIdRef.current,
          invocation_state: {
            interaction_mode: 'text',
          },
        }
      },
    })
  ), [])

  // AI SDK v6 useChat with DefaultChatTransport for UIMessageStream
  // body option adds session_id to every request per AI SDK docs
  const { messages, sendMessage, status, setMessages, clearError } = useChat({
    transport,
    onError: (error: Error) => {
      console.error('[AgentPanel] API Error:', error)
      console.error('[AgentPanel] Failed to connect to backend at:', SUPERAGENT_API)
      console.error('[AgentPanel] Make sure backend is running: npm run dev:backend')
    },
    onData: (dataPart) => {
      handleOrchestrationDataPart(dataPart as { type: string; data?: any })
    },
  })

  const queuedExternalMessagesRef = useRef<string[]>([])

  const dispatchPlainText = useCallback((text: string) => {
    const normalized = text.trim()
    if (!normalized) return

    const canSend = status === 'ready' || status === 'error'
    if (!canSend) {
      queuedExternalMessagesRef.current.push(normalized)
      return
    }

    if (status === 'error') {
      clearError()
    }

    sendMessage({ text: normalized } as any)
  }, [status, clearError, sendMessage])

  useEffect(() => {
    return subscribeAgentPanelMessages((message) => {
      dispatchPlainText(message.text)
    })
  }, [dispatchPlainText])

  useEffect(() => {
    const streamAgentId = `panel-session:${sessionIdRef.current}`
    trackedToolStreamAgentIdsRef.current.add(streamAgentId)

    const tools = extractLiveToolExecutions(messages)
    if (tools.length === 0) {
      useOrchestrationStore.getState().clearStreamingData(streamAgentId)
      return
    }

    useOrchestrationStore.getState().syncStreamingData(streamAgentId, { tools })
  }, [messages])

  useEffect(() => {
    return () => {
      const store = useOrchestrationStore.getState()
      trackedToolStreamAgentIdsRef.current.forEach((agentId) => {
        store.clearStreamingData(agentId)
      })
    }
  }, [])

  useEffect(() => {
    const canSend = status === 'ready' || status === 'error'
    if (!canSend || queuedExternalMessagesRef.current.length === 0) return

    const [next, ...rest] = queuedExternalMessagesRef.current
    queuedExternalMessagesRef.current = rest

    if (status === 'error') {
      clearError()
    }

    sendMessage({ text: next } as any)
  }, [status, clearError, sendMessage])

  useEffect(() => {
    if (!askRonPendingPrompt) return
    const pendingPrompt = consumeAskRonPendingPrompt()
    if (!pendingPrompt) return
    dispatchPlainText(pendingPrompt)
    closeAskRon()
  }, [askRonPendingPrompt, consumeAskRonPendingPrompt, dispatchPlainText, closeAskRon])

  // Handle new chat - resets both local UI state and store state
  const handleNewChat = () => {
    const previousSessionId = sessionIdRef.current
    // 1. Generate new session ID for next request
    const newSessionId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    if (previousSessionId) {
      useOrchestrationStore.getState().clearStreamingData(`panel-session:${previousSessionId}`)
    }
    sessionIdRef.current = newSessionId
    
    // 2. Clear local chat UI state (AI SDK)
    setMessages([])

    // 3. Clear orchestration visualization state
    useOrchestrationStore.getState().reset()
    
    // 4. Focus input for immediate typing (unless user is in main search bar)
    setTimeout(() => {
      if (!shouldSkipAutoFocus()) {
        inputRef.current?.focus()
      }
    }, 100)
  }

  const handleDeleteCurrentSession = async () => {
    const currentId = sessionIdRef.current
    if (!currentId || !confirm('Delete this chat permanently?')) return
    
    try {
      const res = await fetch(`http://localhost:8765/chat-sessions/${currentId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        handleNewChat()
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

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
      setTimeout(() => {
        if (!shouldSkipAutoFocus()) {
          inputRef.current?.focus()
        }
      }, 300)
    }
  }, [isPanelOpen, interactionMode])

  const handleSubmit = async (text?: string) => {
    const messageText = text || input.trim()
    const canSend = status === 'ready' || status === 'error'
    if ((!messageText && textAttachments.length === 0) || !canSend) return

    if (status === 'error') {
      clearError()
    }

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
    
    setTextAttachments([])

    // Send message with files array in AI SDK v6 format
    sendMessage({ 
      text: finalMessage || 'Sent with attachments',
      files,
    } as any)
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
            {/* Panel Container - Premium Frosted Glass */}
            <div className="h-full flex flex-col bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl border-l border-indigo-200/50 dark:border-indigo-900/50 shadow-2xl">
              
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 dark:from-indigo-500/10 dark:to-violet-500/10 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-indigo-500/3 to-transparent blur-2xl" />
              </div>
              
              {/* Header - Ultra Premium */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="relative flex-shrink-0 px-5 py-4 flex items-center justify-between border-b border-indigo-100/50 dark:border-surface-800/80 bg-gradient-to-r from-white/50 via-indigo-50/30 to-white/50 dark:from-surface-900/50 dark:via-indigo-950/20 dark:to-surface-900/50"
              >
                <div className="flex items-center gap-3">
                  {/* Premium Ron Logo with violet gradient and glow */}
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                      <span className="text-base font-display font-medium text-white">R</span>
                    </div>
                    {/* Subtle glow ring */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 blur-md opacity-30 -z-10" />
                  </div>
                  <h2 className="text-lg font-semibold bg-gradient-to-r from-ink dark:from-ink-inverse to-indigo-600 dark:to-indigo-400 bg-clip-text text-transparent">
                    Ron
                  </h2>
                </div>

                <div className="flex items-center gap-1">
                  {/* New Chat Button */}
                  <motion.button
                    onClick={handleNewChat}
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

                    <ChatHistory 
                      isOpen={showHistory} 
                      onClose={() => setShowHistory(false)}
                      onSelectSession={handleLoadHistorySession}
                      currentSessionId={sessionIdRef.current}
                    />
                  </div>

                  {/* Delete Chat Button */}
                  <motion.button
                    onClick={handleDeleteCurrentSession}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-lg text-ink-muted dark:text-ink-inverse-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete Chat"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </motion.button>

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
                    <VoiceMode
                      key="voice"
                      messages={messages}
                      isTyping={isTyping}
                      onSubmit={handleSubmit}
                      messagesEndRef={messagesEndRef}
                    />
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
                  className="relative flex-shrink-0 p-4 border-t border-indigo-100/50 dark:border-surface-800/80 bg-gradient-to-t from-white/80 via-white/60 to-transparent dark:from-surface-900/80 dark:via-surface-900/60 dark:to-transparent"
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
                    "bg-white dark:bg-surface-850",
                    "border",
                    input 
                      ? "border-indigo-300 dark:border-indigo-700 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/10" 
                      : "border-surface-200/80 dark:border-surface-700 shadow-sm",
                  )}>
                    {/* Subtle inner glow when focused */}
                    {input && (
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-indigo-500/5 to-transparent pointer-events-none" />
                    )}
                    {/* Input Row */}
                    <div className="relative flex items-center gap-2 px-3 py-2">
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
                        disabled={(!input.trim() && textAttachments.length === 0) || (status !== 'ready' && status !== 'error')}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "flex-shrink-0",
                          "w-8 h-8 rounded-lg",
                          "flex items-center justify-center",
                          "transition-all duration-300",
                          (input.trim() || textAttachments.length > 0) && (status === 'ready' || status === 'error')
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

interface VoiceModeProps {
  messages: Array<{ id: string; role: string; parts: MessagePart[] }>
  isTyping: boolean
  onSubmit: (text: string) => void
  messagesEndRef: React.RefObject<HTMLDivElement | null>
}

function VoiceMode({ messages, isTyping, onSubmit, messagesEndRef }: VoiceModeProps) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [speechError, setSpeechError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)

  // Derive Persona animation state from voice mode state
  const personaState: PersonaState = isListening
    ? 'listening'
    : isTyping
      ? 'thinking'
      : 'idle'

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null
  const supportsSpeech = Boolean(SpeechRecognitionCtor)

  const stopListening = () => {
    const recognition = recognitionRef.current
    if (!recognition) {
      setIsListening(false)
      return
    }
    try {
      recognition.stop()
    } catch {
      // no-op: stop may throw if recognition was not active
    }
    setIsListening(false)
  }

  const startListening = () => {
    if (!supportsSpeech || !SpeechRecognitionCtor) {
      setSpeechError('Speech recognition is unavailable in this build.')
      return
    }

    setSpeechError(null)

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event: any) => {
      let nextInterim = ''
      let finalized = ''

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const chunk = result?.[0]?.transcript ?? ''
        if (!chunk) continue
        if (result.isFinal) {
          finalized += chunk
        } else {
          nextInterim += chunk
        }
      }

      if (finalized.trim()) {
        setTranscript((prev) => `${prev} ${finalized}`.trim())
      }
      setInterimTranscript(nextInterim.trim())
    }

    recognition.onerror = (event: any) => {
      setSpeechError(event?.error ? `Speech error: ${event.error}` : 'Speech recognition failed.')
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [])

  const finalTranscript = `${transcript} ${interimTranscript}`.trim()
  const canSend = finalTranscript.length > 0
  const isEmpty = messages.length === 0

  const handleSend = () => {
    const text = finalTranscript.trim()
    if (!text) return
    stopListening()
    setTranscript('')
    setInterimTranscript('')
    onSubmit(text)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ ease: EASE }}
      className="h-full flex flex-col min-h-0"
    >
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center px-8">
            {/* Persona Rive animation — responds to voice state */}
            <motion.button
              onClick={isListening ? stopListening : startListening}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative"
            >
              <div className="w-28 h-28 rounded-full overflow-hidden">
                <Persona
                  state={personaState}
                  variant="obsidian"
                  className="w-full h-full"
                />
              </div>
              {/* Listening pulse rings */}
              {isListening && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full border border-indigo-500/30"
                    animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border border-violet-500/20"
                    animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                  />
                </>
              )}
            </motion.button>
            <p className="mt-8 text-body-sm text-ink-muted dark:text-ink-inverse-muted text-center">
              {isListening ? 'Listening...' : 'Tap to speak'}
            </p>
            {!supportsSpeech && (
              <p className="mt-2 text-body-xs text-red-500/90 text-center">
                Speech recognition unavailable. You can still type in voice mode.
              </p>
            )}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isTyping && messages[messages.length - 1]?.role === 'user' && (
              <TypingIndicator />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="flex-shrink-0 p-4 border-t border-indigo-100/50 dark:border-surface-800/80 bg-gradient-to-t from-white/80 via-white/60 to-transparent dark:from-surface-900/80 dark:via-surface-900/60 dark:to-transparent">
        {speechError && (
          <p className="mb-2 text-body-xs text-red-500">{speechError}</p>
        )}
        <div className="mb-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50/70 dark:bg-surface-850/70 px-3 py-2 min-h-[44px] text-body-sm text-ink dark:text-ink-inverse">
          {finalTranscript || (
            <span className="text-ink-muted dark:text-ink-inverse-muted">
              {isListening ? 'Listening...' : 'Voice transcript will appear here'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={isListening ? stopListening : startListening}
            className={cn(
              "px-3 py-2 rounded-lg text-body-sm transition-colors",
              isListening
                ? "bg-red-500 text-white"
                : "bg-surface-200 dark:bg-surface-700 text-ink dark:text-ink-inverse"
            )}
          >
            {isListening ? 'Stop' : 'Listen'}
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              "ml-auto px-3 py-2 rounded-lg text-body-sm transition-colors",
              canSend
                ? "bg-ink dark:bg-ink-inverse text-surface-0 dark:text-surface-900"
                : "bg-surface-200 dark:bg-surface-700 text-ink-muted/50 dark:text-ink-inverse-muted/50"
            )}
          >
            Send
          </button>
        </div>
      </div>
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
      {/* Premium logo mark with gradient and glow */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative mb-10"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex items-center justify-center shadow-xl shadow-indigo-600/40">
          <span className="text-2xl font-display font-medium text-white">R</span>
        </div>
        {/* Animated glow rings */}
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-indigo-500/40"
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-0 rounded-2xl border border-violet-500/30"
          animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
        />
        {/* Static glow behind */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 blur-xl opacity-40 -z-10" />
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

      {/* Premium Pill Suggestions with indigo accents */}
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap justify-center gap-2.5 px-2"
      >
        {SUGGESTIONS.map((suggestion, i) => (
          <motion.button
            key={i}
            onClick={() => onSuggestionClick(suggestion.text)}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25 + i * 0.05 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "group",
              "inline-flex items-center gap-2",
              "px-4 py-2.5 rounded-full",
              "bg-white dark:bg-surface-800",
              "border border-indigo-200/60 dark:border-surface-700",
              "hover:border-indigo-400 dark:hover:border-indigo-600",
              "hover:bg-indigo-50 dark:hover:bg-indigo-950/30",
              "hover:shadow-md hover:shadow-indigo-500/10",
              "transition-all duration-300 ease-out",
            )}
          >
            <span className="text-indigo-400 dark:text-indigo-500 text-sm font-light group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {suggestion.icon}
            </span>
            <span className="text-body-sm text-ink-secondary dark:text-ink-inverse-secondary group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
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
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const isPreviewOpen = usePreviewStore(state => state.isOpen)

  if (isUser) {
    // User messages - just show text
    const textParts = message.parts.filter(p => p.type === 'text') as TextUIPart[]
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-br-md shadow-lg shadow-indigo-700/25">
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
        
        {/* Accordion Preview for browser/project automation */}
        {isPreviewOpen && (
          <AccordionPreview
            isExpanded={previewExpanded}
            onToggle={() => setPreviewExpanded(!previewExpanded)}
          />
        )}
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
