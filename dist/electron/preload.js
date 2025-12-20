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
  // Tab Management (Future)
  // ----------------------------------------
  tabs: {
    create: (url) => electron.ipcRenderer.invoke("create-tab", url),
    close: (tabId) => electron.ipcRenderer.invoke("close-tab", tabId),
    switch: (tabId) => electron.ipcRenderer.invoke("switch-tab", tabId)
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
