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

    onStopped: (callback: (data: { code: number | null; signal?: NodeJS.Signals | null }) => void) => {
      const handler = (_: unknown, data: { code: number | null; signal?: NodeJS.Signals | null }) => callback(data)
      ipcRenderer.on('voice-agent:stopped', handler)
      return () => ipcRenderer.removeListener('voice-agent:stopped', handler)
    },
  },

  // ----------------------------------------
  // Browser Agent (CDP-based, Electron-only)
  // ----------------------------------------
  browserAgent: {
    // Start browser agent process
    start: () => ipcRenderer.invoke('browser-agent:start'),

    // Stop browser agent process
    stop: () => ipcRenderer.invoke('browser-agent:stop'),

    // Send a message to agent (task or action)
    send: (message: { action?: string; task?: string }) =>
      ipcRenderer.invoke('browser-agent:send', message),

    // Get CDP port info
    getCdpPort: () => ipcRenderer.invoke('browser-agent:get-cdp-port'),

    // Event listeners for streaming
    onEvent: (callback: (event: {
      type: string;
      content: string;
      data?: Record<string, unknown>;
      timestamp?: string;
    }) => void) => {
      const handler = (_: unknown, event: {
        type: string;
        content: string;
        data?: Record<string, unknown>;
        timestamp?: string;
      }) => callback(event)
      ipcRenderer.on('browser-agent:event', handler)
      return () => ipcRenderer.removeListener('browser-agent:event', handler)
    },

    onOutput: (callback: (output: string) => void) => {
      const handler = (_: unknown, output: string) => callback(output)
      ipcRenderer.on('browser-agent:output', handler)
      return () => ipcRenderer.removeListener('browser-agent:output', handler)
    },

    onError: (callback: (error: string) => void) => {
      const handler = (_: unknown, error: string) => callback(error)
      ipcRenderer.on('browser-agent:error', handler)
      return () => ipcRenderer.removeListener('browser-agent:error', handler)
    },

    onStopped: (callback: (data: { code: number | null }) => void) => {
      const handler = (_: unknown, data: { code: number | null }) => callback(data)
      ipcRenderer.on('browser-agent:stopped', handler)
      return () => ipcRenderer.removeListener('browser-agent:stopped', handler)
    },
  },

  // ----------------------------------------
  // Browser Navigation
  // ----------------------------------------
  browser: {
    navigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
    search: (query: string) => ipcRenderer.invoke('browser:search', query),
    goBack: () => ipcRenderer.invoke('browser:go-back'),
    goForward: () => ipcRenderer.invoke('browser:go-forward'),
    reload: () => ipcRenderer.invoke('browser:reload'),
    getUrl: () => ipcRenderer.invoke('browser:get-url'),
    canGoBack: () => ipcRenderer.invoke('browser:can-go-back'),
    canGoForward: () => ipcRenderer.invoke('browser:can-go-forward'),
    setPanelOpen: (isOpen: boolean) => ipcRenderer.invoke('browser:set-panel-open', isOpen),
    
    // Event listeners for browser state
    onUrlChanged: (callback: (url: string) => void) => {
      const handler = (_: unknown, url: string) => callback(url)
      ipcRenderer.on('browser:url-changed', handler)
      return () => ipcRenderer.removeListener('browser:url-changed', handler)
    },
    
    onNavigationComplete: (callback: (url: string) => void) => {
      const handler = (_: unknown, url: string) => callback(url)
      ipcRenderer.on('browser:navigation-complete', handler)
      return () => ipcRenderer.removeListener('browser:navigation-complete', handler)
    },
    
    onNavigationError: (callback: (error: { errorCode: number; errorDescription: string; url: string }) => void) => {
      const handler = (_: unknown, error: { errorCode: number; errorDescription: string; url: string }) => callback(error)
      ipcRenderer.on('browser:navigation-error', handler)
      return () => ipcRenderer.removeListener('browser:navigation-error', handler)
    },

    onExternalMode: (callback: (isExternal: boolean) => void) => {
      const handler = (_: unknown, isExternal: boolean) => callback(isExternal)
      ipcRenderer.on('browser:external-mode', handler)
      return () => ipcRenderer.removeListener('browser:external-mode', handler)
    },

    onAskRon: (callback: (data: { selectionText: string; sourceUrl: string }) => void) => {
      const handler = (_: unknown, data: { selectionText: string; sourceUrl: string }) => callback(data)
      ipcRenderer.on('agent:ask-ron', handler)
      return () => ipcRenderer.removeListener('agent:ask-ron', handler)
    },
  },

  // ----------------------------------------
  // Tab Management
  // ----------------------------------------
  tabs: {
    // Optional second arg is clientTabId to keep UI/Main IDs in sync
    create: (url?: string, clientTabId?: string) => ipcRenderer.invoke('create-tab', url, clientTabId),
    close: (tabId: string) => ipcRenderer.invoke('close-tab', tabId),
    switch: (tabId: string) => ipcRenderer.invoke('switch-tab', tabId),
    list: () => ipcRenderer.invoke('tabs:list') as Promise<Array<{ id: string; url: string; title: string; favicon?: string; isActive: boolean }>>,
    getContext: (tabId: string) => ipcRenderer.invoke('tabs:get-context', tabId) as Promise<{ success: boolean; context?: any; error?: string }>,
    onUpdated: (callback: (tabs: Array<{ id: string; url: string; title: string; favicon?: string; isActive: boolean }>) => void) => {
      const handler = (_: unknown, tabs: Array<{ id: string; url: string; title: string; favicon?: string; isActive: boolean }>) => callback(tabs)
      ipcRenderer.on('tabs:updated', handler)
      return () => ipcRenderer.removeListener('tabs:updated', handler)
    },
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

export type ElectronAPI = typeof electronAPI
