export interface AgentChatDispatch {
  text: string
}

type AgentChatListener = (message: AgentChatDispatch) => void
type AgentPanelOpenListener = () => void

const listeners = new Set<AgentChatListener>()
const pendingQueue: AgentChatDispatch[] = []
const panelOpenListeners = new Set<AgentPanelOpenListener>()
let hasPendingPanelOpenRequest = false

export function enqueueAgentPanelMessage(message: AgentChatDispatch): void {
  const text = message.text?.trim()
  if (!text) return

  const normalized: AgentChatDispatch = { text }
  if (listeners.size === 0) {
    pendingQueue.push(normalized)
    return
  }

  listeners.forEach((listener) => listener(normalized))
}

export function subscribeAgentPanelMessages(listener: AgentChatListener): () => void {
  listeners.add(listener)

  if (pendingQueue.length > 0) {
    const queued = [...pendingQueue]
    pendingQueue.length = 0
    queued.forEach((message) => listener(message))
  }

  return () => {
    listeners.delete(listener)
  }
}

export function requestAgentPanelOpen(): void {
  if (panelOpenListeners.size === 0) {
    hasPendingPanelOpenRequest = true
    return
  }

  panelOpenListeners.forEach((listener) => listener())
}

export function subscribeAgentPanelOpenRequests(listener: AgentPanelOpenListener): () => void {
  panelOpenListeners.add(listener)

  if (hasPendingPanelOpenRequest) {
    hasPendingPanelOpenRequest = false
    listener()
  }

  return () => {
    panelOpenListeners.delete(listener)
  }
}
