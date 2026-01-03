/**
 * Ron Tab - Premium AI Chat Interface
 * 
 * Inspired by bolt.new, lovable.dev, and v0.app
 * Sophisticated, minimal, and undeniably beautiful.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { FullTask } from '@/types/task'

// Strands Orchestration Components
import {
  StrandsSwarm,
  type SwarmState,
  type StrandsSwarmNode,
  type StrandsSwarmEdge,
} from '@/components/ai-elements/strands-orchestration'

// Task Components (for collapsible accordion)
import { CollapsibleTask, type TaskStatus } from '@/components/ai-elements/task'

// Response Components (for streaming markdown)
import { ResponseMarkdown } from '@/components/ai-elements/response'

// Context Picker
import { ContextPicker, SelectedContexts, type ContextItem } from '@/components/agent-panel/ContextPicker'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

interface RonTabProps {
  task: FullTask
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  reasoning?: string
  isReasoningComplete?: boolean
  orchestration?: SwarmState // Optional orchestration state to show inline accordion
}

// Sleek, minimal suggestions
const SUGGESTIONS = [
  { text: 'Summarize this task', icon: '✦' },
  { text: 'Draft a status update', icon: '✎' },
  { text: 'What are the next steps?', icon: '→' },
  { text: 'Show agent orchestration', icon: '◎' },
]

// ─────────────────────────────────────────────────────────────────────────────
// SWARM STATE
// ─────────────────────────────────────────────────────────────────────────────

function createTaskSwarmState(task: FullTask): SwarmState {
  // Radial layout - Ron at top center, agents in a clean arc below
  // This prevents edge crossings by using spatial hierarchy
  const nodes: StrandsSwarmNode[] = [
    {
      id: "orchestrator",
      type: "swarm-node",
      position: { x: 320, y: 20 },
      data: {
        type: "swarm-node",
        agent: {
          id: "orchestrator",
          name: "Ron",
          description: "Coordinates task analysis",
          modelProvider: "bedrock",
          modelId: "claude-opus-4",
          tools: ["handoff_to_agent"],
          priority: 5,
        },
        status: "idle",
        isEntryPoint: true,
        canHandoffTo: ["analyst", "writer", "scheduler"],
      },
    },
    {
      id: "analyst",
      type: "swarm-node",
      position: { x: 40, y: 220 },
      data: {
        type: "swarm-node",
        agent: {
          id: "analyst",
          name: "Analyst",
          description: `Design new onboarding...`,
          modelProvider: "anthropic",
          modelId: "claude-sonnet-4",
          tools: ["web_search", "retrieve"],
          priority: 4,
        },
        status: "idle",
        canHandoffTo: ["orchestrator", "writer"],
      },
    },
    {
      id: "writer",
      type: "swarm-node",
      position: { x: 320, y: 220 },
      data: {
        type: "swarm-node",
        agent: {
          id: "writer",
          name: "Writer",
          description: "Drafts content",
          modelProvider: "anthropic",
          modelId: "claude-sonnet-4",
          tools: ["file_write"],
          priority: 4,
        },
        status: "idle",
        canHandoffTo: ["orchestrator", "scheduler"],
      },
    },
    {
      id: "scheduler",
      type: "swarm-node",
      position: { x: 600, y: 220 },
      data: {
        type: "swarm-node",
        agent: {
          id: "scheduler",
          name: "Scheduler",
          description: "Manages timelines",
          modelProvider: "bedrock",
          modelId: "claude-sonnet-4",
          tools: ["calendar_api"],
          priority: 3,
        },
        status: "idle",
        canHandoffTo: ["orchestrator", "writer"],
      },
    },
  ]

  // Simplified edges - only show primary handoff paths (outward from orchestrator, lateral between workers)
  // This creates a cleaner visual hierarchy without the messy back-and-forth
  const edges: StrandsSwarmEdge[] = [
    // From orchestrator to workers (downward flow)
    { id: "e1", source: "orchestrator", target: "analyst", type: "swarm-edge", data: { type: "swarm-edge", isActive: false } },
    { id: "e2", source: "orchestrator", target: "writer", type: "swarm-edge", data: { type: "swarm-edge", isActive: false } },
    { id: "e3", source: "orchestrator", target: "scheduler", type: "swarm-edge", data: { type: "swarm-edge", isActive: false } },
    // Lateral flow between workers (left to right)
    { id: "e4", source: "analyst", target: "writer", type: "swarm-edge", data: { type: "swarm-edge", isActive: false } },
    { id: "e5", source: "writer", target: "scheduler", type: "swarm-edge", data: { type: "swarm-edge", isActive: false } },
  ]

  return {
    id: `swarm_${task.id}`,
    status: "created",
    currentNode: null,
    nodes,
    edges,
    nodeHistory: [],
    handoffs: [],
    sharedContext: {
      orchestrator: {
        taskId: task.id,
        title: task.title.length > 40 ? task.title.slice(0, 40) + '...' : task.title,
      },
    },
    maxHandoffs: 8,
    handoffCount: 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function RonTab({ task }: RonTabProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedContexts, setSelectedContexts] = useState<ContextItem[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const swarmState = useMemo(() => createTaskSwarmState(task), [task])
  const isEmpty = messages.length === 0

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback((text?: string) => {
    const messageText = text || input.trim()
    if (!messageText) return

    // Check for orchestration trigger - will attach orchestration to response
    const shouldShowOrchestration = 
      messageText.toLowerCase().includes('orchestration') || 
      messageText.toLowerCase().includes('agent')

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // Simulate response with optional orchestration
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
        reasoning: 'Analyzing...',
        isReasoningComplete: false,
        orchestration: shouldShowOrchestration ? swarmState : undefined,
      }
      setMessages(prev => [...prev, assistantMessage])
      simulateStreaming(assistantMessage.id, messageText)
    }, 400)
  }, [input, swarmState])

  const simulateStreaming = async (messageId: string, query: string) => {
    await new Promise(r => setTimeout(r, 800))
    
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, reasoning: 'Ready.', isReasoningComplete: true } : m
    ))

    const response = generateResponse(query, task)
    const words = response.split(' ')

    for (let i = 0; i < words.length; i++) {
      await new Promise(r => setTimeout(r, 20 + Math.random() * 25))
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, content: words.slice(0, i + 1).join(' ') } : m
      ))
    }

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, isStreaming: false } : m
    ))
    setIsTyping(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
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

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col gap-3", isUser ? "items-end" : "items-start")}
    >
      <div className={cn("max-w-[80%]", isUser ? "order-2" : "order-1")}>
        {/* Reasoning */}
        {!isUser && message.reasoning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-2 flex items-center gap-2"
          >
            {!message.isReasoningComplete && (
              <motion.div
                className="w-1 h-1 rounded-full bg-ink-muted dark:bg-ink-inverse-muted"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <span className="text-body-xs text-ink-muted/60 dark:text-ink-inverse-muted/60 italic">
              {message.reasoning}
            </span>
          </motion.div>
        )}
        
        {/* Content - Using ResponseMarkdown for proper streaming and markdown */}
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
      </div>

      {/* Inline Orchestration Accordion - Shows within the chat flow using Task component */}
      {!isUser && message.orchestration && !message.isStreaming && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <OrchestrationTaskAccordion state={message.orchestration} />
        </motion.div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATION TASK ACCORDION - Uses CollapsibleTask from task.tsx
// ─────────────────────────────────────────────────────────────────────────────

function OrchestrationTaskAccordion({ state }: { state: SwarmState }) {
  // Map swarm status to TaskStatus
  const getTaskStatus = (): TaskStatus => {
    switch (state.status) {
      case 'running': return 'running'
      case 'completed': return 'success'
      case 'error': return 'error'
      case 'created': return 'pending'
      default: return 'pending'
    }
  }

  return (
    <CollapsibleTask
      title="Agent Orchestration"
      description={`${state.nodes.length} agents • ${state.handoffCount} handoffs`}
      status={getTaskStatus()}
      defaultExpanded={false}
    >
      {/* The actual React Flow canvas with nodes and edges */}
      <div className="h-[300px] w-full rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
        <StrandsSwarm
          initialState={state}
          onEvent={() => {}}
          showHistory={false}
          showStats={false}
          showContext={false}
          showControls={false}
        />
      </div>
    </CollapsibleTask>
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
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function generateResponse(query: string, task: FullTask): string {
  const q = query.toLowerCase()
  
  if (q.includes('summar')) {
    return `**${task.title}**\n\nStatus: ${task.status} • Priority: ${task.priority || 'Normal'}\n\n${task.subtasks?.length || 0} subtasks, ${task.subtasks?.filter(s => s.completed).length || 0} completed.`
  }
  
  if (q.includes('update') || q.includes('draft')) {
    return `Here's a status update:\n\n"${task.title}" is currently ${task.status}. We've completed ${task.subtasks?.filter(s => s.completed).length || 0} of ${task.subtasks?.length || 0} subtasks. The team is making steady progress."`
  }
  
  if (q.includes('next') || q.includes('step')) {
    return `For "${task.title}", I recommend:\n\n1. Review remaining subtasks\n2. Address any blockers\n3. Update stakeholders on progress`
  }
  
  if (q.includes('orchestration') || q.includes('agent')) {
    return `I've activated the agent orchestration view. You can see how multiple specialized agents collaborate on your task:\n\n• **Ron** - Orchestrates the workflow\n• **Analyst** - Analyzes requirements\n• **Writer** - Drafts content\n• **Scheduler** - Manages timelines\n\nClick "Agents" above to see the visualization.`
  }
  
  return `I understand you're asking about "${task.title}". How can I help further?`
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
