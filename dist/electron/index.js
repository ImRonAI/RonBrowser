"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const node_path = require("node:path");
const node_url = require("node:url");
const node_child_process = require("node:child_process");
const node_module = require("node:module");
const promises = require("node:fs/promises");
const node_fs = require("node:fs");
const chokidar = require("chokidar");
const node_crypto = require("node:crypto");
const FEATURE_FLAG$2 = process.env.ENABLE_PYTHON_TOOL_MANAGEMENT === "true";
let _projectRoot = null;
let _toolsDir = null;
let _userCustomToolsDir = null;
let _manifestsDir = null;
let _pythonScriptsDir = null;
let _pythonPath$1 = null;
function getProjectRoot() {
  if (_projectRoot === null) {
    _projectRoot = electron.app.isPackaged ? node_path.join(process.resourcesPath, "app.asar.unpacked") : node_path.join(__dirname, "..", "..");
  }
  return _projectRoot;
}
function getToolsDir() {
  if (_toolsDir === null) {
    _toolsDir = electron.app.isPackaged ? node_path.join(process.resourcesPath, "app.asar.unpacked", "agent", "tools", "src", "strands_tools") : node_path.join(__dirname, "..", "..", "agent", "tools", "src", "strands_tools");
  }
  return _toolsDir;
}
function getUserCustomToolsDir() {
  if (_userCustomToolsDir === null) {
    _userCustomToolsDir = node_path.join(electron.app.getPath("userData"), "custom_tools");
  }
  return _userCustomToolsDir;
}
function getManifestsDir() {
  if (_manifestsDir === null) {
    _manifestsDir = node_path.join(electron.app.getPath("userData"), "tool_manifests");
  }
  return _manifestsDir;
}
function getPythonScriptsDir() {
  if (_pythonScriptsDir === null) {
    _pythonScriptsDir = electron.app.isPackaged ? node_path.join(process.resourcesPath, "app.asar.unpacked", "python_scripts") : node_path.join(__dirname, "..", "..", "python_scripts");
  }
  return _pythonScriptsDir;
}
function getPythonPath$1() {
  if (_pythonPath$1 === null) {
    const venvPython = electron.app.isPackaged ? node_path.join(process.resourcesPath, "bundled_python", "python") : node_path.join(__dirname, "..", "..", "venv", "bin", "python");
    if (!electron.app.isPackaged) {
      try {
        require("fs").accessSync(venvPython, node_fs.constants.X_OK);
        _pythonPath$1 = venvPython;
      } catch {
        _pythonPath$1 = process.platform === "win32" ? "python" : "python3";
      }
    } else {
      _pythonPath$1 = venvPython;
    }
  }
  return _pythonPath$1;
}
let discoveredTools = [];
let watcher = null;
let isInitialized = false;
async function initializeAndSyncManifests() {
  if (!FEATURE_FLAG$2) {
    return { success: true };
  }
  const pythonPath = getPythonPath$1();
  const updaterScript = node_path.join(getPythonScriptsDir(), "manifest_updater.py");
  const projectRoot = getProjectRoot();
  const manifestsDir = getManifestsDir();
  const customToolsDir = getUserCustomToolsDir();
  await promises.mkdir(manifestsDir, { recursive: true });
  await promises.mkdir(customToolsDir, { recursive: true });
  return new Promise((resolve) => {
    console.log("[ToolManager] Syncing manifests...");
    console.log("[ToolManager] Python:", pythonPath);
    console.log("[ToolManager] Script:", updaterScript);
    console.log("[ToolManager] Project root:", projectRoot);
    console.log("[ToolManager] Manifests dir:", manifestsDir);
    console.log("[ToolManager] Custom tools dir:", customToolsDir);
    const proc = node_child_process.spawn(pythonPath, [updaterScript, projectRoot, manifestsDir, customToolsDir]);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log(`[ToolManager] Manifest sync complete: ${result.loadable_tools_count} tools discovered`);
          resolve({ success: true });
        } catch {
          console.log("[ToolManager] Manifest sync complete");
          resolve({ success: true });
        }
      } else {
        console.error("[ToolManager] Manifest sync failed:", stderr);
        resolve({ success: false, error: stderr });
      }
    });
    proc.on("error", (err) => {
      console.error("[ToolManager] Failed to spawn manifest updater:", err);
      resolve({ success: false, error: err.message });
    });
  });
}
async function discoverDynamicToolsForAgent() {
  if (!FEATURE_FLAG$2) {
    return [];
  }
  const manifestsDir = getManifestsDir();
  const toolsDir = getToolsDir();
  const tools = [];
  try {
    const manifestPath = node_path.join(manifestsDir, "strands_tools_manifest.json");
    await promises.access(manifestPath, node_fs.constants.R_OK);
    const content = await promises.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(content);
    for (const tool of manifest.tools) {
      const executablePath = node_path.join(toolsDir, tool.executable_filename);
      try {
        await promises.access(executablePath, node_fs.constants.R_OK);
      } catch {
        console.warn(`[ToolManager] Tool file not found: ${executablePath}`);
        continue;
      }
      tools.push({
        name: tool.name,
        description: tool.description,
        version: tool.version,
        executableFilename: tool.executable_filename,
        executablePath,
        category: "strands_tools",
        // All strands tools in one category
        argsSchema: tool.args_schema
      });
    }
  } catch (err) {
    console.log("[ToolManager] No manifest found yet, run sync first");
  }
  discoveredTools = tools;
  console.log(`[ToolManager] Discovered ${tools.length} tools`);
  return tools;
}
function getDiscoveredTools() {
  return discoveredTools;
}
async function getFullManifest() {
  const manifestPath = node_path.join(getManifestsDir(), "tools_discovery_manifest.json");
  try {
    const content = await promises.readFile(manifestPath, "utf-8");
    return JSON.parse(content);
  } catch {
    console.log("[ToolManager] No discovery manifest found");
    return null;
  }
}
function getCustomToolsDir() {
  return getUserCustomToolsDir();
}
function startWatcher(onUpdate) {
  if (!FEATURE_FLAG$2) {
    return;
  }
  const toolsDir = getToolsDir();
  const customToolsDir = getUserCustomToolsDir();
  if (watcher) {
    watcher.close();
  }
  console.log(`[ToolManager] Starting file watcher on: ${toolsDir}`);
  console.log(`[ToolManager] Also watching custom tools: ${customToolsDir}`);
  watcher = chokidar.watch([toolsDir, customToolsDir], {
    ignored: /(^|[\/\\])\../,
    // Ignore dotfiles
    persistent: true,
    depth: 2,
    ignoreInitial: true,
    // Don't trigger on initial scan
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });
  let updateTimeout = null;
  const triggerUpdate = async () => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(async () => {
      console.log("[ToolManager] Tools directory changed, resyncing...");
      await initializeAndSyncManifests();
      const tools = await discoverDynamicToolsForAgent();
      onUpdate(tools);
    }, 1e3);
  };
  watcher.on("add", (path) => {
    if (path.endsWith(".py") || path.endsWith(".toolinfo.json")) {
      console.log(`[ToolManager] Tool added: ${node_path.basename(path)}`);
      triggerUpdate();
    }
  }).on("change", (path) => {
    if (path.endsWith(".py") || path.endsWith(".toolinfo.json")) {
      console.log(`[ToolManager] Tool changed: ${node_path.basename(path)}`);
      triggerUpdate();
    }
  }).on("unlink", (path) => {
    if (path.endsWith(".py") || path.endsWith(".toolinfo.json")) {
      console.log(`[ToolManager] Tool removed: ${node_path.basename(path)}`);
      triggerUpdate();
    }
  }).on("error", (error) => {
    console.error("[ToolManager] Watcher error:", error);
  });
}
function stopWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
async function initializeToolManager(onInventoryUpdate) {
  if (!FEATURE_FLAG$2) {
    console.log("[ToolManager] Feature flag disabled, skipping initialization");
    return;
  }
  if (isInitialized) {
    console.log("[ToolManager] Already initialized");
    return;
  }
  console.log("[ToolManager] Initializing tool management system...");
  await initializeAndSyncManifests();
  await discoverDynamicToolsForAgent();
  if (onInventoryUpdate) {
    startWatcher(onInventoryUpdate);
  }
  isInitialized = true;
  console.log("[ToolManager] Initialization complete");
}
function registerToolManagerIPC() {
  if (!FEATURE_FLAG$2) {
    return;
  }
  electron.ipcMain.handle("tools:discover", async () => {
    return await discoverDynamicToolsForAgent();
  });
  electron.ipcMain.handle("tools:refresh", async () => {
    await initializeAndSyncManifests();
    return await discoverDynamicToolsForAgent();
  });
  electron.ipcMain.handle("tools:list", () => {
    return getDiscoveredTools();
  });
  electron.ipcMain.handle("tools:getManifest", async () => {
    return await getFullManifest();
  });
  electron.ipcMain.handle("tools:getCustomToolsDir", async () => {
    const dir = getCustomToolsDir();
    await promises.mkdir(dir, { recursive: true });
    return dir;
  });
  electron.ipcMain.handle("tools:saveCustomTool", async (_, name, code) => {
    const { writeFile } = await import("node:fs/promises");
    const dir = getCustomToolsDir();
    await promises.mkdir(dir, { recursive: true });
    const toolPath = node_path.join(dir, `${name}.py`);
    await writeFile(toolPath, code, "utf-8");
    return { success: true, path: toolPath };
  });
  console.log("[ToolManager] IPC handlers registered");
}
const FEATURE_FLAG$1 = process.env.ENABLE_PYTHON_TOOL_MANAGEMENT === "true";
const DEFAULT_TIMEOUT = 3e5;
let workerPool = [];
const pendingExecutions = /* @__PURE__ */ new Map();
let _utilityRunnerPath = null;
let _pythonPath = null;
function getUtilityRunnerPath() {
  if (_utilityRunnerPath === null) {
    _utilityRunnerPath = electron.app.isPackaged ? node_path.join(process.resourcesPath, "app.asar.unpacked", "electron", "utility-runner.js") : node_path.join(__dirname, "utility-runner.js");
  }
  return _utilityRunnerPath;
}
function getPythonPath() {
  if (_pythonPath === null) {
    const venvPython = electron.app.isPackaged ? node_path.join(process.resourcesPath, "bundled_python", "python") : node_path.join(__dirname, "..", "..", "venv", "bin", "python");
    if (!electron.app.isPackaged) {
      try {
        require("fs").accessSync(venvPython);
        _pythonPath = venvPython;
      } catch {
        _pythonPath = process.platform === "win32" ? "python" : "python3";
      }
    } else {
      _pythonPath = venvPython;
    }
  }
  return _pythonPath;
}
function createWorker() {
  const utilityRunnerPath = getUtilityRunnerPath();
  console.log("[ToolExecutor] Creating worker with script:", utilityRunnerPath);
  const worker = electron.utilityProcess.fork(utilityRunnerPath, [], {
    stdio: "pipe",
    serviceName: "python-tool-executor"
  });
  worker.on("message", (msg) => {
    const pending = pendingExecutions.get(msg.requestId);
    if (!pending) return;
    switch (msg.type) {
      case "stdout":
        pending.stdout += msg.data;
        break;
      case "stderr":
        pending.stderr += msg.data;
        break;
      case "complete":
        clearTimeout(pending.timeout);
        pendingExecutions.delete(msg.requestId);
        pending.resolve({
          success: msg.success,
          exitCode: msg.exitCode,
          result: msg.result,
          stdout: msg.stdout,
          stderr: msg.stderr,
          duration: msg.duration
        });
        break;
      case "error":
        clearTimeout(pending.timeout);
        pendingExecutions.delete(msg.requestId);
        pending.resolve({
          success: false,
          exitCode: -1,
          result: {
            status: "error",
            content: [{ text: msg.message }]
          },
          stdout: pending.stdout,
          stderr: pending.stderr,
          duration: Date.now() - pending.startTime,
          error: msg.message
        });
        break;
    }
  });
  worker.on("exit", (code) => {
    console.log(`[ToolExecutor] Worker exited with code: ${code}`);
    for (const [requestId, pending] of pendingExecutions.entries()) {
      clearTimeout(pending.timeout);
      pending.resolve({
        success: false,
        exitCode: code ?? -1,
        result: {
          status: "error",
          content: [{ text: "Worker process exited unexpectedly" }]
        },
        stdout: pending.stdout,
        stderr: pending.stderr,
        duration: Date.now() - pending.startTime,
        error: "Worker process exited"
      });
      pendingExecutions.delete(requestId);
    }
    const idx = workerPool.indexOf(worker);
    if (idx >= 0) {
      workerPool.splice(idx, 1);
    }
  });
  return worker;
}
function getWorker() {
  if (workerPool.length === 0) {
    workerPool.push(createWorker());
  }
  return workerPool[0];
}
async function executeToolInSandbox(toolInfo, args = {}, timeout = DEFAULT_TIMEOUT) {
  if (!FEATURE_FLAG$1) {
    return {
      success: false,
      exitCode: -1,
      result: {
        status: "error",
        content: [{ text: "Python tool management is disabled" }]
      },
      stdout: "",
      stderr: "",
      duration: 0,
      error: "Feature disabled"
    };
  }
  const requestId = node_crypto.randomUUID();
  const worker = getWorker();
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timeoutHandle = setTimeout(() => {
      pendingExecutions.delete(requestId);
      resolve({
        success: false,
        exitCode: -1,
        result: {
          status: "error",
          content: [{ text: `Tool execution timed out after ${timeout}ms` }]
        },
        stdout: pendingExecutions.get(requestId)?.stdout ?? "",
        stderr: pendingExecutions.get(requestId)?.stderr ?? "",
        duration: timeout,
        error: "Timeout"
      });
    }, timeout);
    pendingExecutions.set(requestId, {
      resolve,
      reject,
      timeout: timeoutHandle,
      stdout: "",
      stderr: "",
      startTime
    });
    worker.postMessage({
      type: "executePythonTool",
      requestId,
      pythonPath: getPythonPath(),
      loadToolPath: "",
      // Not using load_tool.py wrapper for now
      toolPath: toolInfo.executablePath,
      toolName: toolInfo.name,
      args,
      env: {}
    });
  });
}
function terminateAllWorkers() {
  for (const worker of workerPool) {
    try {
      worker.kill();
    } catch (err) {
      console.error("[ToolExecutor] Error killing worker:", err);
    }
  }
  workerPool = [];
  for (const [_requestId, pending] of pendingExecutions.entries()) {
    clearTimeout(pending.timeout);
    pending.resolve({
      success: false,
      exitCode: -1,
      result: {
        status: "error",
        content: [{ text: "Executor terminated" }]
      },
      stdout: pending.stdout,
      stderr: pending.stderr,
      duration: Date.now() - pending.startTime,
      error: "Terminated"
    });
  }
  pendingExecutions.clear();
}
const FEATURE_FLAG = process.env.ENABLE_PYTHON_TOOL_MANAGEMENT === "true";
let _auditLogPath = null;
function getAuditLogPath() {
  if (_auditLogPath === null) {
    _auditLogPath = node_path.join(electron.app.getPath("userData"), "tool-audit.jsonl");
  }
  return _auditLogPath;
}
function isToolAllowed(toolName) {
  {
    return true;
  }
}
function validateToolArgs(_tool, args) {
  const errors = [];
  const sanitizedArgs = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string") {
      if (value.includes("..") && (key.includes("path") || key.includes("file"))) {
        errors.push(`Potential path traversal in ${key}`);
        continue;
      }
      const dangerousPatterns = [
        /;\s*rm\s/i,
        /;\s*sudo\s/i,
        /\|\s*bash/i,
        /`.*`/,
        /\$\(.*\)/
      ];
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          errors.push(`Potential command injection in ${key}`);
          continue;
        }
      }
    }
    sanitizedArgs[key] = value;
  }
  return {
    valid: errors.length === 0,
    sanitizedArgs,
    errors
  };
}
async function logAuditEvent(entry) {
  if (!FEATURE_FLAG) return;
  const logPath = getAuditLogPath();
  try {
    const { dirname } = await import("node:path");
    await promises.mkdir(dirname(logPath), { recursive: true });
    const logLine = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp || (/* @__PURE__ */ new Date()).toISOString()
    }) + "\n";
    await promises.appendFile(logPath, logLine);
  } catch (err) {
    console.error("[ToolSecurity] Failed to write audit log:", err);
  }
}
async function logExecutionStart(tool, args) {
  await logAuditEvent({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    event: "execution_start",
    toolName: tool.name,
    toolPath: tool.executablePath,
    args
  });
}
async function logExecutionComplete(tool, success, duration, error) {
  await logAuditEvent({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    event: success ? "execution_complete" : "execution_error",
    toolName: tool.name,
    result: success ? "success" : "error",
    duration,
    error
  });
}
async function logWhitelistBlock(toolName) {
  await logAuditEvent({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    event: "whitelist_block",
    toolName
  });
}
async function logValidationFailure(tool, errors) {
  await logAuditEvent({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    event: "validation_failure",
    toolName: tool.name,
    error: errors.join("; ")
  });
}
async function performSecurityCheck(tool, args) {
  if (!isToolAllowed(tool.name)) {
    await logWhitelistBlock(tool.name);
    return {
      allowed: false,
      errors: [`Tool '${tool.name}' is not in the whitelist`]
    };
  }
  const validation = validateToolArgs(tool, args);
  if (!validation.valid) {
    await logValidationFailure(tool, validation.errors);
    return {
      allowed: false,
      errors: validation.errors
    };
  }
  return {
    allowed: true,
    tool,
    sanitizedArgs: validation.sanitizedArgs,
    errors: []
  };
}
const __filename$1 = node_url.fileURLToPath(require("url").pathToFileURL(__filename).href);
const __dirname$1 = node_path.join(__filename$1, "..");
const CDP_PORT = 9222;
const MCP_BRIDGE_PORT = 9231;
let mcpBridgeStarted = false;
if (!electron.app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
}
async function startMcpBridge() {
  if (mcpBridgeStarted) return;
  try {
    const require2 = node_module.createRequire(require("url").pathToFileURL(__filename).href);
    let startElectronBridge;
    try {
      startElectronBridge = require2("@executeautomation/playwright-mcp-server/electron").startElectronBridge;
    } catch {
      startElectronBridge = require2("/Users/timhunter/Library/Mobile Documents/com~apple~CloudDocs/ronbrowser/agent/tools/mcp/mcp-playwright/dist/electron/index.js").startElectronBridge;
    }
    startElectronBridge({
      port: MCP_BRIDGE_PORT,
      cdpPort: CDP_PORT,
      headless: false
    });
    mcpBridgeStarted = true;
    console.log(`[MCP] Electron bridge listening on http://127.0.0.1:${MCP_BRIDGE_PORT}`);
  } catch (error) {
    console.warn("[MCP] Bridge unavailable (install @executeautomation/playwright-mcp-server)", error);
  }
}
const CHROME_HEIGHT = 108;
const AGENT_PANEL_WIDTH = 420;
electron.app.commandLine.appendSwitch("remote-debugging-port", String(CDP_PORT));
electron.app.commandLine.appendSwitch("remote-allow-origins", "*");
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
    },
    icon: node_path.join(__dirname$1, "../../public/favicon.png")
  });
  const isDev = !electron.app.isPackaged || Boolean(process.env.ELECTRON_RENDERER_URL);
  const devCsp = "default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https: blob: *; connect-src 'self' http://localhost:8765 https: wss: ws:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval';";
  const prodCsp = "default-src 'self'; img-src 'self' data: https: blob:; connect-src 'self' http://localhost:8765 https: wss: ws:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self';";
  const csp = isDev ? devCsp : prodCsp;
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp]
      }
    });
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (isDev) {
    try {
      await mainWindow.webContents.session.clearCache();
    } catch (error) {
      console.warn("[Dev] Failed to clear cache:", error);
    }
  }
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
    this.focusVisibleSurface(tab);
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
      this.focusVisibleSurface(tab);
      return { success: true, isExternal: true, url: normalizedUrl };
    } else {
      if (mainWindow) {
        if (tab.view && mainWindow.contentView.children.includes(tab.view)) {
          mainWindow.contentView.removeChildView(tab.view);
        }
        if (normalizedUrl.startsWith("ron://search")) {
          tab.title = "Search";
        } else if (normalizedUrl.startsWith("ron://home")) {
          tab.title = "Home";
        } else if (normalizedUrl.startsWith("ron://")) {
          tab.title = "Ron";
        }
        this.emitTabsUpdated();
        mainWindow.webContents.send("browser:external-mode", false);
        mainWindow.webContents.send("browser:url-changed", tab.url);
      }
      this.focusVisibleSurface(tab);
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
    let screenshot;
    if (image && !image.isEmpty()) {
      screenshot = image.toPNG().toString("base64");
    } else {
      console.warn(`[TabsManager] Captured empty screenshot for tab ${id}`);
    }
    return { id: tab.id, url, title, favicon: tab.favicon, isExternal: true, dom, cookies, screenshot };
  }
  // Internal helpers
  ensureView(tab) {
    if (tab.view) return;
    tab.view = new electron.WebContentsView({ webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
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
    this.focusVisibleSurface(tab);
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
  // DO NOT MODIFY WITHOUT EXPLICIT APPROVAL FROM TIM HUNTER.
  // This enforces that automation targets only what the user can see.
  focusVisibleSurface(tab) {
    if (!mainWindow) return;
    if (tab.isExternal && tab.view && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.focus();
      return;
    }
    if (!mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.focus();
    }
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
electron.app.whenReady().then(async () => {
  createWindow();
  tabsManager.create("tab-initial", "ron://home");
  tabsManager.switch("tab-initial");
  await startMcpBridge();
  if (process.env.ENABLE_PYTHON_TOOL_MANAGEMENT === "true") {
    console.log("[Main] Initializing Python Tool Management System...");
    registerToolManagerIPC();
    electron.ipcMain.handle("tools:execute", async (_, toolName, args) => {
      const tools = getDiscoveredTools();
      const tool = tools.find((t) => t.name === toolName);
      if (!tool) {
        return {
          success: false,
          error: `Tool not found: ${toolName}`,
          result: { status: "error", content: [{ text: `Tool not found: ${toolName}` }] }
        };
      }
      const securityCheck = await performSecurityCheck(tool, args);
      if (!securityCheck.allowed) {
        return {
          success: false,
          error: securityCheck.errors.join(", "),
          result: { status: "error", content: [{ text: securityCheck.errors.join(", ") }] }
        };
      }
      await logExecutionStart(tool, securityCheck.sanitizedArgs || args);
      const result = await executeToolInSandbox(tool, securityCheck.sanitizedArgs || args);
      await logExecutionComplete(tool, result.success, result.duration, result.error);
      return result;
    });
    await initializeToolManager((tools) => {
      mainWindow?.webContents.send("tools:inventory-updated", tools);
    });
    console.log("[Main] Python Tool Management System ready");
  }
});
electron.app.on("window-all-closed", () => {
  if (process.env.ENABLE_PYTHON_TOOL_MANAGEMENT === "true") {
    stopWatcher();
    terminateAllWorkers();
  }
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
function getSandboxRoot() {
  const userDataPath = electron.app.getPath("userData");
  return node_path.join(userDataPath, "agent-sandbox");
}
function ensureSandboxExists() {
  const sandboxRoot = getSandboxRoot();
  const fs = require("fs");
  if (!fs.existsSync(sandboxRoot)) {
    fs.mkdirSync(sandboxRoot, { recursive: true });
    console.log("[Sandbox] Created sandbox directory:", sandboxRoot);
  }
  return sandboxRoot;
}
function resolveSandboxPath(relativePath) {
  const sandboxRoot = ensureSandboxExists();
  const path = require("path");
  const cleanPath = relativePath.replace(/^[/\\]+/, "");
  const fullPath = path.normalize(path.join(sandboxRoot, cleanPath));
  if (!fullPath.startsWith(path.normalize(sandboxRoot))) {
    return { success: false, error: `Path traversal blocked: '${relativePath}' resolves outside sandbox` };
  }
  return { success: true, path: fullPath };
}
electron.ipcMain.handle("sandbox:get-root", async () => {
  return { success: true, root: ensureSandboxExists() };
});
electron.ipcMain.handle("sandbox:shell", async (_, command, args = [], options = {}) => {
  const sandboxRoot = ensureSandboxExists();
  const { spawn: spawn2 } = require("child_process");
  const maxTimeout = 3e4;
  const maxNoOutputTimeout = 15e3;
  const requestedTimeout = Number.isFinite(options.timeout) ? options.timeout : maxTimeout;
  const timeout = Math.min(Math.max(requestedTimeout, 1e3), maxTimeout);
  const requestedNoOutputTimeout = Number.isFinite(options.noOutputTimeout) ? options.noOutputTimeout : maxNoOutputTimeout;
  const noOutputTimeout = Math.min(Math.max(requestedNoOutputTimeout, 1e3), maxNoOutputTimeout);
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let noOutputTimedOut = false;
    let resolved = false;
    let outputSeen = false;
    let killTimer = null;
    let timer = null;
    let noOutputTimer = null;
    const child = spawn2(command, args, {
      cwd: sandboxRoot,
      shell: true,
      detached: true,
      env: {
        ...process.env,
        HOME: sandboxRoot,
        // Restrict HOME to sandbox
        PWD: sandboxRoot
      }
    });
    const terminate = (signal) => {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, signal);
      } catch {
        try {
          child.kill(signal);
        } catch {
        }
      }
    };
    const clearNoOutputTimer = () => {
      if (noOutputTimer) {
        clearTimeout(noOutputTimer);
        noOutputTimer = null;
      }
    };
    const finalize = (payload) => {
      if (resolved) return;
      resolved = true;
      if (timer) clearTimeout(timer);
      if (!timedOut && !noOutputTimedOut && killTimer) clearTimeout(killTimer);
      clearNoOutputTimer();
      child.stdout?.removeAllListeners("data");
      child.stderr?.removeAllListeners("data");
      child.removeAllListeners("close");
      child.removeAllListeners("error");
      resolve(payload);
    };
    timer = setTimeout(() => {
      if (resolved) return;
      timedOut = true;
      terminate("SIGTERM");
      killTimer = setTimeout(() => terminate("SIGKILL"), 1e3);
      finalize({
        success: false,
        error: `Command timed out after ${timeout}ms`,
        stdout,
        stderr,
        exitCode: -1
      });
    }, timeout);
    noOutputTimer = setTimeout(() => {
      if (resolved || outputSeen) return;
      noOutputTimedOut = true;
      terminate("SIGTERM");
      killTimer = setTimeout(() => terminate("SIGKILL"), 1e3);
      finalize({
        success: false,
        error: `Command produced no output after ${noOutputTimeout}ms`,
        stdout,
        stderr,
        exitCode: -1
      });
    }, noOutputTimeout);
    child.stdout?.on("data", (data) => {
      if (!outputSeen) {
        outputSeen = true;
        clearNoOutputTimer();
      }
      stdout += data.toString();
    });
    child.stderr?.on("data", (data) => {
      if (!outputSeen) {
        outputSeen = true;
        clearNoOutputTimer();
      }
      stderr += data.toString();
    });
    child.on("close", (code) => {
      if (timedOut) {
        finalize({
          success: false,
          error: `Command timed out after ${timeout}ms`,
          stdout,
          stderr,
          exitCode: -1
        });
      } else {
        finalize({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code ?? -1,
          error: code !== 0 ? `Command exited with code ${code}` : void 0
        });
      }
    });
    child.on("error", (err) => {
      finalize({
        success: false,
        error: err.message,
        stdout,
        stderr,
        exitCode: -1
      });
    });
  });
});
electron.ipcMain.handle("sandbox:read-file", async (_, filePath) => {
  const resolved = resolveSandboxPath(filePath);
  if (!resolved.success || !resolved.path) {
    return { success: false, error: resolved.error };
  }
  try {
    const fs = require("fs");
    if (!fs.existsSync(resolved.path)) {
      return { success: false, error: `File not found: ${filePath}` };
    }
    const content = fs.readFileSync(resolved.path, "utf-8");
    return { success: true, content };
  } catch (error) {
    return { success: false, error: `Error reading file: ${error}` };
  }
});
electron.ipcMain.handle("sandbox:write-file", async (_, filePath, content) => {
  const resolved = resolveSandboxPath(filePath);
  if (!resolved.success || !resolved.path) {
    return { success: false, error: resolved.error };
  }
  try {
    const fs = require("fs");
    const path = require("path");
    const dirname = path.dirname(resolved.path);
    if (!fs.existsSync(dirname)) {
      if (!dirname.startsWith(ensureSandboxExists())) {
        return { success: false, error: "Parent directory traversal blocked" };
      }
      fs.mkdirSync(dirname, { recursive: true });
    }
    fs.writeFileSync(resolved.path, content, "utf-8");
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: `Error writing file: ${error}` };
  }
});
electron.ipcMain.handle("sandbox:list-files", async (_, relativePath = "") => {
  const resolved = resolveSandboxPath(relativePath || ".");
  if (!resolved.success) return { success: false, error: resolved.error };
  const fs = require("fs");
  const path = require("path");
  try {
    if (!fs.existsSync(resolved.path)) {
      return { success: false, error: "Directory not found" };
    }
    const entries = fs.readdirSync(resolved.path, { withFileTypes: true });
    const files = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "dir" : "file",
      size: entry.isFile() ? fs.statSync(path.join(resolved.path, entry.name)).size : void 0
    }));
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
