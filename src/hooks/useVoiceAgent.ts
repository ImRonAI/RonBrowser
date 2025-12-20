/**
 * Voice Agent Hook
 *
 * Manages the Python voice agent subprocess lifecycle and events.
 * Connects Electron IPC to React state for voice onboarding.
 */
import { useState, useEffect, useCallback } from 'react'

export type VoiceAgentState = 'idle' | 'starting' | 'listening' | 'thinking' | 'speaking' | 'stopped' | 'error'

interface VoiceAgentEvent {
  type: 'state_change' | 'transcript' | 'question' | 'answer_recorded' | 'complete'
  data: Record<string, unknown>
}

interface UseVoiceAgentOptions {
  enabled: boolean
  apiKey?: string
  onComplete?: () => void
  onError?: (error: string) => void
}

interface UseVoiceAgentResult {
  state: VoiceAgentState
  transcript: string
  currentQuestion: string | null
  agentMessage: string
  error: string | null
  start: () => Promise<void>
  stop: () => Promise<void>
}

export function useVoiceAgent({
  enabled,
  apiKey,
  onComplete,
  onError,
}: UseVoiceAgentOptions): UseVoiceAgentResult {
  const [state, setState] = useState<VoiceAgentState>('idle')
  const [transcript, setTranscript] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null)
  const [agentMessage, setAgentMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Start the voice agent
  const start = useCallback(async () => {
    if (!window.electron?.voiceAgent) {
      const errorMsg = 'Voice agent API not available'
      setError(errorMsg)
      setState('error')
      onError?.(errorMsg)
      return
    }

    try {
      setState('starting')
      const result = await window.electron.voiceAgent.start(apiKey)

      if (!result.success) {
        const errorMsg = result.error || 'Failed to start voice agent'
        setError(errorMsg)
        setState('error')
        onError?.(errorMsg)
        return
      }

      setState('listening')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error starting voice agent'
      setError(errorMsg)
      setState('error')
      onError?.(errorMsg)
    }
  }, [apiKey, onError])

  // Stop the voice agent
  const stop = useCallback(async () => {
    if (!window.electron?.voiceAgent) return

    try {
      await window.electron.voiceAgent.stop()
      setState('stopped')
    } catch (err) {
      console.error('Failed to stop voice agent:', err)
    }
  }, [])

  // Start agent when enabled changes to true
  useEffect(() => {
    if (!enabled || !window.electron?.voiceAgent) return

    // Start agent when enabled
    start()

    // Cleanup: stop when disabled
    return () => {
      stop()
    }
    // Only run when enabled changes, not when start/stop change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Handle agent events (separate effect to avoid restart loops)
  useEffect(() => {
    if (!enabled || !window.electron?.voiceAgent) return

    // Listen for structured events
    const removeEventListener = window.electron.voiceAgent.onEvent((event) => {
      const agentEvent = event as VoiceAgentEvent

      switch (agentEvent.type) {
        case 'state_change':
          setState(agentEvent.data.state as VoiceAgentState)
          break

        case 'transcript':
          if (agentEvent.data.role === 'user') {
            setTranscript(agentEvent.data.text as string)
          } else if (agentEvent.data.role === 'assistant') {
            setAgentMessage(agentEvent.data.text as string)
          }
          break

        case 'question':
          setCurrentQuestion(agentEvent.data.question as string)
          setAgentMessage(agentEvent.data.question as string)
          break

        case 'answer_recorded':
          // User's answer was recorded, clear transcript
          setTranscript('')
          break

        case 'complete':
          setState('stopped')
          onComplete?.()
          break
      }
    })

    // Listen for text output
    const removeOutputListener = window.electron.voiceAgent.onOutput((output) => {
      console.log('[Voice Agent]:', output)
    })

    // Listen for errors
    const removeErrorListener = window.electron.voiceAgent.onError((errorMsg) => {
      console.error('[Voice Agent Error]:', errorMsg)
      setError(errorMsg)
      setState('error')
      onError?.(errorMsg)
    })

    // Listen for agent stopped
    const removeStoppedListener = window.electron.voiceAgent.onStopped(({ code }) => {
      console.log(`[Voice Agent] Stopped with code ${code}`)
      setState('stopped')
    })

    // Cleanup listeners only (stop is handled in the other effect)
    return () => {
      removeEventListener()
      removeOutputListener()
      removeErrorListener()
      removeStoppedListener()
    }
  }, [enabled, onComplete, onError])

  return {
    state,
    transcript,
    currentQuestion,
    agentMessage,
    error,
    start,
    stop,
  }
}
