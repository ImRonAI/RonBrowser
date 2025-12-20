import { create } from 'zustand'
import { API_BASE_URL, API_ENDPOINTS } from '@/types/api'
import type {
  Message,
  ToolUse,
  Conversation,
  ConversationContext,
  AgentStreamEvent,
  ChatRequest,
} from '@/types/agent'
import { getAccessToken } from '@/api/supabase'

// ============================================
// State Interface
// ============================================

interface AgentState {
  // Panel state
  isPanelOpen: boolean
  interactionMode: 'voice' | 'text'
  
  // Agent state
  isListening: boolean
  isSpeaking: boolean
  isThinking: boolean
  isStreaming: boolean
  
  // Vision state
  isViewingScreen: boolean
  screenshotData: string | null
  
  // Conversation state
  activeConversationId: string | null
  conversations: Record<string, Conversation>
  messages: Message[]
  
  // Streaming state
  currentStreamingMessage: string | null
  currentToolUse: ToolUse | null
  streamId: string | null
  
  // Connection state
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error'
  error: { code: string; message: string } | null

  // Actions - Panel
  togglePanel: () => void
  openPanel: () => void
  closePanel: () => void
  setInteractionMode: (mode: 'voice' | 'text') => void
  
  // Actions - Listening/Speaking
  startListening: () => void
  stopListening: () => void
  startSpeaking: () => void
  stopSpeaking: () => void
  
  // Actions - Thinking/Processing
  startThinking: () => void
  stopThinking: () => void
  
  // Actions - Vision
  startViewingScreen: (screenshotData?: string) => void
  stopViewingScreen: () => void
  
  // Actions - Messages
  addMessage: (role: 'user' | 'assistant', content: string) => void
  updateStreamingMessage: (content: string) => void
  finalizeStreamingMessage: () => void
  clearMessages: () => void
  
  // Actions - Streaming
  sendMessage: (content: string, context?: ConversationContext) => Promise<void>
  abortStream: () => void
  
  // Actions - Error
  setError: (error: { code: string; message: string } | null) => void
  clearError: () => void
}

// ============================================
// Helpers
// ============================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function createMessage(role: 'user' | 'assistant' | 'system', content: string): Message {
  return {
    id: `msg-${generateId()}`,
    role,
    content,
    timestamp: Date.now(),
  }
}

// ============================================
// Store
// ============================================

export const useAgentStore = create<AgentState>((set, get) => {
  // Set up IPC listeners for streaming (Electron)
  if (typeof window !== 'undefined' && window.electron?.agent) {
    const agent = window.electron.agent
    
    agent.onStreamConnected((streamId: string) => {
      if (get().streamId === streamId) {
        set({
          connectionStatus: 'connected',
          isStreaming: true,
          isThinking: false,
        })
      }
    })
    
    agent.onStreamEvent((streamId: string, event: unknown) => {
      if (get().streamId !== streamId) return
      
      const agentEvent = event as AgentStreamEvent
      
      // Handle text data
      if (agentEvent.data) {
        const current = get().currentStreamingMessage || ''
        set({ currentStreamingMessage: current + agentEvent.data })
      }
      
      // Handle reasoning text
      if (agentEvent.reasoningText) {
        // Could show thinking indicator or accumulate reasoning
      }
      
      // Handle tool use
      if (agentEvent.current_tool_use?.name) {
        set({
          currentToolUse: {
            id: agentEvent.current_tool_use.id || generateId(),
            name: agentEvent.current_tool_use.name,
            input: agentEvent.current_tool_use.input,
            status: 'running',
          }
        })
      }
      
      // Handle completion
      if (agentEvent.complete || agentEvent.result) {
        get().finalizeStreamingMessage()
      }
      
      // Handle force stop / error
      if (agentEvent.force_stop) {
        set({
          isStreaming: false,
          error: {
            code: 'FORCE_STOP',
            message: agentEvent.force_stop_reason || 'Stream was stopped',
          }
        })
      }
    })
    
    agent.onStreamComplete((streamId: string) => {
      if (get().streamId === streamId) {
        get().finalizeStreamingMessage()
        set({
          isStreaming: false,
          streamId: null,
          connectionStatus: 'disconnected',
        })
      }
    })
    
    agent.onStreamError((streamId: string, error: { code: string; message: string }) => {
      if (get().streamId === streamId) {
        set({
          isStreaming: false,
          streamId: null,
          connectionStatus: 'error',
          error,
        })
      }
    })
    
    agent.onStreamAborted((streamId: string) => {
      if (get().streamId === streamId) {
        set({
          isStreaming: false,
          streamId: null,
          connectionStatus: 'disconnected',
        })
      }
    })
  }
  
  return {
    // Initial state
  isPanelOpen: false,
  interactionMode: 'text',
  isListening: false,
  isSpeaking: false,
  isThinking: false,
    isStreaming: false,
  isViewingScreen: false,
  screenshotData: null,
    activeConversationId: null,
    conversations: {},
  messages: [],
  currentStreamingMessage: null,
    currentToolUse: null,
    streamId: null,
    connectionStatus: 'disconnected',
    error: null,

    // ----------------------------------------
    // Panel Actions
    // ----------------------------------------
  togglePanel: () => {
    set(state => ({ isPanelOpen: !state.isPanelOpen }))
  },

  openPanel: () => {
    set({ isPanelOpen: true })
  },

  closePanel: () => {
    set({ isPanelOpen: false })
  },

  setInteractionMode: (mode: 'voice' | 'text') => {
    set({
      interactionMode: mode,
      isListening: false,
        isSpeaking: false,
    })
  },

    // ----------------------------------------
    // Listening/Speaking Actions
    // ----------------------------------------
  startListening: () => {
    set({
      isListening: true,
      isSpeaking: false,
        isThinking: false,
    })
  },

  stopListening: () => {
    set({ isListening: false })
  },

  startSpeaking: () => {
    set({
      isSpeaking: true,
      isListening: false,
        isThinking: false,
    })
  },

  stopSpeaking: () => {
    set({ isSpeaking: false })
  },

    // ----------------------------------------
    // Thinking/Processing Actions
    // ----------------------------------------
  startThinking: () => {
    set({
      isThinking: true,
      isListening: false,
        isSpeaking: false,
    })
  },

  stopThinking: () => {
    set({ isThinking: false })
  },

    // ----------------------------------------
    // Vision Actions
    // ----------------------------------------
  startViewingScreen: (screenshotData?: string) => {
    set({
      isViewingScreen: true,
      screenshotData: screenshotData || null,
        isPanelOpen: true,
    })
  },

  stopViewingScreen: () => {
    set({
      isViewingScreen: false,
        screenshotData: null,
    })
  },

    // ----------------------------------------
    // Message Actions
    // ----------------------------------------
  addMessage: (role: 'user' | 'assistant', content: string) => {
      const newMessage = createMessage(role, content)
    set(state => ({
        messages: [...state.messages, newMessage],
    }))
  },

  updateStreamingMessage: (content: string) => {
    set({ currentStreamingMessage: content })
  },

  finalizeStreamingMessage: () => {
    const content = get().currentStreamingMessage
    if (content) {
      get().addMessage('assistant', content)
        set({
          currentStreamingMessage: null,
          currentToolUse: null,
          isStreaming: false,
        })
    }
  },

  clearMessages: () => {
      set({ messages: [], activeConversationId: null })
    },

    // ----------------------------------------
    // Streaming Actions
    // ----------------------------------------
    sendMessage: async (content: string, context?: ConversationContext) => {
      const state = get()
      
      // Add user message immediately
      get().addMessage('user', content)
      
      // Start thinking state
      set({
        isThinking: true,
        connectionStatus: 'connecting',
        error: null,
      })
      
      const streamId = generateId()
      set({ streamId })
      
      try {
        const token = await getAccessToken()
        
        const request: ChatRequest = {
          prompt: content,
          conversationId: state.activeConversationId || undefined,
          context,
          stream: true,
        }
        
        // Check if we're in Electron with IPC streaming
        if (window.electron?.agent) {
          // Use Electron IPC for streaming (routes through main process)
          await window.electron.agent.startStream(streamId, {
            url: `${API_BASE_URL}${API_ENDPOINTS.agent.stream}`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(request),
          })
        } else {
          // Fallback: Direct fetch streaming (for web or testing)
          await streamDirectly(streamId, request, token, get, set)
        }
      } catch (error) {
        console.error('Failed to send message:', error)
        set({
          isThinking: false,
          isStreaming: false,
          connectionStatus: 'error',
          error: {
            code: 'SEND_FAILED',
            message: error instanceof Error ? error.message : 'Failed to send message',
          }
        })
      }
    },

    abortStream: () => {
      const streamId = get().streamId
      if (streamId && window.electron?.agent) {
        window.electron.agent.abortStream(streamId)
      }
      set({
        isStreaming: false,
        isThinking: false,
        streamId: null,
        connectionStatus: 'disconnected',
      })
    },

    // ----------------------------------------
    // Error Actions
    // ----------------------------------------
    setError: (error: { code: string; message: string } | null) => {
      set({ error })
    },

    clearError: () => {
      set({ error: null })
    },
  }
})

// ============================================
// Direct Streaming (Fallback)
// ============================================

async function streamDirectly(
  _streamId: string,
  request: ChatRequest,
  token: string | null,
  get: () => AgentState,
  set: (partial: Partial<AgentState>) => void
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.agent.stream}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('Response body is null')
  }

  set({
    connectionStatus: 'connected',
    isStreaming: true,
    isThinking: false,
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        if (buffer.trim()) {
          processSSELines(buffer, get, set)
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        processSSELine(line, get, set)
      }
    }

    // Finalize
    const content = get().currentStreamingMessage
    if (content) {
      get().finalizeStreamingMessage()
    }
  } finally {
    set({
      isStreaming: false,
      connectionStatus: 'disconnected',
    })
    reader.releaseLock()
  }
}

function processSSELines(buffer: string, get: () => AgentState, set: (partial: Partial<AgentState>) => void): void {
  const lines = buffer.split('\n')
  for (const line of lines) {
    processSSELine(line, get, set)
  }
}

function processSSELine(line: string, get: () => AgentState, set: (partial: Partial<AgentState>) => void): void {
  const trimmedLine = line.trim()
  
  if (!trimmedLine || trimmedLine.startsWith(':')) {
    return
  }

  if (trimmedLine.startsWith('data:')) {
    const data = trimmedLine.slice(5).trim()
    
    if (data === '[DONE]') {
      return
    }

    try {
      const event = JSON.parse(data) as AgentStreamEvent
      
      if (event.data) {
        const current = get().currentStreamingMessage || ''
        set({ currentStreamingMessage: current + event.data })
      }
      
      if (event.current_tool_use?.name) {
        set({
          currentToolUse: {
            id: event.current_tool_use.id || generateId(),
            name: event.current_tool_use.name,
            input: event.current_tool_use.input,
            status: 'running',
          }
        })
      }
      
      if (event.complete || event.result) {
        get().finalizeStreamingMessage()
      }
    } catch {
      // Plain text data
      const current = get().currentStreamingMessage || ''
      set({ currentStreamingMessage: current + data })
    }
  }
}
