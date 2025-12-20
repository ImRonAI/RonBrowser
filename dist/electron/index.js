"use strict";
const electron = require("electron");
const node_path = require("node:path");
const node_url = require("node:url");
const node_child_process = require("node:child_process");
const __filename$1 = node_url.fileURLToPath(require("url").pathToFileURL(__filename).href);
const __dirname$1 = node_path.join(__filename$1, "..");
if (process.platform === "win32") electron.app.disableHardwareAcceleration();
if (process.platform === "win32") electron.app.setAppUserModelId(electron.app.getName());
if (!electron.app.requestSingleInstanceLock()) {
  electron.app.quit();
  process.exit(0);
}
let mainWindow = null;
let currentTheme = "light";
let cachedTokens = null;
async function createWindow() {
  mainWindow = new electron.BrowserWindow({
    title: "Ron Browser",
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    // We'll create custom window controls
    titleBarStyle: "hidden",
    // Hide native title bar completely
    transparent: true,
    backgroundColor: "#00000000",
    vibrancy: "sidebar",
    // Frosted glass effect on macOS
    webPreferences: {
      preload: node_path.join(__dirname$1, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(node_path.join(__dirname$1, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(createWindow);
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
electron.ipcMain.on("window-minimize", () => {
  mainWindow?.minimize();
});
electron.ipcMain.on("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow?.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
electron.ipcMain.on("window-close", () => {
  mainWindow?.close();
});
electron.ipcMain.handle("get-theme", () => {
  return currentTheme;
});
electron.ipcMain.handle("set-theme", (_, theme) => {
  currentTheme = theme;
  if (!mainWindow) return theme;
  if (theme === "glass") {
    if (process.platform === "darwin") {
      mainWindow.setVibrancy("sidebar");
      mainWindow.setBackgroundColor("#00000000");
    } else if (process.platform === "win32") {
      mainWindow.setBackgroundMaterial?.("acrylic");
      mainWindow.setBackgroundColor("#00000000");
    } else {
      mainWindow.setBackgroundColor("#00000000");
    }
  } else {
    if (process.platform === "darwin") {
      mainWindow.setVibrancy(null);
    } else if (process.platform === "win32") {
      mainWindow.setBackgroundMaterial?.("none");
    }
    mainWindow.setBackgroundColor(theme === "dark" ? "#0A0A0A" : "#FFFFFF");
  }
  return theme;
});
electron.ipcMain.handle("auth:store-tokens", async (_, tokens) => {
  try {
    cachedTokens = tokens;
    if (electron.safeStorage.isEncryptionAvailable()) {
      return { success: true };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to store tokens:", error);
    return { success: false, error: "Failed to store tokens" };
  }
});
electron.ipcMain.handle("auth:get-tokens", async () => {
  return cachedTokens;
});
electron.ipcMain.handle("auth:clear-tokens", async () => {
  cachedTokens = null;
  return { success: true };
});
electron.ipcMain.handle("auth:is-encryption-available", async () => {
  return electron.safeStorage.isEncryptionAvailable();
});
const activeStreams = /* @__PURE__ */ new Map();
electron.ipcMain.handle("agent:start-stream", async (_event, streamId, request) => {
  const controller = new AbortController();
  activeStreams.set(streamId, controller);
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      mainWindow?.webContents.send("agent:stream-error", streamId, {
        code: `HTTP_${response.status}`,
        message: errorData.message || response.statusText,
        status: response.status
      });
      return { success: false };
    }
    if (!response.body) {
      mainWindow?.webContents.send("agent:stream-error", streamId, {
        code: "NO_BODY",
        message: "Response body is null",
        status: 0
      });
      return { success: false };
    }
    mainWindow?.webContents.send("agent:stream-connected", streamId);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) {
          processSSEBuffer(streamId, buffer);
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        processSSELine(streamId, line);
      }
    }
    mainWindow?.webContents.send("agent:stream-complete", streamId);
    return { success: true };
  } catch (error) {
    if (error.name === "AbortError") {
      mainWindow?.webContents.send("agent:stream-aborted", streamId);
    } else {
      mainWindow?.webContents.send("agent:stream-error", streamId, {
        code: "STREAM_ERROR",
        message: error.message || "Stream failed",
        status: 0
      });
    }
    return { success: false };
  } finally {
    activeStreams.delete(streamId);
  }
});
electron.ipcMain.handle("agent:abort-stream", async (_, streamId) => {
  const controller = activeStreams.get(streamId);
  if (controller) {
    controller.abort();
    activeStreams.delete(streamId);
    return { success: true };
  }
  return { success: false, error: "Stream not found" };
});
electron.ipcMain.handle("agent:abort-all-streams", async () => {
  for (const [, controller] of activeStreams) {
    controller.abort();
  }
  activeStreams.clear();
  return { success: true };
});
function processSSEBuffer(streamId, buffer) {
  const lines = buffer.split("\n");
  for (const line of lines) {
    processSSELine(streamId, line);
  }
}
function processSSELine(streamId, line) {
  const trimmedLine = line.trim();
  if (!trimmedLine || trimmedLine.startsWith(":")) {
    return;
  }
  if (trimmedLine.startsWith("data:")) {
    const data = trimmedLine.slice(5).trim();
    if (data === "[DONE]") {
      return;
    }
    try {
      const event = JSON.parse(data);
      mainWindow?.webContents.send("agent:stream-event", streamId, event);
    } catch {
      mainWindow?.webContents.send("agent:stream-event", streamId, { data });
    }
  }
}
let voiceAgentProcess = null;
function killVoiceAgent() {
  if (voiceAgentProcess) {
    try {
      voiceAgentProcess.kill("SIGKILL");
    } catch (e) {
    }
    voiceAgentProcess = null;
  }
}
electron.ipcMain.handle("voice-agent:start", async (_event, apiKey) => {
  try {
    killVoiceAgent();
    const agentsPath = electron.app.isPackaged ? node_path.join(process.resourcesPath, "agents") : node_path.join(__dirname$1, "..", "..", "agents");
    const agentScriptPath = node_path.join(agentsPath, "voice_onboarding", "agent.py");
    const venvPython = electron.app.isPackaged ? node_path.join(process.resourcesPath, "venv", "bin", "python") : node_path.join(__dirname$1, "..", "..", "venv", "bin", "python");
    const pythonPath = require("fs").existsSync(venvPython) ? venvPython : process.platform === "win32" ? "python" : "python3";
    console.log("[Voice Agent] Using Python:", pythonPath);
    console.log("[Voice Agent] Script:", agentScriptPath);
    const env = { ...process.env };
    if (apiKey) {
      env.GOOGLE_API_KEY = apiKey;
      env.GEMINI_API_KEY = apiKey;
      env.GOOGLE_AI_API_KEY = apiKey;
    }
    voiceAgentProcess = node_child_process.spawn(pythonPath, [agentScriptPath], {
      env,
      cwd: node_path.join(agentsPath, "voice_onboarding")
    });
    voiceAgentProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      try {
        const event = JSON.parse(output);
        mainWindow?.webContents.send("voice-agent:event", event);
      } catch {
        mainWindow?.webContents.send("voice-agent:output", output);
      }
    });
    voiceAgentProcess.stderr?.on("data", (data) => {
      const error = data.toString();
      console.error("[Voice Agent Error]:", error);
      mainWindow?.webContents.send("voice-agent:error", error);
    });
    voiceAgentProcess.on("exit", (code) => {
      console.log(`[Voice Agent] Process exited with code ${code}`);
      mainWindow?.webContents.send("voice-agent:stopped", { code });
      voiceAgentProcess = null;
    });
    return { success: true, pid: voiceAgentProcess.pid };
  } catch (error) {
    console.error("[Voice Agent] Failed to start:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
electron.ipcMain.handle("voice-agent:stop", async () => {
  if (voiceAgentProcess) {
    killVoiceAgent();
    return { success: true };
  }
  return { success: false, error: "No active voice agent process" };
});
electron.app.on("before-quit", () => {
  killVoiceAgent();
});
electron.app.on("window-all-closed", () => {
  killVoiceAgent();
});
electron.ipcMain.handle("create-tab", async (_, url) => {
  const tabUrl = url || "ron://home";
  return { tabId: `tab-${Date.now()}`, url: tabUrl };
});
electron.ipcMain.handle("close-tab", async (_, _tabId) => {
  return { success: true };
});
electron.ipcMain.handle("switch-tab", async (_, _tabId) => {
  return { success: true };
});
electron.ipcMain.handle("navigate", async (_, _url) => {
  return { success: true };
});
electron.ipcMain.handle("go-back", async () => {
  return { success: true };
});
electron.ipcMain.handle("go-forward", async () => {
  return { success: true };
});
electron.ipcMain.handle("reload", async () => {
  return { success: true };
});
