"use strict";
const electron = require("electron");
const node_path = require("node:path");
const node_url = require("node:url");
const node_child_process = require("node:child_process");
const __filename$1 = node_url.fileURLToPath(require("url").pathToFileURL(__filename).href);
const __dirname$1 = node_path.join(__filename$1, "..");
const CDP_PORT = 9222;
const CHROME_HEIGHT = 108;
const AGENT_PANEL_WIDTH = 420;
electron.app.commandLine.appendSwitch("remote-debugging-port", String(CDP_PORT));
if (process.platform === "win32") electron.app.disableHardwareAcceleration();
if (process.platform === "win32") electron.app.setAppUserModelId(electron.app.getName());
if (!electron.app.requestSingleInstanceLock()) {
  electron.app.quit();
  process.exit(0);
}
let mainWindow = null;
let currentTheme = "light";
let isAgentPanelOpen = false;
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
  mainWindow.on("resize", () => {
    updateWebContentsViewBounds();
  });
}
class TabsManager {
  tabs = /* @__PURE__ */ new Map();
  order = [];
  _activeTabId = null;
  get activeTabId() {
    return this._activeTabId;
  }
  get activeTab() {
    return this._activeTabId ? this.tabs.get(this._activeTabId) : void 0;
  }
  list() {
    return this.order.map((id) => {
      const t = this.tabs.get(id);
      return { id: t.id, url: t.url, title: t.title, favicon: t.favicon, isActive: id === this._activeTabId };
    });
  }
  create(clientTabId, url = "ron://home") {
    const id = clientTabId || `tab-${Date.now()}`;
    const record = { id, url, title: url.startsWith("ron://") ? "Home" : "New Tab", isExternal: !isInternalUrl(url) };
    this.tabs.set(id, record);
    this.order.push(id);
    if (!isInternalUrl(url)) {
      this.ensureView(record);
      record.view.webContents.loadURL(normalizeUrl(url));
    }
    if (!this._activeTabId) this.switch(id);
    this.emitTabsUpdated();
    return record;
  }
  switch(id) {
    const tab = this.tabs.get(id);
    if (!mainWindow || !tab) return false;
    const contentView = mainWindow.contentView;
    const current = this.activeTab;
    if (current?.view && contentView.children.includes(current.view)) {
      contentView.removeChildView(current.view);
    }
    this._activeTabId = id;
    if (tab.isExternal) {
      this.ensureView(tab);
      this.updateViewBounds(tab.view);
      if (!contentView.children.includes(tab.view)) contentView.addChildView(tab.view);
      mainWindow.webContents.send("browser:external-mode", true);
    } else {
      mainWindow.webContents.send("browser:external-mode", false);
    }
    mainWindow.webContents.send("browser:url-changed", tab.url);
    return true;
  }
  close(id) {
    const idx = this.order.indexOf(id);
    const tab = this.tabs.get(id);
    if (idx === -1 || !tab) return false;
    if (tab.view && !tab.view.webContents.isDestroyed()) {
      try {
        tab.view.webContents.close();
      } catch {
      }
    }
    if (mainWindow && tab.view && mainWindow.contentView.children.includes(tab.view)) {
      mainWindow.contentView.removeChildView(tab.view);
    }
    this.tabs.delete(id);
    this.order.splice(idx, 1);
    if (this._activeTabId === id) {
      const nextId = this.order[idx] || this.order[idx - 1] || null;
      this._activeTabId = null;
      if (nextId) this.switch(nextId);
      else {
        mainWindow?.webContents.send("browser:external-mode", false);
      }
    }
    this.emitTabsUpdated();
    return true;
  }
  navigateActive(url) {
    if (!this._activeTabId) {
      const created = this.create(void 0, url);
      return { success: true, isExternal: created.isExternal, url: created.url };
    }
    const tab = this.tabs.get(this._activeTabId);
    const normalizedUrl = normalizeUrl(url);
    tab.url = normalizedUrl;
    tab.isExternal = !isInternalUrl(normalizedUrl);
    if (tab.isExternal) {
      this.ensureView(tab);
      this.attachIfActive(tab);
      tab.view.webContents.loadURL(normalizedUrl);
      return { success: true, isExternal: true, url: normalizedUrl };
    } else {
      if (mainWindow) {
        mainWindow.webContents.send("browser:external-mode", false);
        mainWindow.webContents.send("browser:url-changed", tab.url);
      }
      return { success: true, isExternal: false, url: normalizedUrl };
    }
  }
  goBackActive() {
    const tab = this.activeTab;
    if (tab?.view?.webContents.canGoBack()) {
      tab.view.webContents.goBack();
      return true;
    }
    return false;
  }
  goForwardActive() {
    const tab = this.activeTab;
    if (tab?.view?.webContents.canGoForward()) {
      tab.view.webContents.goForward();
      return true;
    }
    return false;
  }
  reloadActive() {
    const tab = this.activeTab;
    if (tab?.view) {
      tab.view.webContents.reload();
      return true;
    }
    return false;
  }
  canGoBackActive() {
    return this.activeTab?.view?.webContents.canGoBack() ?? false;
  }
  canGoForwardActive() {
    return this.activeTab?.view?.webContents.canGoForward() ?? false;
  }
  async getContext(id) {
    const tab = this.tabs.get(id);
    if (!tab) throw new Error("Tab not found");
    if (!tab.isExternal || !tab.view) {
      return { id: tab.id, url: tab.url, title: tab.title, isExternal: false };
    }
    const wc = tab.view.webContents;
    const url = wc.getURL();
    const title = wc.getTitle();
    const dom = await wc.executeJavaScript(`(() => {
      const html = document.documentElement ? document.documentElement.outerHTML : '';
      const text = document.body ? document.body.innerText : '';
      const metas = Array.from(document.querySelectorAll('meta')).map(m => ({
        name: m.getAttribute('name') || m.getAttribute('property') || '',
        content: m.getAttribute('content') || ''
      }));
      const ls = (() => { try { return Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])) } catch { return {} } })();
      const ss = (() => { try { return Object.fromEntries(Object.keys(sessionStorage).map(k => [k, sessionStorage.getItem(k)])) } catch { return {} } })();
      return { html, text, metas, localStorage: ls, sessionStorage: ss };
    })()`, true);
    const cookies = await wc.session.cookies.get({ url }).catch(() => []);
    const image = await wc.capturePage().catch(() => null);
    const screenshot = image ? image.toPNG().toString("base64") : void 0;
    return { id: tab.id, url, title, favicon: tab.favicon, isExternal: true, dom, cookies, screenshot };
  }
  // Internal helpers
  ensureView(tab) {
    if (tab.view) return;
    tab.view = new electron.WebContentsView({ webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    this.updateViewBounds(tab.view);
    tab.view.webContents.on("did-navigate", (_e, url) => this.onUrlChanged(tab, url));
    tab.view.webContents.on("did-navigate-in-page", (_e, url) => this.onUrlChanged(tab, url));
    tab.view.webContents.on("did-finish-load", () => mainWindow?.webContents.send("browser:navigation-complete", tab.url));
    tab.view.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
      mainWindow?.webContents.send("browser:navigation-error", { errorCode, errorDescription, url: validatedURL });
    });
    tab.view.webContents.on("page-title-updated", (_e, title) => {
      tab.title = title;
      this.emitTabsUpdated();
    });
    tab.view.webContents.on("page-favicon-updated", (_e, favs) => {
      tab.favicon = Array.isArray(favs) ? favs[0] : void 0;
      this.emitTabsUpdated();
    });
    tab.view.webContents.on("context-menu", (_, params) => {
      if (!mainWindow) return;
      const menu = new electron.Menu();
      if (params.selectionText) {
        menu.append(new electron.MenuItem({ label: "Ask Ron?", click: () => mainWindow?.webContents.send("agent:ask-ron", { selectionText: params.selectionText, sourceUrl: tab.url }) }));
        menu.append(new electron.MenuItem({ type: "separator" }));
      }
      menu.append(new electron.MenuItem({ role: "copy", enabled: params.editFlags.canCopy }));
      menu.append(new electron.MenuItem({ role: "paste", enabled: params.editFlags.canPaste }));
      menu.append(new electron.MenuItem({ role: "cut", enabled: params.editFlags.canCut }));
      menu.append(new electron.MenuItem({ type: "separator" }));
      menu.append(new electron.MenuItem({ label: "Back", click: () => {
        if (tab.view?.webContents.canGoBack()) tab.view.webContents.goBack();
      }, enabled: tab.view?.webContents.canGoBack() }));
      menu.append(new electron.MenuItem({ label: "Forward", click: () => {
        if (tab.view?.webContents.canGoForward()) tab.view.webContents.goForward();
      }, enabled: tab.view?.webContents.canGoForward() }));
      menu.append(new electron.MenuItem({ label: "Reload", click: () => tab.view?.webContents.reload() }));
      menu.append(new electron.MenuItem({ type: "separator" }));
      menu.append(new electron.MenuItem({ label: "Inspect Element", click: () => tab.view?.webContents.inspectElement(params.x, params.y) }));
      menu.popup();
    });
    tab.view.webContents.setWindowOpenHandler((details) => {
      electron.shell.openExternal(details.url);
      return { action: "deny" };
    });
  }
  onUrlChanged(tab, url) {
    tab.url = url;
    if (this._activeTabId === tab.id) mainWindow?.webContents.send("browser:url-changed", url);
  }
  attachIfActive(tab) {
    if (!mainWindow || this._activeTabId !== tab.id || !tab.view) return;
    const contentView = mainWindow.contentView;
    if (!contentView.children.includes(tab.view)) contentView.addChildView(tab.view);
    this.updateViewBounds(tab.view);
    mainWindow.webContents.send("browser:external-mode", true);
  }
  updateViewBounds(view) {
    if (!mainWindow) return;
    const bounds = calculateWebContentsViewBounds();
    view.setBounds(bounds);
  }
  updateActiveViewBounds() {
    const v = this.activeTab?.view;
    if (v) this.updateViewBounds(v);
  }
  emitTabsUpdated() {
    mainWindow?.webContents.send("tabs:updated", this.list());
  }
}
const tabsManager = new TabsManager();
function calculateWebContentsViewBounds() {
  if (!mainWindow) return { x: 0, y: CHROME_HEIGHT, width: 800, height: 600 };
  const [windowWidth, windowHeight] = mainWindow.getSize();
  const panelWidth = isAgentPanelOpen ? AGENT_PANEL_WIDTH : 0;
  return {
    x: 0,
    y: CHROME_HEIGHT,
    width: windowWidth - panelWidth,
    height: windowHeight - CHROME_HEIGHT
  };
}
function updateWebContentsViewBounds() {
  if (!mainWindow) return;
  tabsManager.updateActiveViewBounds();
}
function isInternalUrl(url) {
  return url.startsWith("ron://") || url === "" || url === "about:blank";
}
function normalizeUrl(url) {
  if (isInternalUrl(url)) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}
electron.app.whenReady().then(() => {
  createWindow();
  tabsManager.create("tab-initial", "ron://home");
  tabsManager.switch("tab-initial");
});
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
let voiceAgentStdoutBuffer = "";
let voiceAgentStopRequested = false;
let lastVoiceAgentApiKey;
let appQuitting = false;
function killVoiceAgent(timeoutMs = 1200) {
  return new Promise((resolve) => {
    if (!voiceAgentProcess) return resolve(false);
    voiceAgentStopRequested = true;
    const proc = voiceAgentProcess;
    const pid = proc.pid;
    let finished = false;
    let forceTimer = null;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (forceTimer) clearTimeout(forceTimer);
      voiceAgentProcess = null;
      voiceAgentStdoutBuffer = "";
      resolve(true);
    };
    proc.once("exit", () => {
      cleanup();
    });
    try {
      proc.kill("SIGTERM");
    } catch (_) {
      return cleanup();
    }
    forceTimer = setTimeout(() => {
      if (finished) return;
      try {
        if (pid) process.kill(pid, "SIGKILL");
      } catch (_) {
      }
    }, timeoutMs);
  });
}
async function startVoiceAgent(apiKey) {
  try {
    if (voiceAgentProcess && voiceAgentProcess.pid) {
      return { success: true, pid: voiceAgentProcess.pid };
    }
    if (appQuitting) return { success: false, error: "App is quitting" };
    voiceAgentStopRequested = false;
    lastVoiceAgentApiKey = apiKey;
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
      voiceAgentStdoutBuffer += data.toString("utf8");
      const lines = voiceAgentStdoutBuffer.split("\n");
      voiceAgentStdoutBuffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        try {
          const event = JSON.parse(line);
          mainWindow?.webContents.send("voice-agent:event", event);
        } catch {
          mainWindow?.webContents.send("voice-agent:output", rawLine);
        }
      }
    });
    voiceAgentProcess.stderr?.on("data", (data) => {
      const error = data.toString();
      console.error("[Voice Agent Error]:", error);
      mainWindow?.webContents.send("voice-agent:error", error);
    });
    voiceAgentProcess.on("exit", (code, signal) => {
      console.log(`[Voice Agent] Process exited with code ${code}, signal ${signal}`);
      mainWindow?.webContents.send("voice-agent:stopped", { code, signal });
      voiceAgentProcess = null;
      voiceAgentStdoutBuffer = "";
      const wasRequested = voiceAgentStopRequested || appQuitting;
      voiceAgentStopRequested = false;
      if (!wasRequested) {
        console.log("[Voice Agent] Unexpected exit; restarting...");
        setTimeout(() => {
          if (!appQuitting) {
            startVoiceAgent(lastVoiceAgentApiKey).catch((err) => console.error("[Voice Agent] Restart failed:", err));
          }
        }, 500);
      }
    });
    return { success: true, pid: voiceAgentProcess.pid };
  } catch (error) {
    console.error("[Voice Agent] Failed to start:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
electron.ipcMain.handle("voice-agent:start", async (_event, apiKey) => {
  return startVoiceAgent(apiKey);
});
electron.ipcMain.handle("voice-agent:stop", async () => {
  if (voiceAgentProcess) {
    voiceAgentStopRequested = true;
    await killVoiceAgent();
    return { success: true };
  }
  return { success: false, error: "No active voice agent process" };
});
electron.app.on("before-quit", () => {
  appQuitting = true;
  void killVoiceAgent();
});
electron.app.on("window-all-closed", () => {
  appQuitting = true;
  void killVoiceAgent();
});
electron.ipcMain.handle("create-tab", async (_event, url, clientTabId) => {
  const rec = tabsManager.create(clientTabId, url || "ron://home");
  return { tabId: rec.id, url: rec.url };
});
electron.ipcMain.handle("close-tab", async (_event, tabId) => {
  const ok = tabsManager.close(tabId);
  return { success: ok };
});
electron.ipcMain.handle("switch-tab", async (_event, tabId) => {
  const ok = tabsManager.switch(tabId);
  return { success: ok };
});
electron.ipcMain.handle("tabs:list", async () => {
  return tabsManager.list();
});
electron.ipcMain.handle("tabs:get-context", async (_event, tabId) => {
  try {
    const ctx = await tabsManager.getContext(tabId);
    return { success: true, context: ctx };
  } catch (e) {
    return { success: false, error: e?.message || "Failed to get context" };
  }
});
electron.ipcMain.handle("browser:navigate", async (_event, url) => {
  try {
    const result = tabsManager.navigateActive(url);
    return result;
  } catch (error) {
    console.error("[Browser] Navigation error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Navigation failed" };
  }
});
electron.ipcMain.handle("browser:search", async (_, query) => {
  try {
    const searchUrl = `ron://search?q=${encodeURIComponent(query)}`;
    const result = tabsManager.navigateActive(searchUrl);
    return { success: result.success, url: searchUrl, isExternal: false };
  } catch (error) {
    console.error("[Browser] Search error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed"
    };
  }
});
electron.ipcMain.handle("browser:go-back", async () => {
  try {
    return tabsManager.goBackActive() ? { success: true } : { success: false, error: "Cannot go back" };
  } catch (error) {
    return { success: false, error: "Navigation failed" };
  }
});
electron.ipcMain.handle("browser:go-forward", async () => {
  try {
    return tabsManager.goForwardActive() ? { success: true } : { success: false, error: "Cannot go forward" };
  } catch (error) {
    return { success: false, error: "Navigation failed" };
  }
});
electron.ipcMain.handle("browser:reload", async () => {
  try {
    return tabsManager.reloadActive() ? { success: true } : { success: false, error: "Reload failed" };
  } catch (error) {
    return { success: false, error: "Reload failed" };
  }
});
electron.ipcMain.handle("browser:get-url", async () => {
  return tabsManager.activeTab?.url || "ron://home";
});
electron.ipcMain.handle("browser:can-go-back", async () => {
  return tabsManager.canGoBackActive();
});
electron.ipcMain.handle("browser:can-go-forward", async () => {
  return tabsManager.canGoForwardActive();
});
electron.ipcMain.handle("browser:set-panel-open", async (_event, isOpen) => {
  isAgentPanelOpen = isOpen;
  updateWebContentsViewBounds();
  return { success: true };
});
electron.ipcMain.handle("navigate", async (_, url) => {
  return electron.ipcMain.emit("browser:navigate", null, url);
});
electron.ipcMain.handle("go-back", async () => {
  return electron.ipcMain.emit("browser:go-back", null);
});
electron.ipcMain.handle("go-forward", async () => {
  return electron.ipcMain.emit("browser:go-forward", null);
});
electron.ipcMain.handle("reload", async () => {
  return electron.ipcMain.emit("browser:reload", null);
});
