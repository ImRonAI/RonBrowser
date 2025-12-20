/**
 * HTTP Client for Voice Onboarding Agent Server
 *
 * Communicates with the Python FastAPI server running on localhost:8765
 */

export interface OnboardingAnswer {
  question: string
  answer: string
  timestamp: number
}

export interface OnboardingData {
  current_question_index: number
  answers: OnboardingAnswer[]
  is_complete: boolean
}

export interface AgentHealth {
  status: string
  agent_running: boolean
  api_key_configured: boolean
  environment: string
}

export class VoiceAgentClient {
  private baseUrl: string

  constructor(baseUrl: string = 'http://127.0.0.1:8765') {
    this.baseUrl = baseUrl
  }

  /**
   * Check if the agent server is running
   */
  async health(): Promise<AgentHealth> {
    const response = await fetch(`${this.baseUrl}/health`)
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`)
    }
    return response.json()
  }

  /**
   * Start the voice agent
   */
  async startAgent(apiKey?: string): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/agent/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ api_key: apiKey }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to start agent')
    }

    return response.json()
  }

  /**
   * Stop the voice agent
   */
  async stopAgent(): Promise<{ status: string; onboarding_data?: OnboardingData }> {
    const response = await fetch(`${this.baseUrl}/agent/stop`, {
      method: 'POST',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to stop agent')
    }

    return response.json()
  }

  /**
   * Get agent status
   */
  async getStatus(): Promise<{ running: boolean; has_data: boolean }> {
    const response = await fetch(`${this.baseUrl}/agent/status`)
    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`)
    }
    return response.json()
  }

  /**
   * Get collected onboarding data
   */
  async getOnboardingData(): Promise<OnboardingData> {
    const response = await fetch(`${this.baseUrl}/onboarding/data`)
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No onboarding data available')
      }
      throw new Error(`Failed to get data: ${response.statusText}`)
    }
    return response.json()
  }

  /**
   * Clear onboarding data
   */
  async clearOnboardingData(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/onboarding/data`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Failed to clear data: ${response.statusText}`)
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket(callbacks: {
    onOpen?: () => void
    onMessage?: (data: any) => void
    onError?: (error: Event) => void
    onClose?: () => void
  }): WebSocket {
    const ws = new WebSocket(`ws://127.0.0.1:8765/ws/agent`)

    ws.onopen = () => {
      console.log('[Agent Client] WebSocket connected')
      callbacks.onOpen?.()
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        callbacks.onMessage?.(data)
      } catch (error) {
        console.error('[Agent Client] Failed to parse message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('[Agent Client] WebSocket error:', error)
      callbacks.onError?.(error)
    }

    ws.onclose = () => {
      console.log('[Agent Client] WebSocket closed')
      callbacks.onClose?.()
    }

    return ws
  }
}

// Export singleton instance
export const voiceAgentClient = new VoiceAgentClient()
