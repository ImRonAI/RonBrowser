/**
 * Example Usage: Integrating Voice Onboarding Agent with Electron App
 *
 * This example shows how to use the VoiceOnboardingAgent bridge
 * to integrate the Python agent with your Electron application.
 */
import { VoiceOnboardingAgent } from './electron_bridge'
import { useOnboardingStore } from '@/stores/onboardingStore'

/**
 * Example 1: Basic Usage
 *
 * Start the agent and handle events
 */
export async function basicExample() {
  const agent = new VoiceOnboardingAgent()

  // Listen for events
  agent.on('started', () => {
    console.log('🎤 Voice agent started')
  })

  agent.on('transcript', (role, text) => {
    console.log(`${role}: ${text}`)
  })

  agent.on('completed', (result) => {
    console.log('✅ Onboarding completed!', result)
  })

  agent.on('error', (error) => {
    console.error('❌ Error:', error)
  })

  agent.on('stopped', () => {
    console.log('🛑 Voice agent stopped')
  })

  // Start the agent
  const apiKey = process.env.GOOGLE_API_KEY
  await agent.start(apiKey)

  // To stop the agent
  // agent.stop()
}

/**
 * Example 2: Integration with Onboarding Store
 *
 * Connect the agent to Zustand store for state persistence
 */
export async function storeIntegrationExample() {
  const agent = new VoiceOnboardingAgent()
  const store = useOnboardingStore.getState()

  // Set mode to 'talk' when starting voice onboarding
  store.setMode('talk')

  // Listen for transcripts and update UI
  agent.on('transcript', (role, text) => {
    // You could update a real-time transcript display here
    console.log(`${role}: ${text}`)
  })

  // Save answers to the store as they're recorded
  agent.on('answer_recorded', (answer) => {
    store.setAnswer(answer.question, answer.answer)
  })

  // Handle completion
  agent.on('completed', (result) => {
    // Save all answers to store
    result.answers.forEach(({ question, answer }) => {
      store.setAnswer(question, answer)
    })

    // Move to next onboarding step
    store.nextStep()
  })

  // Handle errors
  agent.on('error', (error) => {
    console.error('Voice agent error:', error)
    // Optionally fall back to text-based onboarding
    store.setMode('type')
  })

  // Start the agent
  try {
    await agent.start()
  } catch (error) {
    console.error('Failed to start voice agent:', error)
    store.setMode('type') // Fallback to text mode
  }
}

/**
 * Example 3: React Component Integration
 *
 * Example React component that manages the voice agent
 */
export function VoiceOnboardingComponent() {
  const [agent, setAgent] = React.useState<VoiceOnboardingAgent | null>(null)
  const [isActive, setIsActive] = React.useState(false)
  const [transcripts, setTranscripts] = React.useState<
    Array<{ role: string; text: string }>
  >([])
  const store = useOnboardingStore()

  const startVoiceOnboarding = async () => {
    const newAgent = new VoiceOnboardingAgent()

    // Setup event handlers
    newAgent.on('started', () => {
      setIsActive(true)
      store.setMode('talk')
    })

    newAgent.on('transcript', (role, text) => {
      setTranscripts((prev) => [...prev, { role, text }])
    })

    newAgent.on('completed', (result) => {
      result.answers.forEach(({ question, answer }) => {
        store.setAnswer(question, answer)
      })
      store.nextStep()
      setIsActive(false)
    })

    newAgent.on('error', (error) => {
      console.error('Voice agent error:', error)
      setIsActive(false)
      store.setMode('type') // Fallback
    })

    newAgent.on('stopped', () => {
      setIsActive(false)
    })

    // Start agent
    try {
      await newAgent.start()
      setAgent(newAgent)
    } catch (error) {
      console.error('Failed to start:', error)
      store.setMode('type')
    }
  }

  const stopVoiceOnboarding = () => {
    if (agent) {
      agent.stop()
      setAgent(null)
    }
  }

  return (
    <div className="voice-onboarding">
      <button onClick={startVoiceOnboarding} disabled={isActive}>
        {isActive ? '🎤 Listening...' : 'Start Voice Interview'}
      </button>

      {isActive && (
        <button onClick={stopVoiceOnboarding}>Stop Interview</button>
      )}

      <div className="transcripts">
        {transcripts.map((t, i) => (
          <div key={i} className={`transcript ${t.role}`}>
            <strong>{t.role}:</strong> {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Example 4: Main Process Integration (Electron)
 *
 * Example of how to integrate in Electron main process with IPC
 */
export function setupVoiceOnboardingIPC(ipcMain: any, mainWindow: any) {
  let agent: VoiceOnboardingAgent | null = null

  // Handle start request from renderer
  ipcMain.handle('voice-onboarding:start', async (_event: any, apiKey: string) => {
    if (agent?.running) {
      return { error: 'Agent already running' }
    }

    agent = new VoiceOnboardingAgent()

    // Forward events to renderer
    agent.on('started', () => {
      mainWindow.webContents.send('voice-onboarding:started')
    })

    agent.on('transcript', (role, text) => {
      mainWindow.webContents.send('voice-onboarding:transcript', { role, text })
    })

    agent.on('answer_recorded', (answer) => {
      mainWindow.webContents.send('voice-onboarding:answer', answer)
    })

    agent.on('completed', (result) => {
      mainWindow.webContents.send('voice-onboarding:completed', result)
      agent = null
    })

    agent.on('error', (error) => {
      mainWindow.webContents.send('voice-onboarding:error', error.message)
      agent = null
    })

    agent.on('stopped', () => {
      mainWindow.webContents.send('voice-onboarding:stopped')
      agent = null
    })

    try {
      await agent.start(apiKey)
      return { success: true }
    } catch (error: any) {
      return { error: error.message }
    }
  })

  // Handle stop request from renderer
  ipcMain.handle('voice-onboarding:stop', () => {
    if (agent?.running) {
      agent.stop()
      return { success: true }
    }
    return { error: 'No agent running' }
  })

  // Cleanup on app quit
  return () => {
    if (agent?.running) {
      agent.stop()
    }
  }
}
