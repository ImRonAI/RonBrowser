/**
 * SearchChat - Premium AI Search Chat Interface
 *
 * Exact replica of RonTab.tsx + AgentPanel.tsx patterns
 * Features streaming responses with reasoning, chain of thought, inline citations, and sources
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { UIMessage } from '@ai-sdk/react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

import { ChainOfThoughtMessage } from '@/components/ai-elements/chain-of-thought-message'

// Context Picker
import { ContextPicker, SelectedContexts, type ContextItem } from '@/components/agent-panel/ContextPicker'

// Source Card for citations
import type { SourceData } from './SourceCard'

import { handleOrchestrationDataPart } from '@/utils/orchestration-stream'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

interface SearchChatProps {
  searchResult: { query: string; answer?: string; sources?: SourceData[] }
  onBack: () => void
}

interface ReasoningStep {
  thought: string
  type: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  reasoning?: ReasoningStep[]
  isReasoningComplete?: boolean
  searchResults?: SourceData[]
  images?: string[]
  toolExecutions?: ToolExecution[]
}

// Export for external use
export type ChatMessage = Message

type ToolExecution = {
  id: string
  name: string
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  input?: unknown
  output?: unknown
  errorText?: string
}

type MessagePart = UIMessage['parts'][number]

// Sleek, minimal suggestions
const SUGGESTIONS = [
  { text: 'Tell me more about this', icon: '✦' },
  { text: 'What are the key points?', icon: '◎' },
  { text: 'Show me related topics', icon: '→' },
  { text: 'Deep dive into details', icon: '∑' },
]

const API_BASE_URL = import.meta.env.VITE_SEARCH_API_URL || 'http://localhost:8765'

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function normalizeSources(raw: any): SourceData[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((item, index) => {
      if (!item) return null
      const url = item.url || item.link || item.source || ''
      if (!url) return null

      const title = item.title || item.name || getDomainFromUrl(url)
      const snippet = item.snippet || item.description || item.quote || ''
      const domain = item.domain || getDomainFromUrl(url)
      const type = item.type || 'web'

      return {
        id: item.id || `source-${index}-${domain}`,
        url,
        title,
        snippet,
        domain,
        type,
        favicon: item.favicon,
      } as SourceData
    })
    .filter((item): item is SourceData => Boolean(item))
}

function mergeSources(existing: SourceData[], incoming: SourceData[]): SourceData[] {
  if (incoming.length === 0) return existing
  const existingUrls = new Set(existing.map((source) => source.url))
  const merged = [...existing]
  for (const source of incoming) {
    if (!existingUrls.has(source.url)) {
      merged.push(source)
    }
  }
  return merged
}

function buildInitialContext(
  searchResult: SearchChatProps['searchResult'],
  userQuery: string
): string {
  const answer = searchResult.answer?.trim()
  const sources = searchResult.sources || []
  const sourcesText = sources
    .map((source, index) => `${index + 1}. ${source.title} - ${source.url}`)
    .join('\n')

  if (!answer && sources.length === 0) {
    return userQuery
  }

  return [
    'You are continuing an in-depth discussion based on the initial search.',
    answer ? `Initial answer:\n${answer}` : null,
    sources.length > 0 ? `Initial sources:\n${sourcesText}` : null,
    `User follow-up:\n${userQuery}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function buildSearchChatParts(message: Message): MessagePart[] {
  const parts: MessagePart[] = []
  const reasoningText = message.reasoning?.length
    ? message.reasoning
        .map((step) => `**${step.type}**\n${step.thought}`)
        .join('\n\n')
    : ''

  if (reasoningText) {
    parts.push({
      type: 'reasoning',
      text: reasoningText,
      state: message.isReasoningComplete ? 'done' : 'streaming',
    } as MessagePart)
  }

  message.toolExecutions?.forEach((tool) => {
    parts.push({
      type: 'dynamic-tool',
      toolName: tool.name,
      toolCallId: tool.id,
      state: tool.state,
      input: tool.input,
      output: tool.output,
      errorText: tool.errorText,
    } as MessagePart)
  })

  if (message.content) {
    parts.push({
      type: 'text',
      text: message.content,
      state: message.isStreaming ? 'streaming' : 'done',
    } as MessagePart)
  }

  return parts
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function SearchChat({ searchResult, onBack }: SearchChatProps) {
  const query = searchResult.query
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedContexts, setSelectedContexts] = useState<ContextItem[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [hasSentContext, setHasSentContext] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const isEmpty = messages.length === 0

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Seed chat with initial search result or fetch if missing
  useEffect(() => {
    if (!query) return

    if (searchResult.answer || (searchResult.sources && searchResult.sources.length > 0)) {
      setMessages([
        {
          id: `msg-${Date.now()}-user`,
          role: 'user',
          content: query,
          timestamp: Date.now(),
        },
        {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: searchResult.answer || '',
          timestamp: Date.now(),
          isStreaming: false,
          reasoning: [],
          isReasoningComplete: true,
          searchResults: searchResult.sources || [],
        },
      ])
      return
    }

    handleSubmit(query, { includeContext: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async (text?: string, options?: { includeContext?: boolean }) => {
    const messageText = text || input.trim()
    if (!messageText) return

    const shouldIncludeContext = options?.includeContext ?? (!hasSentContext && Boolean(searchResult.answer || searchResult.sources?.length))
    const requestText = shouldIncludeContext
      ? buildInitialContext(searchResult, messageText)
      : messageText

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: `msg-${Date.now()}-ai`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      reasoning: [],
      isReasoningComplete: false,
      toolExecutions: [],
    }
    setMessages(prev => [...prev, assistantMessage])

    const updateAssistantMessage = (update: Partial<Message>) => {
      setMessages(prev => prev.map(m =>
        m.id === assistantMessage.id ? { ...m, ...update } : m
      ))
    }

    const upsertToolExecution = (toolCallId: string, update: Partial<ToolExecution>) => {
      setMessages(prev => prev.map(m => {
        if (m.id !== assistantMessage.id) return m
        const existing = m.toolExecutions || []
        const index = existing.findIndex(tool => tool.id === toolCallId)
        if (index === -1) {
          return {
            ...m,
            toolExecutions: [
              ...existing,
              {
                id: toolCallId,
                name: update.name || toolCallId,
                state: update.state || 'input-streaming',
                input: update.input,
                output: update.output,
                errorText: update.errorText,
              },
            ],
          }
        }

        const next = [...existing]
        next[index] = {
          ...next[index],
          ...update,
          name: update.name || next[index].name,
        }
        return { ...m, toolExecutions: next }
      }))
    }

    try {
      abortControllerRef.current = new AbortController()

      // Initialize session id if needed
      let currentSessionId = sessionId
      if (!currentSessionId) {
        currentSessionId = crypto.randomUUID()
        setSessionId(currentSessionId)
      }

      // Stream response from search agent
      const response = await fetch(`${API_BASE_URL}/api/search-agent/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          persist_session: true,
          query: requestText,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) throw new Error('Search request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let currentContent = ''
      let reasoningText = ''
      let searchResults: SourceData[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith(':')) continue
          if (!line.startsWith('data: ')) continue

          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const event = JSON.parse(data)

            switch (event.type) {
              case 'text-delta':
                currentContent += event.delta || ''
                updateAssistantMessage({ content: currentContent })
                break

              case 'reasoning-delta':
                reasoningText += event.delta || ''
                updateAssistantMessage({
                  reasoning: reasoningText
                    ? [{ thought: reasoningText, type: 'analysis' }]
                    : [],
                })
                break

              case 'tool-input-start':
                if (event.toolCallId) {
                  upsertToolExecution(event.toolCallId, {
                    name: event.toolName || event.toolCallId,
                    state: 'input-streaming',
                  })
                }
                break

              case 'tool-input-available':
                if (event.toolCallId) {
                  upsertToolExecution(event.toolCallId, {
                    name: event.toolName || event.toolCallId,
                    state: 'input-available',
                    input: event.input,
                  })
                }
                if (event.input) {
                  searchResults = mergeSources(searchResults, normalizeSources(event.input?.sources || event.input?.search_results || []))
                }
                break

              case 'tool-output-available':
                if (event.toolCallId) {
                  upsertToolExecution(event.toolCallId, {
                    name: event.toolName,
                    state: 'output-available',
                    output: event.output,
                  })
                }
                if (event.output) {
                  searchResults = mergeSources(searchResults, normalizeSources(event.output?.sources || event.output?.search_results || event.output?.results || []))
                }
                break

              case 'tool-output-error':
                if (event.toolCallId) {
                  upsertToolExecution(event.toolCallId, {
                    name: event.toolName,
                    state: 'output-error',
                    errorText: event.errorText || 'Tool error',
                  })
                }
                break

              case 'source-url': {
                const url = event.url || event.sourceId || ''
                if (url) {
                  searchResults = mergeSources(searchResults, normalizeSources([{ url }]))
                }
                break
              }

              case 'source-document': {
                const url = event.sourceId || event.url || ''
                const title = event.title || getDomainFromUrl(url)
                if (url) {
                  searchResults = mergeSources(searchResults, normalizeSources([{ url, title }]))
                }
                break
              }

              case 'workflow_visualization':
                handleOrchestrationDataPart({ type: 'data-orchestration', data: event })
                {
                  const orchestrationName = event.toolName || 'workflow'
                  upsertToolExecution(event.toolCallId || `orchestration-${orchestrationName}`, {
                    name: orchestrationName,
                    state: 'output-available',
                    output: event,
                  })
                }
                break

              case 'multiagent_node_start':
              case 'multiagent_node_stream':
              case 'multiagent_node_stop':
              case 'multiagent_handoff':
              case 'multiagent_result':
                handleOrchestrationDataPart({ type: 'data-orchestration', data: event })
                break

              case 'data-orchestration':
                handleOrchestrationDataPart(event)
                break

              case 'finish':
                updateAssistantMessage({
                  isStreaming: false,
                  isReasoningComplete: true,
                  searchResults: searchResults.length > 0 ? searchResults : undefined,
                })
                setHasSentContext(true)
                break

              case 'error':
                throw new Error(event.errorText || 'Search agent error')

              case 'abort':
                throw new Error(event.reason || 'Stream aborted')

              default:
                break
            }
          } catch (e) {
            console.error('Failed to parse chunk:', e)
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error)
        // Remove failed assistant message
        setMessages(prev => prev.filter(m => m.id !== assistantMessage.id))
      }
    } finally {
      setIsTyping(false)
      abortControllerRef.current = null
    }
  }, [input, messages, sessionId, searchResult, hasSentContext])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface-0 dark:bg-surface-900">
      {/* Header with back button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-shrink-0 px-6 py-4 flex items-center gap-4 border-b border-surface-100 dark:border-surface-800"
      >
        <motion.button
          onClick={onBack}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 rounded-lg text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </motion.button>

        <div className="flex-1 min-w-0">
          <h2 className="text-body-md font-medium text-ink dark:text-ink-inverse truncate">
            {query || 'Search'}
          </h2>
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-full flex flex-col"
        >
          {isEmpty ? (
            <EmptyState query={query} onSubmit={handleSubmit} />
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                  />
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
        <div className="max-w-3xl mx-auto">
          {/* Selected Contexts Display */}
          <SelectedContexts
            contexts={selectedContexts}
            onRemove={(id) => setSelectedContexts(prev => prev.filter(c => c.id !== id))}
            className="mb-3"
          />

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
                placeholder="Ask a follow-up question..."
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
                disabled={!input.trim() || isTyping}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex-shrink-0",
                  "w-8 h-8 rounded-lg",
                  "flex items-center justify-center",
                  "transition-all duration-300",
                  input.trim() && !isTyping
                    ? "bg-ink dark:bg-ink-inverse text-surface-0 dark:text-surface-900"
                    : "bg-surface-200 dark:bg-surface-700 text-ink-muted/50 dark:text-ink-inverse-muted/50"
                )}
              >
                <ArrowUpIcon className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          <p className="text-center text-body-xs text-ink-muted/50 dark:text-ink-inverse-muted/50 mt-2">
            ↵ to send · Web search included
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ query, onSubmit }: { query: string; onSubmit: (text: string) => void }) {
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
        {query ? `Searching for "${query}"...` : 'What would you like to search?'}
      </motion.h2>

      <motion.p
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-body-sm text-ink-muted dark:text-ink-inverse-muted text-center mb-12 max-w-md"
      >
        I'll search the web and provide comprehensive answers with sources
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
// MESSAGE BUBBLE
// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const parts = buildSearchChatParts(message)
  const citations = (message.searchResults || []).map((source, index) => ({
    number: String(index + 1),
    title: source.title,
    url: source.url,
    snippet: source.snippet,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col gap-3", isUser ? "items-end" : "items-start")}
    >
      <div className={cn("max-w-[85%]", isUser ? "order-2" : "order-1")}>
        {isUser ? (
          <div className="px-4 py-3 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 rounded-br-md">
            <p className="text-body-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
        ) : (
          <ChainOfThoughtMessage
            parts={parts}
            isStreaming={message.isStreaming}
            messageId={message.id}
            citations={citations}
          />
        )}

        {/* Sources are rendered by ChainOfThoughtMessage via AI Elements */}
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

export default SearchChat
