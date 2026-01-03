"use strict";
const electron = require("electron");
const electronAPI = {
  // ----------------------------------------
  // Window Controls
  // ----------------------------------------
  minimizeWindow: () => electron.ipcRenderer.send("window-minimize"),
  maximizeWindow: () => electron.ipcRenderer.send("window-maximize"),
  closeWindow: () => electron.ipcRenderer.send("window-close"),
  // ----------------------------------------
  // Theme Management
  // ----------------------------------------
  getTheme: () => electron.ipcRenderer.invoke("get-theme"),
  setTheme: (theme) => electron.ipcRenderer.invoke("set-theme", theme),
  // ----------------------------------------
  // Authentication
  // ----------------------------------------
  auth: {
    storeTokens: (tokens) => electron.ipcRenderer.invoke("auth:store-tokens", tokens),
    getTokens: () => electron.ipcRenderer.invoke("auth:get-tokens"),
    clearTokens: () => electron.ipcRenderer.invoke("auth:clear-tokens"),
    isEncryptionAvailable: () => electron.ipcRenderer.invoke("auth:is-encryption-available")
  },
  // ----------------------------------------
  // Agent Streaming
  // ----------------------------------------
  agent: {
    startStream: (streamId, request) => electron.ipcRenderer.invoke("agent:start-stream", streamId, request),
    abortStream: (streamId) => electron.ipcRenderer.invoke("agent:abort-stream", streamId),
    abortAllStreams: () => electron.ipcRenderer.invoke("agent:abort-all-streams"),
    // Event listeners
    onStreamEvent: (callback) => {
      const handler = (_, streamId, event) => callback(streamId, event);
      electron.ipcRenderer.on("agent:stream-event", handler);
      return () => electron.ipcRenderer.removeListener("agent:stream-event", handler);
    },
    onStreamConnected: (callback) => {
      const handler = (_, streamId) => callback(streamId);
      electron.ipcRenderer.on("agent:stream-connected", handler);
      return () => electron.ipcRenderer.removeListener("agent:stream-connected", handler);
    },
    onStreamComplete: (callback) => {
      const handler = (_, streamId) => callback(streamId);
      electron.ipcRenderer.on("agent:stream-complete", handler);
      return () => electron.ipcRenderer.removeListener("agent:stream-complete", handler);
    },
    onStreamError: (callback) => {
      const handler = (_, streamId, error) => callback(streamId, error);
      electron.ipcRenderer.on("agent:stream-error", handler);
      return () => electron.ipcRenderer.removeListener("agent:stream-error", handler);
    },
    onStreamAborted: (callback) => {
      const handler = (_, streamId) => callback(streamId);
      electron.ipcRenderer.on("agent:stream-aborted", handler);
      return () => electron.ipcRenderer.removeListener("agent:stream-aborted", handler);
    }
  },
  // ----------------------------------------
  // Voice Agent
  // ----------------------------------------
  voiceAgent: {
    start: (apiKey) => electron.ipcRenderer.invoke("voice-agent:start", apiKey),
    stop: () => electron.ipcRenderer.invoke("voice-agent:stop"),
    // Event listeners
    onEvent: (callback) => {
      const handler = (_, event) => callback(event);
      electron.ipcRenderer.on("voice-agent:event", handler);
      return () => electron.ipcRenderer.removeListener("voice-agent:event", handler);
    },
    onOutput: (callback) => {
      const handler = (_, output) => callback(output);
      electron.ipcRenderer.on("voice-agent:output", handler);
      return () => electron.ipcRenderer.removeListener("voice-agent:output", handler);
    },
    onError: (callback) => {
      const handler = (_, error) => callback(error);
      electron.ipcRenderer.on("voice-agent:error", handler);
      return () => electron.ipcRenderer.removeListener("voice-agent:error", handler);
    },
    onStopped: (callback) => {
      const handler = (_, data) => callback(data);
      electron.ipcRenderer.on("voice-agent:stopped", handler);
      return () => electron.ipcRenderer.removeListener("voice-agent:stopped", handler);
    }
  },
  // ----------------------------------------
  // Browser Agent (CDP-based, Electron-only)
  // ----------------------------------------
  browserAgent: {
    // Start browser agent process
    start: () => electron.ipcRenderer.invoke("browser-agent:start"),
    // Stop browser agent process
    stop: () => electron.ipcRenderer.invoke("browser-agent:stop"),
    // Send a message to agent (task or action)
    send: (message) => electron.ipcRenderer.invoke("browser-agent:send", message),
    // Get CDP port info
    getCdpPort: () => electron.ipcRenderer.invoke("browser-agent:get-cdp-port"),
    // Event listeners for streaming
    onEvent: (callback) => {
      const handler = (_, event) => callback(event);
      electron.ipcRenderer.on("browser-agent:event", handler);
      return () => electron.ipcRenderer.removeListener("browser-agent:event", handler);
    },
    onOutput: (callback) => {
      const handler = (_, output) => callback(output);
      electron.ipcRenderer.on("browser-agent:output", handler);
      return () => electron.ipcRenderer.removeListener("browser-agent:output", handler);
    },
    onError: (callback) => {
      const handler = (_, error) => callback(error);
      electron.ipcRenderer.on("browser-agent:error", handler);
      return () => electron.ipcRenderer.removeListener("browser-agent:error", handler);
    },
    onStopped: (callback) => {
      const handler = (_, data) => callback(data);
      electron.ipcRenderer.on("browser-agent:stopped", handler);
      return () => electron.ipcRenderer.removeListener("browser-agent:stopped", handler);
    }
  },
  // ----------------------------------------
  // Browser Navigation
  // ----------------------------------------
  browser: {
    navigate: (url) => electron.ipcRenderer.invoke("browser:navigate", url),
    search: (query) => electron.ipcRenderer.invoke("browser:search", query),
    goBack: () => electron.ipcRenderer.invoke("browser:go-back"),
    goForward: () => electron.ipcRenderer.invoke("browser:go-forward"),
    reload: () => electron.ipcRenderer.invoke("browser:reload"),
    getUrl: () => electron.ipcRenderer.invoke("browser:get-url"),
    canGoBack: () => electron.ipcRenderer.invoke("browser:can-go-back"),
    canGoForward: () => electron.ipcRenderer.invoke("browser:can-go-forward"),
    setPanelOpen: (isOpen) => electron.ipcRenderer.invoke("browser:set-panel-open", isOpen),
    // Event listeners for browser state
    onUrlChanged: (callback) => {
      const handler = (_, url) => callback(url);
      electron.ipcRenderer.on("browser:url-changed", handler);
      return () => electron.ipcRenderer.removeListener("browser:url-changed", handler);
    },
    onNavigationComplete: (callback) => {
      const handler = (_, url) => callback(url);
      electron.ipcRenderer.on("browser:navigation-complete", handler);
      return () => electron.ipcRenderer.removeListener("browser:navigation-complete", handler);
    },
    onNavigationError: (callback) => {
      const handler = (_, error) => callback(error);
      electron.ipcRenderer.on("browser:navigation-error", handler);
      return () => electron.ipcRenderer.removeListener("browser:navigation-error", handler);
    },
    onExternalMode: (callback) => {
      const handler = (_, isExternal) => callback(isExternal);
      electron.ipcRenderer.on("browser:external-mode", handler);
      return () => electron.ipcRenderer.removeListener("browser:external-mode", handler);
    },
    onAskRon: (callback) => {
      const handler = (_, data) => callback(data);
      electron.ipcRenderer.on("agent:ask-ron", handler);
      return () => electron.ipcRenderer.removeListener("agent:ask-ron", handler);
    }
  },
  // ----------------------------------------
  // Tab Management
  // ----------------------------------------
  tabs: {
    // Optional second arg is clientTabId to keep UI/Main IDs in sync
    create: (url, clientTabId) => electron.ipcRenderer.invoke("create-tab", url, clientTabId),
    close: (tabId) => electron.ipcRenderer.invoke("close-tab", tabId),
    switch: (tabId) => electron.ipcRenderer.invoke("switch-tab", tabId),
    list: () => electron.ipcRenderer.invoke("tabs:list"),
    getContext: (tabId) => electron.ipcRenderer.invoke("tabs:get-context", tabId),
    onUpdated: (callback) => {
      const handler = (_, tabs) => callback(tabs);
      electron.ipcRenderer.on("tabs:updated", handler);
      return () => electron.ipcRenderer.removeListener("tabs:updated", handler);
    }
  },
  // ----------------------------------------
  // Navigation (Future)
  // ----------------------------------------
  navigation: {
    navigate: (url) => electron.ipcRenderer.invoke("navigate", url),
    goBack: () => electron.ipcRenderer.invoke("go-back"),
    goForward: () => electron.ipcRenderer.invoke("go-forward"),
    reload: () => electron.ipcRenderer.invoke("reload")
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", electronAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
}
