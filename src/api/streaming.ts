/**
 * SSE Streaming Client
 * 
 * Handles Server-Sent Events (SSE) for real-time AI agent communication.
 * Compatible with Strands Agent Framework streaming patterns.
 */

import { API_BASE_URL, API_ENDPOINTS, type ApiError } from '@/types/api'
import type { AgentStreamEvent, ChatRequest } from '@/types/agent'
import { getAccessToken } from './supabase'

// ============================================
// Streaming Configuration
// ============================================

interface StreamConfig {
  baseUrl: string
  timeout: number
  reconnectAttempts: number
  reconnectDelay: number
}

const defaultStreamConfig: StreamConfig = {
  baseUrl: API_BASE_URL,
  timeout: 120000, // 2 minutes for long-running agent tasks
  reconnectAttempts: 3,
  reconnectDelay: 1000,
}

// ============================================
// Stream Event Types
// ============================================

export interface StreamCallbacks {
  onEvent: (event: AgentStreamEvent) => void
  onError?: (error: ApiError) => void
  onComplete?: () => void
  onConnectionChange?: (connected: boolean) => void
}

export interface StreamController {
  abort: () => void
  isActive: () => boolean
}

// ============================================
// SSE Stream Class
// ============================================

class AgentStreamClient {
  private config: StreamConfig
  private activeController: AbortController | null = null

  constructor(config: Partial<StreamConfig> = {}) {
    this.config = { ...defaultStreamConfig, ...config }
  }

  /**
   * Start a streaming chat request
   */
  async chat(request: ChatRequest, callbacks: StreamCallbacks): Promise<StreamController> {
    // Abort any existing stream
    this.abort()

    const controller = new AbortController()
    this.activeController = controller

    // Start the stream in the background
    this.executeStream(request, callbacks, controller).catch((error) => {
      if (error.name !== 'AbortError') {
        callbacks.onError?.({
          code: 'STREAM_ERROR',
          message: error.message || 'Stream failed',
          status: 0,
        })
      }
    })

    return {
      abort: () => this.abort(),
      isActive: () => this.activeController === controller && !controller.signal.aborted,
    }
  }

  /**
   * Execute the SSE stream
   */
  private async executeStream(
    request: ChatRequest,
    callbacks: StreamCallbacks,
    controller: AbortController
  ): Promise<void> {
    const token = await getAccessToken()
    
    const url = `${this.config.baseUrl}${API_ENDPOINTS.agent.stream}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        prompt: request.prompt,
        conversation_id: request.conversationId,
        system_prompt: request.systemPrompt,
        context: request.context,
        model: request.model,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('Response body is null')
    }

    callbacks.onConnectionChange?.(true)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            this.processSSELine(buffer, callbacks)
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        
        // Process complete SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          this.processSSELine(line, callbacks)
        }
      }

      callbacks.onComplete?.()
    } finally {
      callbacks.onConnectionChange?.(false)
      reader.releaseLock()
    }
  }

  /**
   * Process a single SSE line
   */
  private processSSELine(line: string, callbacks: StreamCallbacks): void {
    const trimmedLine = line.trim()
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith(':')) {
      return
    }

    // Parse SSE data field
    if (trimmedLine.startsWith('data:')) {
      const data = trimmedLine.slice(5).trim()
      
      // Handle [DONE] marker
      if (data === '[DONE]') {
        return
      }

      try {
        const event = JSON.parse(data) as AgentStreamEvent
        callbacks.onEvent(event)
      } catch (error) {
        // If it's not JSON, treat it as plain text data
        callbacks.onEvent({ data })
      }
    }
    
    // Handle event type field (optional in our implementation)
    if (trimmedLine.startsWith('event:')) {
      // Event type handling can be added here if needed
    }
  }

  /**
   * Abort the current stream
   */
  abort(): void {
    if (this.activeController) {
      this.activeController.abort()
      this.activeController = null
    }
  }

  /**
   * Check if a stream is currently active
   */
  isActive(): boolean {
    return this.activeController !== null && !this.activeController.signal.aborted
  }
}

// ============================================
// Singleton Export
// ============================================

export const streamClient = new AgentStreamClient()

// ============================================
// Convenience Functions
// ============================================

/**
 * Start a streaming chat session
 */
export function startAgentStream(
  request: ChatRequest,
  callbacks: StreamCallbacks
): StreamController {
  return streamClient.chat(request, callbacks) as unknown as StreamController
}

/**
 * Abort any active stream
 */
export function abortStream(): void {
  streamClient.abort()
}

/**
 * Check if a stream is currently active
 */
export function isStreamActive(): boolean {
  return streamClient.isActive()
}

// ============================================
// Stream Event Helpers
// ============================================

/**
 * Extract text content from a stream event
 */
export function extractTextFromEvent(event: AgentStreamEvent): string | null {
  if (event.data) {
    return event.data
  }
  if (event.reasoningText) {
    return event.reasoningText
  }
  if (event.result?.message?.content) {
    const textContent = event.result.message.content.find(c => c.text)
    return textContent?.text ?? null
  }
  return null
}

/**
 * Check if event indicates completion
 */
export function isCompletionEvent(event: AgentStreamEvent): boolean {
  return event.complete === true || event.result !== undefined
}

/**
 * Check if event indicates an error or force stop
 */
export function isErrorEvent(event: AgentStreamEvent): boolean {
  return event.force_stop === true
}

/**
 * Extract tool use from event
 */
export function extractToolUse(event: AgentStreamEvent): { name: string; id?: string } | null {
  const toolUse = event.current_tool_use
  if (toolUse?.name) {
    return { name: toolUse.name, id: toolUse.id }
  }
  return null
}

