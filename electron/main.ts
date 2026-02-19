import { app, BrowserWindow, shell, ipcMain, safeStorage, WebContentsView, Menu, MenuItem } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'

// Tool Management System (behind feature flag)
import { initializeToolManager, registerToolManagerIPC, getDiscoveredTools, stopWatcher } from './tool-manager'
import { executeToolInSandbox, terminateAllWorkers } from './tool-executor'
import { performSecurityCheck, logExecutionStart, logExecutionComplete } from './tool-security'

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..')

// CDP Port for browser automation
const CDP_PORT = 9222
const MCP_BRIDGE_PORT = 9231

let mcpBridgeStarted = false

// Dev-only: silence CSP warning noise during local development
if (!app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

async function startMcpBridge(tabsManager: TabsManager) {
  if (mcpBridgeStarted) return
  try {
    const require = createRequire(import.meta.url)
    let startElectronBridge: any
    try {
      startElectronBridge = require('@executeautomation/playwright-mcp-server/electron').startElectronBridge
    } catch {
      const mcpBridgePath = join(__dirname, '..', '..', 'agent', 'tools', 'src', 'strands_tools', 'mcp', 'mcp-playwright', 'dist', 'electron', 'index.js')
      startElectronBridge = require(mcpBridgePath).startElectronBridge
    }
    startElectronBridge({
      port: MCP_BRIDGE_PORT,
      cdpPort: CDP_PORT,
      headless: false,
      getTargetInfo: async () => {
        const activeTab = tabsManager.activeTab
        if (activeTab?.isExternal && activeTab.view) {
          const wc = activeTab.view.webContents
          try {
            if (!wc.debugger.isAttached()) wc.debugger.attach()
            const { targetInfo } = await wc.debugger.sendCommand('Target.getTargetInfo')
            wc.debugger.detach()
            return {
              targetId: targetInfo.targetId,
              webContentsId: wc.id,
              windowId: wc.hostWebContents?.id // or undefined
            }
          } catch (e) {
            console.error('[MCP] Failed to get target info for tab', e)
          }
        }
        return undefined // Fallback to default
      }
    })
    mcpBridgeStarted = true
    console.log(`[MCP] Electron bridge listening on http://127.0.0.1:${MCP_BRIDGE_PORT}`)
  } catch (error) {
    console.warn('[MCP] Bridge unavailable (install @executeautomation/playwright-mcp-server)', error)
  }
}

// Layout constants
const CHROME_HEIGHT = 108 // Height of toolbar (64px) + tabs (44px)
const AGENT_PANEL_WIDTH = 420 // Width of the agent panel

// Enable CDP (Chrome DevTools Protocol) for Playwright/browser-use connection
// This allows the Python agent to connect to this Electron instance
app.commandLine.appendSwitch('remote-debugging-port', String(CDP_PORT))
app.commandLine.appendSwitch('remote-allow-origins', '*')

// Disable GPU Acceleration for Windows 7
if (process.platform === 'win32') app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null
let currentTheme: 'light' | 'dark' | 'glass' | 'system' = 'light'
// Deprecated single-view variables replaced by TabsManager
let isAgentPanelOpen: boolean = false

// ============================================
// Secure Token Storage
// ============================================

interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

let cachedTokens: StoredTokens | null = null

// Note: encryptAndStore and decryptAndRetrieve are available for future secure token persistence
// Currently using in-memory storage; for production, integrate with electron-store

// ============================================
// Window Creation
// ============================================

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Ron Browser',
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false, // We'll create custom window controls
    titleBarStyle: 'hidden', // Hide native title bar completely
    transparent: true,
    backgroundColor: '#00000000',
    vibrancy: 'sidebar', // Frosted glass effect on macOS
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    icon: join(__dirname, '../../public/favicon.png')
  })

  // Allow external images (Unsplash, etc.) by setting CSP (dev is permissive for HMR)
  const isDev = !app.isPackaged || Boolean(process.env.ELECTRON_RENDERER_URL)
  const devCsp =
    "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "img-src 'self' data: https: blob: *; " +
    "connect-src 'self' http://localhost:8765 https: wss: ws:; " +
    "font-src 'self' data: https:; " +
    "style-src 'self' 'unsafe-inline' https:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval';"
  const prodCsp =
    "default-src 'self'; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' http://localhost:8765 https: wss: ws:; " +
    "font-src 'self' data: https:; " +
    "style-src 'self' 'unsafe-inline' https:; " +
    "script-src 'self';"
  const csp = isDev ? devCsp : prodCsp

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev) {
    try {
      await mainWindow.webContents.session.clearCache()
    } catch (error) {
      console.warn('[Dev] Failed to clear cache:', error)
    }
  }

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Handle window resize - update WebContentsView bounds
  mainWindow.on('resize', () => {
    updateWebContentsViewBounds()
  })
}

// ============================================
// Tabs Manager (WebContentsView per tab)
// ============================================

interface TabRecord {
  id: string
  url: string
  title: string
  favicon?: string
  isExternal: boolean
  view?: WebContentsView
}

class TabsManager {
  private tabs = new Map<string, TabRecord>()
  private order: string[] = []
  private _activeTabId: string | null = null

  get activeTabId() { return this._activeTabId }
  get activeTab(): TabRecord | undefined { return this._activeTabId ? this.tabs.get(this._activeTabId) : undefined }

  list(): Array<{ id: string; url: string; title: string; favicon?: string; isActive: boolean }> {
    return this.order.map(id => {
      const t = this.tabs.get(id)!
      return { id: t.id, url: t.url, title: t.title, favicon: t.favicon, isActive: id === this._activeTabId }
    })
  }

  create(clientTabId?: string, url: string = 'ron://home'): TabRecord {
    const id = clientTabId || `tab-${Date.now()}`
    const record: TabRecord = { id, url, title: url.startsWith('ron://') ? 'Home' : 'New Tab', isExternal: !isInternalUrl(url) }
    this.tabs.set(id, record)
    this.order.push(id)

    // Only create a WebContentsView when navigating external content
    if (!isInternalUrl(url)) {
      this.ensureView(record)
      record.view!.webContents.loadURL(normalizeUrl(url))
    }

    // If this is the first tab, make it active by default
    if (!this._activeTabId) this.switch(id)

    this.emitTabsUpdated()
    return record
  }

  switch(id: string): boolean {
    const tab = this.tabs.get(id)
    if (!mainWindow || !tab) return false

    const contentView = mainWindow.contentView

    // Detach currently attached view (if any)
    const current = this.activeTab
    if (current?.view && contentView.children.includes(current.view)) {
      contentView.removeChildView(current.view)
    }

    this._activeTabId = id

    if (tab.isExternal) {
      this.ensureView(tab)
      this.updateViewBounds(tab.view!)
      if (!contentView.children.includes(tab.view!)) contentView.addChildView(tab.view!)
      // Let renderer know we're in external mode
      mainWindow.webContents.send('browser:external-mode', true)
    } else {
      // Internal content => ensure no WebContentsView is attached
      mainWindow.webContents.send('browser:external-mode', false)
    }

    // Sync URL to renderer
    mainWindow.webContents.send('browser:url-changed', tab.url)
    this.focusVisibleSurface(tab)
    return true
  }

  close(id: string): boolean {
    const idx = this.order.indexOf(id)
    const tab = this.tabs.get(id)
    if (idx === -1 || !tab) return false

    // Destroy view if exists
    if (tab.view && !tab.view.webContents.isDestroyed()) {
      try { tab.view.webContents.close() } catch {}
    }

    // Remove from window if attached
    if (mainWindow && tab.view && mainWindow.contentView.children.includes(tab.view)) {
      mainWindow.contentView.removeChildView(tab.view)
    }

    this.tabs.delete(id)
    this.order.splice(idx, 1)

    // Choose new active tab if needed
    if (this._activeTabId === id) {
      const nextId = this.order[idx] || this.order[idx - 1] || null
      this._activeTabId = null
      if (nextId) this.switch(nextId)
      else {
        // No tabs left => renderer in internal mode
        mainWindow?.webContents.send('browser:external-mode', false)
      }
    }

    this.emitTabsUpdated()
    return true
  }

  navigateActive(url: string): { success: boolean; isExternal: boolean; url?: string; error?: string } {
    if (!this._activeTabId) {
      // No tabs yet; create one and navigate
      const created = this.create(undefined, url)
      return { success: true, isExternal: created.isExternal, url: created.url }
    }
    const tab = this.tabs.get(this._activeTabId)!
    const normalizedUrl = normalizeUrl(url)
    tab.url = normalizedUrl
    tab.isExternal = !isInternalUrl(normalizedUrl)

    if (tab.isExternal) {
      this.ensureView(tab)
      this.attachIfActive(tab)
      tab.view!.webContents.loadURL(normalizedUrl)
      this.focusVisibleSurface(tab)
      return { success: true, isExternal: true, url: normalizedUrl }
    } else {
      // Internal page => detach any view if this tab is active
      if (mainWindow) {
        if (tab.view && mainWindow.contentView.children.includes(tab.view)) {
          mainWindow.contentView.removeChildView(tab.view)
        }

        if (normalizedUrl.startsWith('ron://search')) {
          tab.title = 'Search'
        } else if (normalizedUrl.startsWith('ron://home')) {
          tab.title = 'Home'
        } else if (normalizedUrl.startsWith('ron://')) {
          tab.title = 'Ron'
        }

        this.emitTabsUpdated()
        mainWindow.webContents.send('browser:external-mode', false)
        mainWindow.webContents.send('browser:url-changed', tab.url)
      }
      this.focusVisibleSurface(tab)
      return { success: true, isExternal: false, url: normalizedUrl }
    }
  }

  goBackActive(): boolean {
    const tab = this.activeTab
    if (tab?.view?.webContents.canGoBack()) { tab.view.webContents.goBack(); return true }
    return false
  }

  goForwardActive(): boolean {
    const tab = this.activeTab
    if (tab?.view?.webContents.canGoForward()) { tab.view.webContents.goForward(); return true }
    return false
  }

  reloadActive(): boolean {
    const tab = this.activeTab
    if (tab?.view) { tab.view.webContents.reload(); return true }
    return false
  }

  canGoBackActive(): boolean { return this.activeTab?.view?.webContents.canGoBack() ?? false }
  canGoForwardActive(): boolean { return this.activeTab?.view?.webContents.canGoForward() ?? false }

  async getContext(id: string): Promise<any> {
    const tab = this.tabs.get(id)
    if (!tab) throw new Error('Tab not found')
    if (!tab.isExternal || !tab.view) {
      return { id: tab.id, url: tab.url, title: tab.title, isExternal: false }
    }
    const wc = tab.view.webContents
    const url = wc.getURL()
    const title = wc.getTitle()

    // Execute JS in page to collect DOM data
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
    })()`, true)

    // Cookies (scoped to URL)
    const cookies = await wc.session.cookies.get({ url }).catch(() => [])

    // Optional screenshot
    const image = await wc.capturePage().catch(() => null)
    let screenshot: string | undefined
    if (image && !image.isEmpty()) {
      screenshot = image.toPNG().toString('base64')
    } else {
      console.warn(`[TabsManager] Captured empty screenshot for tab ${id}`)
    }

    return { id: tab.id, url, title, favicon: tab.favicon, isExternal: true, dom, cookies, screenshot }
  }

  // Internal helpers
  private ensureView(tab: TabRecord) {
    if (tab.view) return
    tab.view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
        preload: join(__dirname, 'preload-external.js')
      }
    })

    // Bounds and events
    this.updateViewBounds(tab.view)

    // Navigation and state sync
    tab.view.webContents.on('did-navigate', (_e, url) => this.onUrlChanged(tab, url))
    tab.view.webContents.on('did-navigate-in-page', (_e, url) => this.onUrlChanged(tab, url))
    tab.view.webContents.on('did-finish-load', () => mainWindow?.webContents.send('browser:navigation-complete', tab.url))
    tab.view.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
      mainWindow?.webContents.send('browser:navigation-error', { errorCode, errorDescription, url: validatedURL })
    })
    tab.view.webContents.on('page-title-updated', (_e, title) => { tab.title = title; this.emitTabsUpdated() })
    tab.view.webContents.on('page-favicon-updated', (_e, favs) => { tab.favicon = Array.isArray(favs) ? favs[0] : undefined; this.emitTabsUpdated() })

    // Context menu + target=_blank policy consistent with previous behavior
    tab.view.webContents.on('context-menu', (_, params) => {
      if (!mainWindow) return
      const menu = new Menu()
      if (params.selectionText) {
        menu.append(new MenuItem({ label: 'Ask Ron?', click: () => mainWindow?.webContents.send('agent:ask-ron', { selectionText: params.selectionText, sourceUrl: tab.url }) }))
        menu.append(new MenuItem({ type: 'separator' }))
      }
      menu.append(new MenuItem({ role: 'copy', enabled: params.editFlags.canCopy }))
      menu.append(new MenuItem({ role: 'paste', enabled: params.editFlags.canPaste }))
      menu.append(new MenuItem({ role: 'cut', enabled: params.editFlags.canCut }))
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ label: 'Back', click: () => { if (tab.view?.webContents.canGoBack()) tab.view.webContents.goBack() }, enabled: tab.view?.webContents.canGoBack() }))
      menu.append(new MenuItem({ label: 'Forward', click: () => { if (tab.view?.webContents.canGoForward()) tab.view.webContents.goForward() }, enabled: tab.view?.webContents.canGoForward() }))
      menu.append(new MenuItem({ label: 'Reload', click: () => tab.view?.webContents.reload() }))
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ label: 'Inspect Element', click: () => tab.view?.webContents.inspectElement(params.x, params.y) }))
      menu.popup()
    })

    tab.view.webContents.setWindowOpenHandler(details => { shell.openExternal(details.url); return { action: 'deny' } })
  }

  private onUrlChanged(tab: TabRecord, url: string) {
    tab.url = url
    if (this._activeTabId === tab.id) mainWindow?.webContents.send('browser:url-changed', url)
  }

  attachIfActive(tab: TabRecord) {
    if (!mainWindow || this._activeTabId !== tab.id || !tab.view) return
    const contentView = mainWindow.contentView
    if (!contentView.children.includes(tab.view)) contentView.addChildView(tab.view)
    this.updateViewBounds(tab.view)
    mainWindow.webContents.send('browser:external-mode', true)
    this.focusVisibleSurface(tab)
  }

  updateViewBounds(view: WebContentsView) {
    if (!mainWindow) return
    const bounds = calculateWebContentsViewBounds()
    view.setBounds(bounds)
  }

  updateActiveViewBounds() {
    const v = this.activeTab?.view
    if (v) this.updateViewBounds(v)
  }

  emitTabsUpdated() { mainWindow?.webContents.send('tabs:updated', this.list()) }

  // DO NOT MODIFY WITHOUT EXPLICIT APPROVAL FROM TIM HUNTER.
  // This enforces that automation targets only what the user can see.
  private focusVisibleSurface(tab: TabRecord) {
    if (!mainWindow) return
    if (tab.isExternal && tab.view && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.focus()
      return
    }
    if (!mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.focus()
    }
  }
}

const tabsManager = new TabsManager()

// ============================================
// WebContentsView Helpers (bounds only)
// ============================================

/**
 * Calculate the bounds for the WebContentsView based on window size and panel state
 */
function calculateWebContentsViewBounds(): { x: number; y: number; width: number; height: number } {
  if (!mainWindow) return { x: 0, y: CHROME_HEIGHT, width: 800, height: 600 }

  const [windowWidth, windowHeight] = mainWindow.getSize()
  const panelWidth = isAgentPanelOpen ? AGENT_PANEL_WIDTH : 0

  return {
    x: 0,
    y: CHROME_HEIGHT,
    width: windowWidth - panelWidth,
    height: windowHeight - CHROME_HEIGHT,
  }
}

/**
 * Update WebContentsView bounds (call on resize or panel toggle)
 */
function updateWebContentsViewBounds(): void {
  if (!mainWindow) return
  tabsManager.updateActiveViewBounds()
}


/**
 * Check if a URL is an internal ron:// protocol URL
 */
function isInternalUrl(url: string): boolean {
  return url.startsWith('ron://') || url === '' || url === 'about:blank'
}

/**
 * Normalize URL for navigation (add https:// if missing)
 */
function normalizeUrl(url: string): string {
  // Internal URLs
  if (isInternalUrl(url)) return url

  // Already has protocol
  if (url.startsWith('http://') || url.startsWith('https://')) return url

  // Add https:// by default
  return `https://${url}`
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  createWindow()
  // Create an initial tab so renderer has something to render/sync
  tabsManager.create('tab-initial', 'ron://home')
  tabsManager.switch('tab-initial')
  await startMcpBridge(tabsManager)

  // Initialize Tool Management System (if feature flag enabled)
  if (process.env.ENABLE_PYTHON_TOOL_MANAGEMENT === 'true') {
    console.log('[Main] Initializing Python Tool Management System...')
    registerToolManagerIPC()
    
    // Register tool execution IPC handler
    ipcMain.handle('tools:execute', async (_, toolName: string, args: Record<string, unknown>) => {
      const tools = getDiscoveredTools()
      const tool = tools.find(t => t.name === toolName)
      
      if (!tool) {
        return {
          success: false,
          error: `Tool not found: ${toolName}`,
          result: { status: 'error', content: [{ text: `Tool not found: ${toolName}` }] }
        }
      }
      
      // Security check
      const securityCheck = await performSecurityCheck(tool, args)
      if (!securityCheck.allowed) {
        return {
          success: false,
          error: securityCheck.errors.join(', '),
          result: { status: 'error', content: [{ text: securityCheck.errors.join(', ') }] }
        }
      }
      
      // Log and execute
      await logExecutionStart(tool, securityCheck.sanitizedArgs || args)
      const result = await executeToolInSandbox(tool, securityCheck.sanitizedArgs || args)
      await logExecutionComplete(tool, result.success, result.duration, result.error)
      
      return result
    })
    
    await initializeToolManager((tools) => {
      mainWindow?.webContents.send('tools:inventory-updated', tools)
    })
    console.log('[Main] Python Tool Management System ready')
  }
})

app.on('window-all-closed', () => {
  // Clean up tool management resources
  if (process.env.ENABLE_PYTHON_TOOL_MANAGEMENT === 'true') {
    stopWatcher()
    terminateAllWorkers()
  }
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// ============================================
// IPC Handlers - Window Controls
// ============================================

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow?.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on('window-close', () => {
  mainWindow?.close()
})

// ============================================
// IPC Handlers - Theme
// ============================================

ipcMain.handle('get-theme', () => {
  return currentTheme
})

ipcMain.handle('set-theme', (_, theme: 'light' | 'dark' | 'glass' | 'system') => {
  currentTheme = theme

  if (!mainWindow) return theme

  if (theme === 'glass') {
    // Glass mode - enable native blur effects
    if (process.platform === 'darwin') {
      // macOS: Use native vibrancy with NSVisualEffectView
      // 'light' gives a bright, luminous glass effect
      mainWindow.setVibrancy('sidebar')
      mainWindow.setBackgroundColor('#00000000')
    } else if (process.platform === 'win32') {
      // Windows 11: Use native acrylic/mica material
      // @ts-ignore - setBackgroundMaterial exists on Windows
      mainWindow.setBackgroundMaterial?.('acrylic')
      mainWindow.setBackgroundColor('#00000000')
    } else {
      // Linux: Transparency only (no native blur support)
      mainWindow.setBackgroundColor('#00000000')
    }
  } else {
    // Non-glass modes - disable vibrancy/material
    if (process.platform === 'darwin') {
      mainWindow.setVibrancy(null)
    } else if (process.platform === 'win32') {
      // @ts-ignore
      mainWindow.setBackgroundMaterial?.('none')
    }
    mainWindow.setBackgroundColor(theme === 'dark' ? '#0A0A0A' : '#FFFFFF')
  }

  return theme
})

// ============================================
// IPC Handlers - Authentication
// ============================================

ipcMain.handle('auth:store-tokens', async (_, tokens: StoredTokens) => {
  try {
    cachedTokens = tokens
    // In production, encrypt and persist tokens
    if (safeStorage.isEncryptionAvailable()) {
      // Could use electron-store here for persistent storage
      return { success: true }
    }
    return { success: true }
  } catch (error) {
    console.error('Failed to store tokens:', error)
    return { success: false, error: 'Failed to store tokens' }
  }
})

ipcMain.handle('auth:get-tokens', async () => {
  return cachedTokens
})

ipcMain.handle('auth:clear-tokens', async () => {
  cachedTokens = null
  return { success: true }
})

ipcMain.handle('auth:is-encryption-available', async () => {
  return safeStorage.isEncryptionAvailable()
})

// ============================================
// IPC Handlers - Agent Communication
// ============================================

// Store active stream connections
const activeStreams = new Map<string, AbortController>()

ipcMain.handle('agent:start-stream', async (_event, streamId: string, request: {
  url: string
  method: string
  headers: Record<string, string>
  body: string
}) => {
  const controller = new AbortController()
  activeStreams.set(streamId, controller)

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      mainWindow?.webContents.send('agent:stream-error', streamId, {
        code: `HTTP_${response.status}`,
        message: errorData.message || response.statusText,
        status: response.status,
      })
      return { success: false }
    }

    if (!response.body) {
      mainWindow?.webContents.send('agent:stream-error', streamId, {
        code: 'NO_BODY',
        message: 'Response body is null',
        status: 0,
      })
      return { success: false }
    }

    // Notify connected
    mainWindow?.webContents.send('agent:stream-connected', streamId)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // Process remaining buffer
        if (buffer.trim()) {
          processSSEBuffer(streamId, buffer)
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      
      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        processSSELine(streamId, line)
      }
    }

    mainWindow?.webContents.send('agent:stream-complete', streamId)
    return { success: true }

  } catch (error: any) {
    if (error.name === 'AbortError') {
      mainWindow?.webContents.send('agent:stream-aborted', streamId)
    } else {
      mainWindow?.webContents.send('agent:stream-error', streamId, {
        code: 'STREAM_ERROR',
        message: error.message || 'Stream failed',
        status: 0,
      })
    }
    return { success: false }
  } finally {
    activeStreams.delete(streamId)
  }
})

ipcMain.handle('agent:abort-stream', async (_, streamId: string) => {
  const controller = activeStreams.get(streamId)
  if (controller) {
    controller.abort()
    activeStreams.delete(streamId)
    return { success: true }
  }
  return { success: false, error: 'Stream not found' }
})

ipcMain.handle('agent:abort-all-streams', async () => {
  for (const [, controller] of activeStreams) {
    controller.abort()
  }
  activeStreams.clear()
  return { success: true }
})

function processSSEBuffer(streamId: string, buffer: string): void {
  const lines = buffer.split('\n')
  for (const line of lines) {
    processSSELine(streamId, line)
  }
}

function processSSELine(streamId: string, line: string): void {
  const trimmedLine = line.trim()
  
  // Skip empty lines and comments
  if (!trimmedLine || trimmedLine.startsWith(':')) {
    return
  }

  // Parse SSE data field
  if (trimmedLine.startsWith('data:')) {
    const data = trimmedLine.slice(5).trim()
    
    // Handle [DONE] marker
    if (data === '[DONE]') {
      return
    }

    try {
      const event = JSON.parse(data)
      mainWindow?.webContents.send('agent:stream-event', streamId, event)
    } catch {
      // If not JSON, send as plain text
      mainWindow?.webContents.send('agent:stream-event', streamId, { data })
    }
  }
}

// ============================================
// IPC Handlers - Voice Agent
// ============================================

let voiceAgentProcess: ChildProcess | null = null
let voiceAgentStdoutBuffer = ''
let voiceAgentStopRequested = false
let lastVoiceAgentApiKey: string | undefined
let appQuitting = false

// Helper to gracefully kill the voice agent process (SIGTERM then SIGKILL fallback)
function killVoiceAgent(timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    if (!voiceAgentProcess) return resolve(false)

    voiceAgentStopRequested = true

    const proc = voiceAgentProcess
    const pid = proc.pid
    let finished = false
    let forceTimer: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (finished) return
      finished = true
      if (forceTimer) clearTimeout(forceTimer)
      voiceAgentProcess = null
      voiceAgentStdoutBuffer = ''
      resolve(true)
    }

    // If the process exits on its own, clean up
    proc.once('exit', () => {
      cleanup()
    })

    // Try graceful shutdown first
    try {
      proc.kill('SIGTERM')
    } catch (_) {
      return cleanup()
    }

    // Fallback to SIGKILL after timeout
    forceTimer = setTimeout(() => {
      if (finished) return
      try {
        if (pid) process.kill(pid, 'SIGKILL')
      } catch (_) {
        // ignore
      }
    }, timeoutMs)
  })
}

async function startVoiceAgent(apiKey?: string): Promise<{ success: boolean; pid?: number; error?: string }> {
  try {
    // If already running, return existing pid
    if (voiceAgentProcess && voiceAgentProcess.pid) {
      return { success: true, pid: voiceAgentProcess.pid }
    }

    // Avoid restart loop during quit
    if (appQuitting) return { success: false, error: 'App is quitting' }

    // Reset stop flag for a fresh start
    voiceAgentStopRequested = false
    lastVoiceAgentApiKey = apiKey

    // Get the agents directory path
    const agentsPath = app.isPackaged
      ? join(process.resourcesPath, 'agents')
      : join(__dirname, '..', '..', 'agents')

    const agentScriptPath = join(agentsPath, 'voice_onboarding', 'agent.py')

    // Find Python executable - use venv if available
    const venvPython = app.isPackaged
      ? join(process.resourcesPath, 'venv', 'bin', 'python')
      : join(__dirname, '..', '..', 'venv', 'bin', 'python')

    // Fall back to system Python if venv doesn't exist
    const pythonPath = require('fs').existsSync(venvPython)
      ? venvPython
      : (process.platform === 'win32' ? 'python' : 'python3')

    console.log('[Voice Agent] Using Python:', pythonPath)
    console.log('[Voice Agent] Script:', agentScriptPath)

    // Set up environment with API key
    const env = { ...process.env }
    if (apiKey) {
      env.GOOGLE_API_KEY = apiKey
      env.GEMINI_API_KEY = apiKey
      env.GOOGLE_AI_API_KEY = apiKey
    }

    // Spawn the Python process
    voiceAgentProcess = spawn(pythonPath, [agentScriptPath], {
      env,
      cwd: join(agentsPath, 'voice_onboarding')
    })

    // Handle stdout - agent output
    voiceAgentProcess.stdout?.on('data', (data) => {
      // Python stdout can arrive in arbitrary chunks. We treat it as newline-delimited JSON.
      voiceAgentStdoutBuffer += data.toString('utf8')

      const lines = voiceAgentStdoutBuffer.split('\n')
      voiceAgentStdoutBuffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue

        try {
          const event = JSON.parse(line)
          mainWindow?.webContents.send('voice-agent:event', event)
        } catch {
          // Non-JSON logs or partial output
          mainWindow?.webContents.send('voice-agent:output', rawLine)
        }
      }
    })

    // Handle stderr - errors
    voiceAgentProcess.stderr?.on('data', (data) => {
      const error = data.toString()
      console.error('[Voice Agent Error]:', error)
      mainWindow?.webContents.send('voice-agent:error', error)
    })

    // Handle process exit
    voiceAgentProcess.on('exit', (code, signal) => {
      console.log(`[Voice Agent] Process exited with code ${code}, signal ${signal}`)
      mainWindow?.webContents.send('voice-agent:stopped', { code, signal })

      voiceAgentProcess = null
      voiceAgentStdoutBuffer = ''

      const wasRequested = voiceAgentStopRequested || appQuitting
      voiceAgentStopRequested = false

      if (!wasRequested) {
        console.log('[Voice Agent] Unexpected exit; restarting...')
        setTimeout(() => {
          // Avoid restart if app quit in the meantime
          if (!appQuitting) {
            startVoiceAgent(lastVoiceAgentApiKey).catch((err) => console.error('[Voice Agent] Restart failed:', err))
          }
        }, 500)
      }
    })

    return { success: true, pid: voiceAgentProcess.pid }
  } catch (error) {
    console.error('[Voice Agent] Failed to start:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

ipcMain.handle('voice-agent:start', async (_event, apiKey?: string) => {
  return startVoiceAgent(apiKey)
})

ipcMain.handle('voice-agent:stop', async () => {
  if (voiceAgentProcess) {
    voiceAgentStopRequested = true
    await killVoiceAgent()
    return { success: true }
  }
  return { success: false, error: 'No active voice agent process' }
})

// Clean up on app quit
app.on('before-quit', () => {
  appQuitting = true
  void killVoiceAgent()
})

// Also clean up when window is closed
app.on('window-all-closed', () => {
  appQuitting = true
  void killVoiceAgent()
})

// ============================================
// IPC Handlers - Tab Management
// ============================================

ipcMain.handle('create-tab', async (_event, url?: string, clientTabId?: string) => {
  const rec = tabsManager.create(clientTabId, url || 'ron://home')
  return { tabId: rec.id, url: rec.url }
})

ipcMain.handle('close-tab', async (_event, tabId: string) => {
  const ok = tabsManager.close(tabId)
  return { success: ok }
})

ipcMain.handle('switch-tab', async (_event, tabId: string) => {
  const ok = tabsManager.switch(tabId)
  return { success: ok }
})

ipcMain.handle('tabs:list', async () => {
  return tabsManager.list()
})

ipcMain.handle('tabs:get-context', async (_event, tabId: string) => {
  try {
    const ctx = await tabsManager.getContext(tabId)
    return { success: true, context: ctx }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to get context' }
  }
})

// ============================================
// IPC Handlers - Browser Navigation
// ============================================

ipcMain.handle('browser:navigate', async (_event, url: string) => {
  try {
    const result = tabsManager.navigateActive(url)
    return result
  } catch (error) {
    console.error('[Browser] Navigation error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Navigation failed' }
  }
})

ipcMain.handle('browser:search', async (_, query: string) => {
  try {
    // Use internal search page (ron://search?q=<query>)
    const searchUrl = `ron://search?q=${encodeURIComponent(query)}`
    const result = tabsManager.navigateActive(searchUrl)
    return { success: result.success, url: searchUrl, isExternal: false }
  } catch (error) {
    console.error('[Browser] Search error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    }
  }
})

ipcMain.handle('browser:go-back', async () => {
  try {
    return tabsManager.goBackActive() ? { success: true } : { success: false, error: 'Cannot go back' }
  } catch (error) {
    return { success: false, error: 'Navigation failed' }
  }
})

ipcMain.handle('browser:go-forward', async () => {
  try {
    return tabsManager.goForwardActive() ? { success: true } : { success: false, error: 'Cannot go forward' }
  } catch (error) {
    return { success: false, error: 'Navigation failed' }
  }
})

ipcMain.handle('browser:reload', async () => {
  try {
    return tabsManager.reloadActive() ? { success: true } : { success: false, error: 'Reload failed' }
  } catch (error) {
    return { success: false, error: 'Reload failed' }
  }
})

ipcMain.handle('browser:get-url', async () => {
  return tabsManager.activeTab?.url || 'ron://home'
})

ipcMain.handle('browser:can-go-back', async () => {
  return tabsManager.canGoBackActive()
})

ipcMain.handle('browser:can-go-forward', async () => {
  return tabsManager.canGoForwardActive()
})

// ============================================
// IPC Handlers - Agent Panel State
// ============================================

ipcMain.handle('browser:set-panel-open', async (_event, isOpen: boolean) => {
  isAgentPanelOpen = isOpen
  updateWebContentsViewBounds()
  return { success: true }
})

// ============================================
// IPC Handlers - Browser Content Interaction (IPC-based)
// These route ALL content interactions through the active tab's
// WebContentsView.webContents using documented Electron APIs:
//   - webContents.executeJavaScript()
//   - webContents.capturePage()
//   - webContents.getURL()
//   - webContents.getTitle()
// ============================================

/**
 * Helper: get the active external tab's webContents, or null.
 */
function getActiveTabWebContents(): Electron.WebContents | null {
  const tab = tabsManager.activeTab
  if (!tab?.isExternal || !tab.view) return null
  const wc = tab.view.webContents
  if (wc.isDestroyed()) return null
  return wc
}

ipcMain.handle('browser:click', async (_event, selector: string) => {
  const wc = getActiveTabWebContents()
  if (!wc) return { success: false, error: 'No active external tab' }
  try {
    await wc.executeJavaScript(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Element not found: ' + ${JSON.stringify(selector)});
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      el.click();
      return true;
    })()`, true)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Click failed' }
  }
})

ipcMain.handle('browser:type', async (_event, selector: string, text: string, opts?: { clear?: boolean }) => {
  const wc = getActiveTabWebContents()
  if (!wc) return { success: false, error: 'No active external tab' }
  try {
    const clear = opts?.clear ?? true
    await wc.executeJavaScript(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Element not found: ' + ${JSON.stringify(selector)});
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      el.focus();
      if (${clear}) {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.value = ${JSON.stringify(text)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`, true)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Type failed' }
  }
})

ipcMain.handle('browser:screenshot', async () => {
  const wc = getActiveTabWebContents()
  if (!wc) return { success: false, error: 'No active external tab' }
  try {
    const image = await wc.capturePage()
    if (image.isEmpty()) {
      return { success: false, error: 'Captured empty screenshot' }
    }
    // Resize to max 1280px wide to keep payload small for the agent model
    const size = image.getSize()
    const maxWidth = 1280
    let resized = image
    if (size.width > maxWidth) {
      const scale = maxWidth / size.width
      resized = image.resize({ width: maxWidth, height: Math.round(size.height * scale) })
    }
    // JPEG at 60% quality — keeps payload under ~100KB typically
    const base64 = resized.toJPEG(60).toString('base64')
    return { success: true, data: base64, format: 'jpeg' }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Screenshot failed' }
  }
})

ipcMain.handle('browser:get-text', async () => {
  const wc = getActiveTabWebContents()
  if (!wc) return { success: false, error: 'No active external tab' }
  try {
    const text = await wc.executeJavaScript(`document.body ? document.body.innerText : ''`, true)
    return { success: true, text }
  } catch (e: any) {
    return { success: false, error: e?.message || 'getText failed' }
  }
})

ipcMain.handle('browser:get-html', async () => {
  const wc = getActiveTabWebContents()
  if (!wc) return { success: false, error: 'No active external tab' }
  try {
    const html = await wc.executeJavaScript(`document.documentElement ? document.documentElement.outerHTML : ''`, true)
    return { success: true, html }
  } catch (e: any) {
    return { success: false, error: e?.message || 'getHTML failed' }
  }
})

ipcMain.handle('browser:evaluate', async (_event, script: string) => {
  const wc = getActiveTabWebContents()
  if (!wc) return { success: false, error: 'No active external tab' }
  try {
    const result = await wc.executeJavaScript(script, true)
    return { success: true, result }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Evaluate failed' }
  }
})

ipcMain.handle('browser:wait-for-selector', async (_event, selector: string, timeoutMs: number = 10000) => {
  const wc = getActiveTabWebContents()
  if (!wc) return { success: false, error: 'No active external tab' }
  try {
    const found = await wc.executeJavaScript(`new Promise((resolve, reject) => {
      const deadline = Date.now() + ${timeoutMs};
      const check = () => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el) return resolve(true);
        if (Date.now() > deadline) return reject(new Error('Timeout waiting for ' + ${JSON.stringify(selector)}));
        requestAnimationFrame(check);
      };
      check();
    })`, true)
    return { success: true, found }
  } catch (e: any) {
    return { success: false, error: e?.message || 'waitForSelector failed' }
  }
})

ipcMain.handle('browser:get-active-url', async () => {
  const wc = getActiveTabWebContents()
  if (!wc) return { success: false, error: 'No active external tab' }
  return { success: true, url: wc.getURL() }
})

ipcMain.handle('browser:get-active-title', async () => {
  const wc = getActiveTabWebContents()
  if (!wc) return { success: false, error: 'No active external tab' }
  return { success: true, title: wc.getTitle() }
})

// ============================================
// IPC Handlers - Legacy Navigation (kept for compatibility)
// ============================================

ipcMain.handle('navigate', async (_, url: string) => {
  // Redirect to new handler
  return ipcMain.emit('browser:navigate', null, url)
})

ipcMain.handle('go-back', async () => {
  return ipcMain.emit('browser:go-back', null)
})

ipcMain.handle('go-forward', async () => {
  return ipcMain.emit('browser:go-forward', null)
})

ipcMain.handle('reload', async () => {
  return ipcMain.emit('browser:reload', null)
})

// ============================================
// IPC Handlers - Agent Sandbox
// ============================================

/**
 * Get the sandbox root directory for agent file/shell operations.
 * All agent operations are restricted to this directory.
 */
function getSandboxRoot(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'agent-sandbox')
}

/**
 * Ensure sandbox directory exists.
 */
function ensureSandboxExists(): string {
  const sandboxRoot = getSandboxRoot()
  const fs = require('fs')
  if (!fs.existsSync(sandboxRoot)) {
    fs.mkdirSync(sandboxRoot, { recursive: true })
    console.log('[Sandbox] Created sandbox directory:', sandboxRoot)
  }
  return sandboxRoot
}

/**
 * Validate and resolve path within sandbox, preventing traversal attacks.
 */
function resolveSandboxPath(relativePath: string): { success: boolean; path?: string; error?: string } {
  const sandboxRoot = ensureSandboxExists()
  const path = require('path')
  
  // Strip leading slashes to make it relative
  const cleanPath = relativePath.replace(/^[/\\]+/, '')
  
  // Resolve full path
  const fullPath = path.normalize(path.join(sandboxRoot, cleanPath))
  
  // Security check: ensure path is within sandbox
  if (!fullPath.startsWith(path.normalize(sandboxRoot))) {
    return { success: false, error: `Path traversal blocked: '${relativePath}' resolves outside sandbox` }
  }
  
  return { success: true, path: fullPath }
}

// Get sandbox root path
ipcMain.handle('sandbox:get-root', async () => {
  return { success: true, root: ensureSandboxExists() }
})

// Execute shell command in sandbox (with timeout)
ipcMain.handle('sandbox:shell', async (_, command: string, args: string[] = [], options: { timeout?: number; noOutputTimeout?: number } = {}) => {
  const sandboxRoot = ensureSandboxExists()
  const { spawn } = require('child_process')
  const maxTimeout = 30000
  const maxNoOutputTimeout = 15000
  const requestedTimeout = Number.isFinite(options.timeout) ? options.timeout! : maxTimeout
  const timeout = Math.min(Math.max(requestedTimeout, 1000), maxTimeout)
  const requestedNoOutputTimeout = Number.isFinite(options.noOutputTimeout) ? options.noOutputTimeout! : maxNoOutputTimeout
  const noOutputTimeout = Math.min(Math.max(requestedNoOutputTimeout, 1000), maxNoOutputTimeout)
  
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let noOutputTimedOut = false
    let resolved = false
    let outputSeen = false
    let killTimer: NodeJS.Timeout | null = null
    let timer: NodeJS.Timeout | null = null
    let noOutputTimer: NodeJS.Timeout | null = null
    
    const child = spawn(command, args, {
      cwd: sandboxRoot,
      shell: true,
      detached: true,
      env: {
        ...process.env,
        HOME: sandboxRoot, // Restrict HOME to sandbox
        PWD: sandboxRoot,
      }
    })

    const terminate = (signal: NodeJS.Signals) => {
      if (!child.pid) return
      try {
        process.kill(-child.pid, signal)
      } catch {
        try { child.kill(signal) } catch {}
      }
    }

    const clearNoOutputTimer = () => {
      if (noOutputTimer) {
        clearTimeout(noOutputTimer)
        noOutputTimer = null
      }
    }

    const finalize = (payload: { success: boolean; error?: string; stdout: string; stderr: string; exitCode: number }) => {
      if (resolved) return
      resolved = true
      if (timer) clearTimeout(timer)
      if (!timedOut && !noOutputTimedOut && killTimer) clearTimeout(killTimer)
      clearNoOutputTimer()
      child.stdout?.removeAllListeners('data')
      child.stderr?.removeAllListeners('data')
      child.removeAllListeners('close')
      child.removeAllListeners('error')
      resolve(payload)
    }
    
    // Set timeout
    timer = setTimeout(() => {
      if (resolved) return
      timedOut = true
      terminate('SIGTERM')
      killTimer = setTimeout(() => terminate('SIGKILL'), 1000)
      finalize({
        success: false,
        error: `Command timed out after ${timeout}ms`,
        stdout,
        stderr,
        exitCode: -1
      })
    }, timeout)

    noOutputTimer = setTimeout(() => {
      if (resolved || outputSeen) return
      noOutputTimedOut = true
      terminate('SIGTERM')
      killTimer = setTimeout(() => terminate('SIGKILL'), 1000)
      finalize({
        success: false,
        error: `Command produced no output after ${noOutputTimeout}ms`,
        stdout,
        stderr,
        exitCode: -1
      })
    }, noOutputTimeout)
    
    child.stdout?.on('data', (data: Buffer) => {
      if (!outputSeen) {
        outputSeen = true
        clearNoOutputTimer()
      }
      stdout += data.toString()
    })
    
    child.stderr?.on('data', (data: Buffer) => {
      if (!outputSeen) {
        outputSeen = true
        clearNoOutputTimer()
      }
      stderr += data.toString()
    })
    
    child.on('close', (code: number | null) => {
      if (timedOut) {
        finalize({
          success: false,
          error: `Command timed out after ${timeout}ms`,
          stdout,
          stderr,
          exitCode: -1
        })
      } else {
        finalize({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code ?? -1,
          error: code !== 0 ? `Command exited with code ${code}` : undefined
        })
      }
    })
    
    child.on('error', (err: Error) => {
      finalize({
        success: false,
        error: err.message,
        stdout,
        stderr,
        exitCode: -1
      })
    })
  })
})

// Read file from sandbox
ipcMain.handle('sandbox:read-file', async (_, filePath: string) => {
  const resolved = resolveSandboxPath(filePath)
  if (!resolved.success || !resolved.path) {
    return { success: false, error: resolved.error }
  }
  
  try {
    const fs = require('fs')
    if (!fs.existsSync(resolved.path)) {
      return { success: false, error: `File not found: ${filePath}` }
    }
    const content = fs.readFileSync(resolved.path, 'utf-8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: `Error reading file: ${error}` }
  }
})

// Write file to sandbox
ipcMain.handle('sandbox:write-file', async (_, filePath: string, content: string) => {
  const resolved = resolveSandboxPath(filePath)
  if (!resolved.success || !resolved.path) {
    return { success: false, error: resolved.error }
  }
  
  try {
    const fs = require('fs')
    const path = require('path')
    
    // Ensure parent directory exists
    const dirname = path.dirname(resolved.path)
    if (!fs.existsSync(dirname)) {
      // Security check for parent directory too (redundant but safe)
      if (!dirname.startsWith(ensureSandboxExists())) {
         return { success: false, error: "Parent directory traversal blocked" }
      }
      fs.mkdirSync(dirname, { recursive: true })
    }
    
    fs.writeFileSync(resolved.path, content, 'utf-8')
    return { success: true, path: filePath }
  } catch (error) {
    return { success: false, error: `Error writing file: ${error}` }
  }
})

// List files in sandbox directory
ipcMain.handle('sandbox:list-files', async (_, relativePath: string = '') => {
  const resolved = resolveSandboxPath(relativePath || '.')
  if (!resolved.success) return { success: false, error: resolved.error }
  
  const fs = require('fs')
  const path = require('path')
  
  try {
    if (!fs.existsSync(resolved.path)) {
      return { success: false, error: 'Directory not found' }
    }
    
    const entries = fs.readdirSync(resolved.path, { withFileTypes: true })
    const files = entries.map((entry: any) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'dir' : 'file',
      size: entry.isFile() ? fs.statSync(path.join(resolved.path, entry.name)).size : undefined
    }))
    
    return { success: true, files }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})
