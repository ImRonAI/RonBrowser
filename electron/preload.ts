import { contextBridge, ipcRenderer } from 'electron'

// ============================================
// Types
// ============================================

interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface StreamRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: string
}

interface ApiError {
  code: string
  message: string
  status: number
}

// ============================================
// Electron API
// ============================================

const electronAPI = {
  // ----------------------------------------
  // Window Controls
  // ----------------------------------------
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // ----------------------------------------
  // Theme Management
  // ----------------------------------------
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme: 'light' | 'dark' | 'glass' | 'system') => 
    ipcRenderer.invoke('set-theme', theme),

  // ----------------------------------------
  // Authentication
  // ----------------------------------------
  auth: {
    storeTokens: (tokens: StoredTokens) => 
      ipcRenderer.invoke('auth:store-tokens', tokens),
    
    getTokens: (): Promise<StoredTokens | null> => 
      ipcRenderer.invoke('auth:get-tokens'),
    
    clearTokens: () => 
      ipcRenderer.invoke('auth:clear-tokens'),
    
    isEncryptionAvailable: (): Promise<boolean> => 
      ipcRenderer.invoke('auth:is-encryption-available'),
  },

  // ----------------------------------------
  // Agent Streaming
  // ----------------------------------------
  agent: {
    startStream: (streamId: string, request: StreamRequest) =>
      ipcRenderer.invoke('agent:start-stream', streamId, request),
    
    abortStream: (streamId: string) =>
      ipcRenderer.invoke('agent:abort-stream', streamId),
    
    abortAllStreams: () =>
      ipcRenderer.invoke('agent:abort-all-streams'),
    
    // Event listeners
    onStreamEvent: (callback: (streamId: string, event: unknown) => void) => {
      const handler = (_: unknown, streamId: string, event: unknown) => callback(streamId, event)
      ipcRenderer.on('agent:stream-event', handler)
      return () => ipcRenderer.removeListener('agent:stream-event', handler)
    },
    
    onStreamConnected: (callback: (streamId: string) => void) => {
      const handler = (_: unknown, streamId: string) => callback(streamId)
      ipcRenderer.on('agent:stream-connected', handler)
      return () => ipcRenderer.removeListener('agent:stream-connected', handler)
    },
    
    onStreamComplete: (callback: (streamId: string) => void) => {
      const handler = (_: unknown, streamId: string) => callback(streamId)
      ipcRenderer.on('agent:stream-complete', handler)
      return () => ipcRenderer.removeListener('agent:stream-complete', handler)
    },
    
    onStreamError: (callback: (streamId: string, error: ApiError) => void) => {
      const handler = (_: unknown, streamId: string, error: ApiError) => callback(streamId, error)
      ipcRenderer.on('agent:stream-error', handler)
      return () => ipcRenderer.removeListener('agent:stream-error', handler)
    },
    
    onStreamAborted: (callback: (streamId: string) => void) => {
      const handler = (_: unknown, streamId: string) => callback(streamId)
      ipcRenderer.on('agent:stream-aborted', handler)
      return () => ipcRenderer.removeListener('agent:stream-aborted', handler)
    },
  },

  // ----------------------------------------
  // Voice Agent
  // ----------------------------------------
  voiceAgent: {
    start: (apiKey?: string) =>
      ipcRenderer.invoke('voice-agent:start', apiKey),

    stop: () =>
      ipcRenderer.invoke('voice-agent:stop'),

    // Event listeners
    onEvent: (callback: (event: unknown) => void) => {
      const handler = (_: unknown, event: unknown) => callback(event)
      ipcRenderer.on('voice-agent:event', handler)
      return () => ipcRenderer.removeListener('voice-agent:event', handler)
    },

    onOutput: (callback: (output: string) => void) => {
      const handler = (_: unknown, output: string) => callback(output)
      ipcRenderer.on('voice-agent:output', handler)
      return () => ipcRenderer.removeListener('voice-agent:output', handler)
    },

    onError: (callback: (error: string) => void) => {
      const handler = (_: unknown, error: string) => callback(error)
      ipcRenderer.on('voice-agent:error', handler)
      return () => ipcRenderer.removeListener('voice-agent:error', handler)
    },

    onStopped: (callback: (data: { code: number | null }) => void) => {
      const handler = (_: unknown, data: { code: number | null }) => callback(data)
      ipcRenderer.on('voice-agent:stopped', handler)
      return () => ipcRenderer.removeListener('voice-agent:stopped', handler)
    },
  },

  // ----------------------------------------
  // Tab Management (Future)
  // ----------------------------------------
  tabs: {
    create: (url?: string) => ipcRenderer.invoke('create-tab', url),
    close: (tabId: string) => ipcRenderer.invoke('close-tab', tabId),
    switch: (tabId: string) => ipcRenderer.invoke('switch-tab', tabId),
  },

  // ----------------------------------------
  // Navigation (Future)
  // ----------------------------------------
  navigation: {
    navigate: (url: string) => ipcRenderer.invoke('navigate', url),
    goBack: () => ipcRenderer.invoke('go-back'),
    goForward: () => ipcRenderer.invoke('go-forward'),
    reload: () => ipcRenderer.invoke('reload'),
  },
}

// ============================================
// Expose to Renderer
// ============================================

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (global typing)
  window.electron = electronAPI
}

// ============================================
// TypeScript Declarations
// ============================================

declare global {
  interface Window {
    electron: typeof electronAPI
  }
}

export type ElectronAPI = typeof electronAPI
