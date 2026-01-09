/**
 * SearchChat - Premium AI Search Chat Interface
 *
 * Exact replica of RonTab.tsx + AgentPanel.tsx patterns
 * Features streaming responses with reasoning, chain of thought, inline citations, and sources
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

// Response Components (for streaming markdown)
import { ResponseMarkdown } from '@/components/ai-elements/response'

// Context Picker
import { ContextPicker, SelectedContexts, type ContextItem } from '@/components/agent-panel/ContextPicker'

// Source Card for citations
import { SourceCard, type SourceData } from './SourceCard'

// Chain of Thought Component
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought'

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
}

// Export for external use
export type ChatMessage = Message

// Sleek, minimal suggestions
const SUGGESTIONS = [
  { text: 'Tell me more about this', icon: '✦' },
  { text: 'What are the key points?', icon: '◎' },
  { text: 'Show me related topics', icon: '→' },
  { text: 'Deep dive into details', icon: '∑' },
]

const API_BASE_URL = import.meta.env.VITE_PERPLEXITY_API_URL || 'http://localhost:8765'

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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const isEmpty = messages.length === 0

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initial search on mount
  useEffect(() => {
    if (query) {
      handleSubmit(query)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText) return

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
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      abortControllerRef.current = new AbortController()

      // Initialize session if needed
      let currentSessionId = sessionId
      if (!currentSessionId) {
        const startResponse = await fetch(`${API_BASE_URL}/chat/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: abortControllerRef.current.signal,
        })

        if (!startResponse.ok) throw new Error('Failed to start session')
        const startData = await startResponse.json()
        currentSessionId = startData.session_id
        setSessionId(currentSessionId)
      }

      // Stream response from backend using correct endpoint
      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          query: messageText,
          model: 'sonar-reasoning-pro'
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) throw new Error('Search request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let currentContent = ''
      let currentReasoning: ReasoningStep[] = []
      let searchResults: SourceData[] = []
      let images: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const chunk = JSON.parse(data)

            // Handle 4 chunk types based on backend
            if (chunk.object === 'chat.reasoning') {
              // Reasoning steps
              if (chunk.delta?.reasoning_steps) {
                currentReasoning = chunk.delta.reasoning_steps
                setMessages(prev => prev.map(m =>
                  m.id === assistantMessage.id
                    ? { ...m, reasoning: currentReasoning }
                    : m
                ))
              }
            } else if (chunk.object === 'chat.reasoning.done') {
              // Reasoning complete with search results
              if (chunk.search_results) {
                searchResults = chunk.search_results.map((r: any, i: number) => ({
                  id: `source-${i}`,
                  url: r.url,
                  title: r.title,
                  snippet: r.snippet || r.description || '',
                  domain: new URL(r.url).hostname,
                  type: 'web' as const,
                  favicon: r.favicon,
                }))
              }
              if (chunk.images) {
                images = chunk.images
              }
              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, isReasoningComplete: true, searchResults, images }
                  : m
              ))
            } else if (chunk.object === 'chat.completion.chunk') {
              // Content streaming
              if (chunk.delta?.content) {
                currentContent += chunk.delta.content
                setMessages(prev => prev.map(m =>
                  m.id === assistantMessage.id
                    ? { ...m, content: currentContent }
                    : m
                ))
              }
            } else if (chunk.object === 'chat.completion.done') {
              // Stream complete
              if (chunk.search_results && searchResults.length === 0) {
                searchResults = chunk.search_results.map((r: any, i: number) => ({
                  id: `source-${i}`,
                  url: r.url,
                  title: r.title,
                  snippet: r.snippet || r.description || '',
                  domain: new URL(r.url).hostname,
                  type: 'web' as const,
                  favicon: r.favicon,
                }))
              }
              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, isStreaming: false, searchResults: searchResults.length > 0 ? searchResults : m.searchResults }
                  : m
              ))
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
  }, [input, messages, sessionId])

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col gap-3", isUser ? "items-end" : "items-start")}
    >
      <div className={cn("max-w-[85%]", isUser ? "order-2" : "order-1")}>
        {/* Chain of Thought - Reasoning steps */}
        {!isUser && message.reasoning && message.reasoning.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3"
          >
            <ChainOfThought defaultOpen={false}>
              <ChainOfThoughtHeader>
                Reasoning ({message.reasoning.length} steps)
              </ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                {message.reasoning.map((step, i) => (
                  <ChainOfThoughtStep
                    key={i}
                    label={step.thought}
                    description={step.type}
                    status={message.isReasoningComplete ? 'complete' : 'running'}
                  />
                ))}
              </ChainOfThoughtContent>
            </ChainOfThought>
          </motion.div>
        )}

        {/* Content with inline citations */}
        <div className={cn(
          "px-4 py-3 rounded-2xl",
          isUser
            ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 rounded-br-md [&_*]:text-white [&_code]:bg-white/20 [&_code]:text-white [&_a]:text-white [&_a]:underline"
            : "bg-surface-100 dark:bg-surface-800 text-ink dark:text-ink-inverse rounded-bl-md"
        )}>
          <ResponseMarkdown
            content={message.content}
            isStreaming={message.isStreaming}
            className="text-body-sm"
          />
        </div>

        {/* Source Cards Grid */}
        {!isUser && message.searchResults && message.searchResults.length > 0 && !message.isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 grid grid-cols-2 gap-3"
          >
            {message.searchResults.slice(0, 6).map((source, i) => (
              <SourceCard
                key={source.id}
                source={source}
                citationNumber={i + 1}
                className="h-full"
              />
            ))}
          </motion.div>
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