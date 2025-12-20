/**
 * Electron Bridge for Voice Onboarding Agent
 *
 * Spawns the Python voice onboarding agent as a subprocess and
 * communicates with it to integrate with the Electron app's state.
 */
import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'

interface OnboardingAnswer {
  question: string
  answer: string
  timestamp: number
}

interface OnboardingResult {
  current_question_index: number
  answers: OnboardingAnswer[]
  is_complete: boolean
}

interface VoiceAgentEvents {
  started: () => void
  transcript: (role: 'user' | 'assistant', text: string) => void
  answer_recorded: (answer: OnboardingAnswer) => void
  completed: (result: OnboardingResult) => void
  error: (error: Error) => void
  stopped: () => void
}

export class VoiceOnboardingAgent extends EventEmitter {
  private process: ChildProcess | null = null
  private buffer: string = ''
  private pythonPath: string
  private agentScriptPath: string
  private isRunning: boolean = false

  constructor(
    pythonPath: string = 'python',
    agentDir: string = path.join(__dirname)
  ) {
    super()
    this.pythonPath = pythonPath
    this.agentScriptPath = path.join(agentDir, 'agent.py')
  }

  /**
   * Start the voice onboarding agent
   */
  async start(apiKey?: string): Promise<void> {
    if (this.isRunning) {
      throw new Error('Voice agent is already running')
    }

    const env = { ...process.env }
    if (apiKey) {
      env.GOOGLE_API_KEY = apiKey
      env.GEMINI_API_KEY = apiKey
    }

    if (!env.GOOGLE_API_KEY && !env.GEMINI_API_KEY) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY must be provided or set in environment')
    }

    this.process = spawn(this.pythonPath, [this.agentScriptPath], {
      env,
      cwd: path.dirname(this.agentScriptPath)
    })

    this.isRunning = true
    this.setupProcessHandlers()
    this.emit('started')
  }

  /**
   * Stop the voice onboarding agent
   */
  stop(): void {
    if (this.process && this.isRunning) {
      this.process.kill('SIGTERM')
      this.isRunning = false
      this.emit('stopped')
    }
  }

  /**
   * Check if the agent is currently running
   */
  get running(): boolean {
    return this.isRunning
  }

  /**
   * Setup handlers for the Python subprocess
   */
  private setupProcessHandlers(): void {
    if (!this.process) return

    // Handle stdout (agent output and transcripts)
    this.process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      this.buffer += output

      // Parse line by line
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() || '' // Keep incomplete line in buffer

      lines.forEach((line) => {
        this.parseAgentOutput(line)
      })
    })

    // Handle stderr (errors and debug logs)
    this.process.stderr?.on('data', (data: Buffer) => {
      const error = data.toString()
      console.error('[Voice Agent Error]', error)
    })

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.isRunning = false

      if (code === 0) {
        this.emit('stopped')
      } else {
        this.emit(
          'error',
          new Error(`Voice agent exited with code ${code}, signal ${signal}`)
        )
      }
    })

    // Handle process errors
    this.process.on('error', (error) => {
      this.isRunning = false
      this.emit('error', error)
    })
  }

  /**
   * Parse and handle agent output
   */
  private parseAgentOutput(line: string): void {
    line = line.trim()
    if (!line) return

    try {
      // Try to parse as JSON (for structured data)
      if (line.startsWith('{') || line.startsWith('[')) {
        const data = JSON.parse(line)

        // Check if it's the final summary
        if (data.answers && Array.isArray(data.answers)) {
          this.emit('completed', data as OnboardingResult)
          return
        }

        // Check if it's a transcript event
        if (data.type === 'bidi_transcript_stream' && data.is_final) {
          this.emit('transcript', data.role, data.text)
          return
        }
      }

      // Parse text output patterns
      if (line.includes(': ')) {
        const [role, ...textParts] = line.split(': ')
        const text = textParts.join(': ')

        if (role === 'user' || role === 'assistant') {
          this.emit('transcript', role as 'user' | 'assistant', text)
        }
      }
    } catch (error) {
      // Not JSON or structured data - just log it
      console.log('[Voice Agent]', line)
    }
  }
}

// Export types
export type { OnboardingAnswer, OnboardingResult, VoiceAgentEvents }
