# Zone 1: Electron Core SDK Compliance Audit
**SDK:** Electron 39.x | **Audited:** 2026-05-22 | **Files audited:** `electron/main.ts`, `electron/preload.ts`, `electron/preload-external.ts`, `electron/preload-browser.ts`, `electron/browser-service.ts`, `electron/tool-executor.ts`, `electron/tool-security.ts`, `electron/tool-manager.ts`, `electron/utility-runner.js`, `electron-builder.config.js`, `check_electron.js`

## Executive Summary
Ron Browser uses modern `WebContentsView` in the active tab manager, but one scoped file still uses deprecated `BrowserView`. The highest-risk issues are privileged IPC without sender validation, untrusted web content receiving a preload bridge, arbitrary shell/Python execution paths, and unvalidated `shell.openExternal` calls. Main-window sandboxing is explicitly disabled even though the renderer exposes high-privilege APIs. Token storage is in-memory only and does not use Electron 39 `safeStorage` for durable encrypted storage. Build configuration enables ASAR but leaves signing/notarization and fuses either incomplete or UNVERIFIED against Electron SDK docs.

## Severity Legend
- 🔴 CRITICAL (security/data-loss/will break)
- 🟠 HIGH (deprecation, scalability, will break soon)
- 🟡 MEDIUM (best practice violation)
- 🟢 LOW (cleanup, minor)

## Findings

### [ELECTRON-001] Main renderer disables Chromium sandbox — 🔴 CRITICAL
- **File:** `electron/main.ts:126-131`
- **Current code:**
```ts
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
```
- **What's wrong:** The primary renderer has access to a large preload API and can be driven by app XSS or compromised dependencies. Electron 39 recommends process sandboxing in all renderers; explicitly disabling it removes Chromium's OS-level renderer sandbox.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security#4-enable-process-sandboxing — "You should enable the sandbox in all renderers. Loading, reading or processing any untrusted content in an unsandboxed process, including the main process, is not advised."
- **Required fix:** Set `sandbox: true`, keep `nodeIntegration: false`, and ensure the preload only uses sandbox-compatible Electron APIs.
- **Fixed code:**
```ts
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
```
- **Why this scales/lasts:** It aligns the root renderer with Electron's default hardening and reduces blast radius as more IPC APIs are added.

### [ELECTRON-002] External web pages receive an Electron preload bridge — 🔴 CRITICAL
- **File:** `electron/main.ts:407-414`; `electron/preload-external.ts:3-13`
- **Current code:**
```ts
    tab.view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
        preload: join(__dirname, 'preload-external.js')
      }
    })
```
```ts
contextBridge.exposeInMainWorld('electron', {
  browser: {
    navigate: (url: string): Promise<any> => ipcRenderer.invoke('browser:navigate', url),
    goBack: (): Promise<any> => ipcRenderer.invoke('browser:go-back'),
    goForward: (): Promise<any> => ipcRenderer.invoke('browser:go-forward'),
    reload: (): Promise<any> => ipcRenderer.invoke('browser:reload'),
    getUrl: (): Promise<string> => ipcRenderer.invoke('browser:get-url'),
    canGoBack: (): Promise<boolean> => ipcRenderer.invoke('browser:can-go-back'),
    canGoForward: (): Promise<boolean> => ipcRenderer.invoke('browser:can-go-forward')
  }
})
```
- **What's wrong:** Arbitrary external websites loaded in `WebContentsView` get `window.electron.browser.*` and can send IPC messages into the app. This violates Electron's guidance not to expose Electron APIs to untrusted web content. The `Promise<any>` return types also weaken preload typing.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security#20-do-not-expose-electron-apis-to-untrusted-web-content — "You should not directly expose Electron's APIs, especially IPC, to untrusted web content in your preload scripts." The same section says exposing raw IPC access is dangerous because it gives renderers access to the IPC event system.
- **Required fix:** Remove the preload from external `WebContentsView` unless a page-specific allowlist is implemented. Browser controls should remain in the trusted main renderer only.
- **Fixed code:**
```ts
    tab.view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false
      }
    })
```
```ts
// preload-external.ts
export {}
```
- **Why this scales/lasts:** Keeping untrusted pages free of IPC bridges prevents future navigation/control APIs from becoming remotely triggerable.

### [ELECTRON-003] IPC handlers do not validate `event.senderFrame` — 🔴 CRITICAL
- **File:** `electron/main.ts:622-1587`; `electron/tool-manager.ts:423-460`
- **Current code:**
```ts
ipcMain.handle('auth:store-tokens', async (_, tokens: StoredTokens) => {
  try {
    cachedTokens = tokens
```
```ts
ipcMain.handle('browser:evaluate', async (_event, script: string) => {
  const wc = getActiveTabWebContents()
```
```ts
ipcMain.handle('tools:saveCustomTool', async (_, name: string, code: string) => {
  const { writeFile } = await import('node:fs/promises')
```
- **What's wrong:** All privileged handlers accept requests without checking which frame sent them. In Electron, iframes, child windows, or untrusted external pages with a preload can send IPC, so token, shell, file, tool, and browser-control APIs must reject unexpected senders.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages — "You should always validate incoming IPC messages `sender` property to ensure you aren't performing actions or sending information to untrusted renderers." The docs further state: "You should be validating the `sender` of all IPC messages by default."
- **Required fix:** Centralize validation and call it at the top of every `ipcMain.handle` and `ipcMain.on` handler, including tool-manager handlers.
- **Fixed code:**
```ts
function validateIpcSender(frame: Electron.WebFrameMain | null): boolean {
  if (!frame) return false
  const url = new URL(frame.url)
  return url.protocol === 'file:' || url.origin === process.env.ELECTRON_RENDERER_URL
}

ipcMain.handle('auth:store-tokens', async (event, tokens: StoredTokens) => {
  if (!validateIpcSender(event.senderFrame)) return { success: false, error: 'Forbidden sender' }
  cachedTokens = tokens
  return { success: true }
})
```
- **Why this scales/lasts:** A shared guard makes future IPC additions safe by default and prevents remote frames from invoking privileged main-process functions.

### [ELECTRON-004] `shell.openExternal` opens untrusted URLs — 🔴 CRITICAL
- **File:** `electron/main.ts:166-169`, `electron/main.ts:450-451`
- **Current code:**
```ts
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
```
```ts
    tab.view.webContents.setWindowOpenHandler(details => { shell.openExternal(details.url); return { action: 'deny' } })
```
- **What's wrong:** Any page can request a new window to an arbitrary protocol and the app forwards it to the OS. Electron warns that untrusted `openExternal` input can compromise the host.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security#15-do-not-use-shellopenexternal-with-untrusted-content — "Improper use of `openExternal` can be leveraged to compromise the user's host. When openExternal is used with untrusted content, it can be leveraged to execute arbitrary commands." https://www.electronjs.org/docs/latest/api/shell#shellopenexternalurl-options — "Open the given external protocol URL in the desktop's default manner."
- **Required fix:** Parse with `URL`, allow only `https:` and explicitly approved `mailto:`/deep-link protocols, and call `openExternal` asynchronously after validation.
- **Fixed code:**
```ts
function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    return parsed.protocol === 'https:' || parsed.protocol === 'mailto:'
  } catch {
    return false
  }
}

mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  if (isSafeExternalUrl(url)) setImmediate(() => void shell.openExternal(url))
  return { action: 'deny' }
})
```
- **Why this scales/lasts:** Protocol allowlisting remains correct even as new pages are loaded and avoids OS-level protocol handler abuse.

### [ELECTRON-005] Arbitrary renderer-provided JavaScript executes in active web content — 🔴 CRITICAL
- **File:** `electron/preload.ts:221-222`; `electron/main.ts:1261-1266`
- **Current code:**
```ts
    evaluate: (script: string) =>
      ipcRenderer.invoke('browser:evaluate', script) as Promise<{ success: boolean; result?: unknown; error?: string }>,
```
```ts
ipcMain.handle('browser:evaluate', async (_event, script: string) => {
  const wc = getActiveTabWebContents()
  if (!wc) return { success: false, error: 'No active external tab' }
  try {
    const result = await wc.executeJavaScript(script, true)
```
- **What's wrong:** Any renderer compromise can execute arbitrary JavaScript in any active external page, bypassing same-origin protections and enabling credential/content exfiltration from `WebContentsView` pages.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security#20-do-not-expose-electron-apis-to-untrusted-web-content — "In short, we want the untrusted web content to only have access to necessary information and APIs." https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages — "Never trust data from the renderer."
- **Required fix:** Remove the generic evaluate IPC. Replace it with narrowly scoped, parameterized actions implemented in main or with a vetted allowlist of automation commands.
- **Fixed code:**
```ts
// preload.ts
// Removed browser.evaluate from the public API.

// main.ts
// Removed ipcMain.handle('browser:evaluate', ...). Add narrowly scoped handlers only.
```
- **Why this scales/lasts:** A command allowlist prevents future automation features from becoming a generic cross-site script execution primitive.

### [ELECTRON-006] Browser context collection exfiltrates DOM, storage, cookies, and screenshots — 🔴 CRITICAL
- **File:** `electron/main.ts:366-401`; `electron/preload.ts:271`
- **Current code:**
```ts
  async getContext(id: string): Promise<any> {
```
```ts
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
```
- **What's wrong:** A trusted-renderer API can pull sensitive site state from arbitrary external pages. Without sender validation and user mediation, this can leak cookies, local/session storage, HTML, and screenshots to any compromised renderer frame.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages — IPC that "returns user data to the sender" must ensure it is not listening to third-party frames. https://www.electronjs.org/docs/latest/tutorial/security#20-do-not-expose-electron-apis-to-untrusted-web-content — expose only necessary information and APIs.
- **Required fix:** Require sender validation, user consent, and least-privilege data selection. Do not return cookies/storage by default.
- **Fixed code:**
```ts
interface SafeTabContext {
  id: string
  url: string
  title: string
  isExternal: boolean
  text?: string
}

async getContext(id: string): Promise<SafeTabContext> {
  const tab = this.tabs.get(id)
  if (!tab) throw new Error('Tab not found')
  if (!tab.isExternal || !tab.view) return { id: tab.id, url: tab.url, title: tab.title, isExternal: false }
  const wc = tab.view.webContents
  const text = await wc.executeJavaScript(`document.body ? document.body.innerText : ''`, true)
  return { id: tab.id, url: wc.getURL(), title: wc.getTitle(), isExternal: true, text }
}
```
- **Why this scales/lasts:** Returning a small typed context avoids accidental leakage as agent features expand.

### [ELECTRON-007] Renderer-triggered shell execution uses `shell: true` — 🔴 CRITICAL
- **File:** `electron/preload.ts:365-373`; `electron/main.ts:1377-1408`
- **Current code:**
```ts
    shell: (command: string, args: string[] = [], options?: { timeout?: number; noOutputTimeout?: number }) =>
      ipcRenderer.invoke('sandbox:shell', command, args, options) as Promise<{
```
```ts
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
```
- **What's wrong:** A renderer-exposed API can start arbitrary commands through a shell. The sandbox only changes `cwd` and environment variables; it does not restrict filesystem or network access of the process, and `shell: true` enables shell metacharacter interpretation.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security — Electron apps can access "the filesystem, user shell, and more" and the docs state that these powers increase security risk. https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages — "Never trust data from the renderer."
- **Required fix:** Remove the public shell API or replace it with an allowlisted command runner using `shell: false`, strict executable names, and validated arguments.
- **Fixed code:**
```ts
const ALLOWED_SANDBOX_COMMANDS = new Set(['python3', 'node'])

ipcMain.handle('sandbox:shell', async (event, command: string, args: string[] = [], options = {}) => {
  if (!validateIpcSender(event.senderFrame)) return { success: false, error: 'Forbidden sender', stdout: '', stderr: '', exitCode: -1 }
  if (!ALLOWED_SANDBOX_COMMANDS.has(command)) return { success: false, error: 'Command not allowed', stdout: '', stderr: '', exitCode: -1 }
  const child = spawn(command, args, { cwd: sandboxRoot, shell: false, env: { HOME: sandboxRoot, PWD: sandboxRoot } })
})
```
- **Why this scales/lasts:** Command allowlists and `shell: false` keep future tooling from becoming general remote command execution.

### [ELECTRON-008] Custom tool saving permits path traversal and arbitrary code persistence — 🔴 CRITICAL
- **File:** `electron/tool-manager.ts:449-460`; `electron/preload.ts:352-354`
- **Current code:**
```ts
  saveCustomTool: (name: string, code: string) => 
    ipcRenderer.invoke('tools:saveCustomTool', name, code) as Promise<{ success: boolean; path: string }>,
```
```ts
  ipcMain.handle('tools:saveCustomTool', async (_, name: string, code: string) => {
    const { writeFile } = await import('node:fs/promises')
    const dir = getCustomToolsDir()
    await mkdir(dir, { recursive: true })
    
    const toolPath = join(dir, `${name}.py`)
    await writeFile(toolPath, code, 'utf-8')
```
- **What's wrong:** `name` is not normalized or restricted, so `../` segments can escape the custom tools directory. The renderer can persist arbitrary Python code that later participates in the tool discovery/execution flow.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages — privileged actions must validate the sender. https://www.electronjs.org/docs/latest/tutorial/security — Electron app code can access the filesystem and shell; secure coding practices are the first line of defense.
- **Required fix:** Validate sender, restrict names to a safe pattern, resolve the path and verify it remains inside the custom tools directory, and require explicit user approval before persisting executable code.
- **Fixed code:**
```ts
ipcMain.handle('tools:saveCustomTool', async (event, name: string, code: string) => {
  if (!validateIpcSender(event.senderFrame)) return { success: false, error: 'Forbidden sender' }
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) return { success: false, error: 'Invalid tool name' }
  const { writeFile } = await import('node:fs/promises')
  const { resolve, relative, sep } = await import('node:path')
  const dir = resolve(getCustomToolsDir())
  await mkdir(dir, { recursive: true })
  const toolPath = resolve(dir, `${name}.py`)
  const rel = relative(dir, toolPath)
  if (rel.startsWith('..') || rel.includes(`..${sep}`)) return { success: false, error: 'Path traversal blocked' }
  await writeFile(toolPath, code, { encoding: 'utf-8', mode: 0o600 })
  return { success: true, path: toolPath }
})
```
- **Why this scales/lasts:** Directory containment and a stable name schema prevent future tool categories from widening arbitrary file write risk.

### [ELECTRON-009] Utility runner constructs Python source with interpolated data — 🔴 CRITICAL
- **File:** `electron/utility-runner.js:57-90`; `electron/tool-executor.ts:268-278`
- **Current code:**
```js
    const pythonScript = `
import sys
import json

try:
    # Import the tool module
    import importlib.util
    spec = importlib.util.spec_from_file_location("tool_module", "${toolPath.replace(/\\/g, '\\\\')}")
```
```js
        args = json.loads('${JSON.stringify(args).replace(/'/g, "\\'")}')
        output = tool_func(**args) if args else tool_func()
```
- **What's wrong:** Tool paths, names, and args are interpolated into executable Python code passed to `python -c`. Escaping only backslashes or single quotes is not a complete code-generation defense, and custom tool names can influence the generated script.
- **SDK citation:** https://www.electronjs.org/docs/latest/api/utility-process#utilityprocessforkmodulepath-args-options — `utilityProcess.fork` creates a child process with Node.js and message ports and is equivalent to `child_process.fork` using Chromium services. The Electron security tutorial says to adopt secure coding practices because app code can access filesystem and shell.
- **Required fix:** Do not synthesize Python source from untrusted values. Pass a static runner file and serialize request data over stdin or an IPC message/file descriptor.
- **Fixed code:**
```js
const runnerPath = path.join(__dirname, 'python-tool-runner.py')
const proc = spawn(pythonPath, [runnerPath], {
  env: { ...process.env, ...env },
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: path.dirname(toolPath)
})
proc.stdin.end(JSON.stringify({ toolPath, toolName, args }))
```
- **Why this scales/lasts:** Static runner code eliminates code-in-code escaping bugs as argument schemas become more complex.

### [ELECTRON-010] Deprecated `BrowserView` remains in scoped Electron code — 🟠 HIGH
- **File:** `electron/browser-service.ts:1-7`, `electron/browser-service.ts:31-40`, `electron/browser-service.ts:197-207`
- **Current code:**
```ts
/**
 * Browser Service - Manages BrowserView for web page rendering
 * Handles URL normalization, navigation, and view bounds management
 */

import { BrowserView } from 'electron'
```
```ts
      this.browserView = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        }
      })
```
- **What's wrong:** `BrowserView` is deprecated in official Electron docs. Even if this service is not currently wired into `main.ts`, scoped source should not retain a deprecated Electron embedding path.
- **SDK citation:** https://www.electronjs.org/docs/latest/api/browser-view — "The `BrowserView` class is deprecated, and replaced by the new `WebContentsView` class." https://www.electronjs.org/docs/latest/api/web-contents-view — `WebContentsView` is "A View that displays a WebContents."
- **Required fix:** Replace `BrowserView` with `WebContentsView` and attach via `window.contentView.addChildView`, or delete this obsolete service if unused.
- **Fixed code:**
```ts
import { WebContentsView } from 'electron'

private browserView: WebContentsView | null = null

this.browserView = new WebContentsView({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
  }
})
mainWindow.contentView.addChildView(this.browserView)
```
- **Why this scales/lasts:** Migrating all code to `WebContentsView` avoids future Electron removals and keeps one embedding model.

### [ELECTRON-011] Navigation accepts insecure and arbitrary destinations — 🟠 HIGH
- **File:** `electron/main.ts:536-545`; `electron/browser-service.ts:104-111`
- **Current code:**
```ts
function normalizeUrl(url: string): string {
  // Internal URLs
  if (isInternalUrl(url)) return url

  // Already has protocol
  if (url.startsWith('http://') || url.startsWith('https://')) return url

  // Add https:// by default
  return `https://${url}`
}
```
```ts
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('file://')) {
      return trimmed
    }
```
- **What's wrong:** Main navigation accepts `http://` and the obsolete `BrowserService` accepts `file://`. Electron recommends secure content and warns against `file://` privileges. The code also lacks `will-navigate` restrictions for unexpected destinations.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security#1-only-load-secure-content — "Any resources not included with your application should be loaded using a secure protocol like HTTPS." https://www.electronjs.org/docs/latest/tutorial/security#18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols — "Pages running on `file://` have unilateral access to every file on your machine." https://www.electronjs.org/docs/latest/tutorial/security#13-disable-or-limit-navigation recommends parsing URLs and allowing only expected origins.
- **Required fix:** Reject `http:` and `file:` for external navigation, use `https:` by default, and add `will-navigate` guards for internal app surfaces.
- **Fixed code:**
```ts
function normalizeUrl(rawUrl: string): string {
  if (isInternalUrl(rawUrl)) return rawUrl
  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(rawUrl) ? rawUrl : `https://${rawUrl}`
  const parsed = new URL(candidate)
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS navigation is allowed')
  return parsed.toString()
}
```
- **Why this scales/lasts:** URL parsing avoids string-prefix bypasses and creates a single policy for future navigation paths.

### [ELECTRON-012] No permission request handler for remote sessions — 🟡 MEDIUM
- **File:** `electron/main.ts:407-415`
- **Current code:**
```ts
    tab.view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
        preload: join(__dirname, 'preload-external.js')
      }
    })
```
- **What's wrong:** Remote `WebContentsView` sessions can request permissions. The audit found no `session.setPermissionRequestHandler` for the session used by external content.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security#5-handle-session-permission-requests-from-remote-content — "By default, Electron will automatically approve all permission requests unless the developer has manually configured a custom handler."
- **Required fix:** Set a deny-by-default permission handler on the session used by external content, then allow only expected permissions for trusted origins.
- **Fixed code:**
```ts
const ses = tab.view.webContents.session
ses.setPermissionRequestHandler((webContents, permission, callback) => {
  const parsed = new URL(webContents.getURL())
  const allowed = parsed.protocol === 'https:' && parsed.host === 'trusted.example.com' && permission === 'notifications'
  callback(allowed)
})
```
- **Why this scales/lasts:** A deny-by-default permission policy remains safe as new sites and browser features request more capabilities.

### [ELECTRON-013] Token storage is only in memory and does not use `safeStorage` — 🟡 MEDIUM
- **File:** `electron/main.ts:104-108`, `electron/main.ts:685-711`
- **Current code:**
```ts
let cachedTokens: StoredTokens | null = null

// Note: encryptAndStore and decryptAndRetrieve are available for future secure token persistence
// Currently using in-memory storage; for production, integrate with electron-store
```
```ts
ipcMain.handle('auth:store-tokens', async (_, tokens: StoredTokens) => {
  try {
    cachedTokens = tokens
    // In production, encrypt and persist tokens
    if (safeStorage.isEncryptionAvailable()) {
      // Could use electron-store here for persistent storage
      return { success: true }
    }
```
- **What's wrong:** Tokens are not encrypted or persisted. The code checks `safeStorage.isEncryptionAvailable()` but does not call encryption APIs, so sessions are lost on restart and tokens remain in process memory until cleared or exit.
- **SDK citation:** https://www.electronjs.org/docs/latest/api/safe-storage — "safeStorage allows access to simple encryption and decryption of strings for storage on the local machine." The docs recommend the asynchronous API because it is non-blocking and handles key rotation/temporary unavailability.
- **Required fix:** Use `safeStorage.encryptStringAsync`/`decryptStringAsync` with a locked-down app data file, and validate IPC senders before token operations.
- **Fixed code:**
```ts
ipcMain.handle('auth:store-tokens', async (event, tokens: StoredTokens) => {
  if (!validateIpcSender(event.senderFrame)) return { success: false, error: 'Forbidden sender' }
  const encrypted = await safeStorage.encryptStringAsync(JSON.stringify(tokens))
  await fs.promises.writeFile(getTokenPath(), encrypted, { mode: 0o600 })
  cachedTokens = tokens
  return { success: true }
})
```
- **Why this scales/lasts:** OS-backed encryption survives restarts without broadening token exposure to plaintext disk storage.

### [ELECTRON-014] Sandbox path containment uses unsafe prefix matching — 🟠 HIGH
- **File:** `electron/main.ts:1354-1369`
- **Current code:**
```ts
  // Resolve full path
  const fullPath = path.normalize(path.join(sandboxRoot, cleanPath))
  
  // Security check: ensure path is within sandbox
  if (!fullPath.startsWith(path.normalize(sandboxRoot))) {
    return { success: false, error: `Path traversal blocked: '${relativePath}' resolves outside sandbox` }
  }
```
- **What's wrong:** Prefix checks can be bypassed by sibling paths that start with the same characters as the sandbox root. Use `path.resolve` plus `path.relative` containment semantics.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security — Electron applications can access filesystem and shell, and the docs instruct developers to adopt secure coding practices. https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages also requires not trusting renderer data.
- **Required fix:** Resolve both paths and reject if the relative path escapes with `..` or is absolute.
- **Fixed code:**
```ts
function resolveSandboxPath(relativePath: string): { success: boolean; path?: string; error?: string } {
  const sandboxRoot = path.resolve(ensureSandboxExists())
  const fullPath = path.resolve(sandboxRoot, relativePath.replace(/^[/\\]+/, ''))
  const rel = path.relative(sandboxRoot, fullPath)
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    return { success: false, error: `Path traversal blocked: '${relativePath}' resolves outside sandbox` }
  }
  return { success: true, path: fullPath }
}
```
- **Why this scales/lasts:** `relative`-based containment is robust across platforms and future nested file operations.

### [ELECTRON-015] Tool argument validation records errors but still copies dangerous values — 🟠 HIGH
- **File:** `electron/tool-security.ts:99-125`
- **Current code:**
```ts
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          errors.push(`Potential command injection in ${key}`)
          continue
        }
      }
    }

    sanitizedArgs[key] = value
```
- **What's wrong:** `continue` applies to the inner pattern loop, not the outer argument loop. A value matching a dangerous pattern is still assigned into `sanitizedArgs`, so callers that ignore `valid` or log/use partial data can propagate dangerous values.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security — "Adopt secure coding practices" because Electron app code has access to filesystem and shell. This finding is security-code correctness rather than a named Electron API rule.
- **Required fix:** Track a per-value rejection flag or use a labeled loop so rejected values are never copied.
- **Fixed code:**
```ts
  outer: for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      if (value.includes('..') && (key.includes('path') || key.includes('file'))) {
        errors.push(`Potential path traversal in ${key}`)
        continue outer
      }
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          errors.push(`Potential command injection in ${key}`)
          continue outer
        }
      }
    }
    sanitizedArgs[key] = value
  }
```
- **Why this scales/lasts:** Fail-closed validation prevents later tool wrappers from accidentally using known-bad inputs.

### [ELECTRON-016] Legacy navigation handlers incorrectly return `ipcMain.emit` booleans — 🟡 MEDIUM
- **File:** `electron/main.ts:1308-1323`; `electron/preload.ts:282-287`
- **Current code:**
```ts
ipcMain.handle('navigate', async (_, url: string) => {
  // Redirect to new handler
  return ipcMain.emit('browser:navigate', null, url)
})
```
```ts
  navigation: {
    navigate: (url: string) => ipcRenderer.invoke('navigate', url),
    goBack: () => ipcRenderer.invoke('go-back'),
    goForward: () => ipcRenderer.invoke('go-forward'),
    reload: () => ipcRenderer.invoke('reload'),
  },
```
- **What's wrong:** `ipcMain.emit()` emits an event and returns a boolean indicating whether listeners existed; it does not invoke the `ipcMain.handle('browser:navigate')` handler or return its result. This legacy API is exposed to the renderer and will produce incorrect behavior.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/ipc — Two-way IPC is done by using `ipcRenderer.invoke` paired with `ipcMain.handle`, and "The return value is then returned as a Promise to the original `invoke` call."
- **Required fix:** Call the underlying implementation directly or remove the legacy API.
- **Fixed code:**
```ts
ipcMain.handle('navigate', async (event, url: string) => {
  if (!validateIpcSender(event.senderFrame)) return { success: false, error: 'Forbidden sender' }
  return tabsManager.navigateActive(url)
})
```
- **Why this scales/lasts:** Direct calls preserve the `invoke`/`handle` contract and avoid subtle Boolean responses in old renderer paths.

### [ELECTRON-017] Preload and main-process APIs overuse `any` where Electron types exist — 🟡 MEDIUM
- **File:** `electron/main.ts:31`, `electron/main.ts:366`, `electron/main.ts:788`, `electron/main.ts:1072`, `electron/main.ts:1185`, `electron/tool-executor.ts:114`, `electron/preload.ts:271`, `electron/preload-external.ts:5-8`, `electron/main.ts:1577`
- **Current code:**
```ts
    let startElectronBridge: any
```
```ts
  async getContext(id: string): Promise<any> {
```
```ts
  } catch (error: any) {
```
```ts
    navigate: (url: string): Promise<any> => ipcRenderer.invoke('browser:navigate', url),
```
- **What's wrong:** `any` removes compile-time validation around high-privilege Electron IPC, webContents operations, and child-process messages. Electron provides typed event and WebContents structures that should be used or narrowed.
- **SDK citation:** https://www.electronjs.org/docs/latest/api/context-bridge — bridge parameters and return values are copied/proxied according to a supported type table, so APIs should be explicit. https://www.electronjs.org/docs/latest/api/web-contents-view documents `view.webContents` as an Electron `WebContents` property.
- **Required fix:** Define typed IPC result interfaces and use `unknown` with runtime narrowing for errors/messages.
- **Fixed code:**
```ts
interface BrowserNavigateResult { success: boolean; isExternal?: boolean; url?: string; error?: string }

navigate: (url: string): Promise<BrowserNavigateResult> => ipcRenderer.invoke('browser:navigate', url)

worker.on('message', (msg: unknown) => {
  if (!isWorkerMessage(msg)) return
  // typed handling
})
```
- **Why this scales/lasts:** Strong IPC types make breaking changes and unsafe data flows visible during builds.

### [ELECTRON-018] Tool worker timeout resolves after deleting pending state, losing captured output — 🟢 LOW
- **File:** `electron/tool-executor.ts:241-256`
- **Current code:**
```ts
    const timeoutHandle = setTimeout(() => {
      pendingExecutions.delete(requestId)
      resolve({
        success: false,
        exitCode: -1,
        result: {
          status: 'error',
          content: [{ text: `Tool execution timed out after ${timeout}ms` }]
        },
        stdout: pendingExecutions.get(requestId)?.stdout ?? '',
        stderr: pendingExecutions.get(requestId)?.stderr ?? '',
```
- **What's wrong:** The code deletes `pendingExecutions` before reading stdout/stderr from it. This is not an Electron SDK break, but it impairs diagnostics for utility-process execution.
- **SDK citation:** https://www.electronjs.org/docs/latest/api/utility-process#class-utilityprocess — `UtilityProcess` exposes `stdout`, `stderr`, and `message` events for child process communication. UNVERIFIED as a direct SDK violation; this is implementation correctness.
- **Required fix:** Capture the pending entry before deleting it.
- **Fixed code:**
```ts
    const timeoutHandle = setTimeout(() => {
      const pending = pendingExecutions.get(requestId)
      pendingExecutions.delete(requestId)
      resolve({
        success: false,
        exitCode: -1,
        result: { status: 'error', content: [{ text: `Tool execution timed out after ${timeout}ms` }] },
        stdout: pending?.stdout ?? '',
        stderr: pending?.stderr ?? '',
        duration: timeout,
        error: 'Timeout'
      })
    }, timeout)
```
- **Why this scales/lasts:** Correct timeout accounting improves observability for long-running tools.

### [ELECTRON-019] App lifecycle has duplicate `window-all-closed` listeners and non-awaited async cleanup — 🟡 MEDIUM
- **File:** `electron/main.ts:598-608`, `electron/main.ts:1033-1043`
- **Current code:**
```ts
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
```
```ts
app.on('before-quit', () => {
  appQuitting = true
  void killVoiceAgent()
})

// Also clean up when window is closed
app.on('window-all-closed', () => {
  appQuitting = true
  void killVoiceAgent()
})
```
- **What's wrong:** Cleanup is split across duplicate lifecycle listeners; `killVoiceAgent()` is asynchronous but intentionally not awaited, so process termination may race with app quit. The structure also makes future lifecycle changes error-prone.
- **SDK citation:** https://www.electronjs.org/docs/latest/api/app — the `app` module controls "your application's event lifecycle"; `window-all-closed` is emitted when all windows close, and `before-quit` can call `event.preventDefault()` to prevent default termination. UNVERIFIED against a specific Electron 39 deprecation; this is lifecycle correctness.
- **Required fix:** Consolidate lifecycle cleanup in one function and await it where the app still has an event loop.
- **Fixed code:**
```ts
async function cleanupBeforeExit(): Promise<void> {
  appQuitting = true
  stopWatcher()
  terminateAllWorkers()
  await killVoiceAgent()
}

app.on('before-quit', (event) => {
  event.preventDefault()
  cleanupBeforeExit().finally(() => app.exit(0))
})
```
- **Why this scales/lasts:** One cleanup path prevents leaks when adding more background services.

### [ELECTRON-020] Remote debugging is always enabled and allows all origins — 🔴 CRITICAL
- **File:** `electron/main.ts:73-77`
- **Current code:**
```ts
// Enable CDP (Chrome DevTools Protocol) for Playwright/browser-use connection
// This allows the Python agent to connect to this Electron instance
app.commandLine.appendSwitch('remote-debugging-port', String(CDP_PORT))
app.commandLine.appendSwitch('remote-allow-origins', '*')
```
- **What's wrong:** The application always starts Chromium remote debugging on a fixed port and allows all remote origins. This exposes browser automation/debug surfaces even outside explicit development or automation sessions.
- **SDK citation:** https://www.electronjs.org/docs/latest/api/command-line — `commandLine.appendSwitch` "Append[s] a switch (with optional `value`) to Chromium's command line" and the docs show `remote-debugging-port` as a Chromium switch. https://www.electronjs.org/docs/latest/tutorial/security#16-use-a-current-version-of-electron and #19 warn that command-line/runtime switches can change security behavior and fuses such as `nodeCliInspect`/`runAsNode` can enable command execution paths. This exact CDP exposure pattern is UNVERIFIED as a named Electron SDK vulnerability, but it is a high-risk hardening issue.
- **Required fix:** Gate remote debugging behind an explicit development/automation environment flag, bind only to loopback defaults, use a random available port where possible, and do not set `remote-allow-origins: '*'` in production.
- **Fixed code:**
```ts
if (!app.isPackaged && process.env.ENABLE_ELECTRON_CDP === 'true') {
  app.commandLine.appendSwitch('remote-debugging-port', String(CDP_PORT))
}
```
- **Why this scales/lasts:** Debug protocols remain available for trusted local automation without exposing every production app launch.

### [ELECTRON-021] Build config security posture is incomplete/UNVERIFIED for distribution hardening — 🟡 MEDIUM
- **File:** `electron-builder.config.js:25-40`, `electron-builder.config.js:43-69`
- **Current code:**
```js
  asar: true,
  asarUnpack: [
    'bundled_python/**/*',
    'python_scripts/**/*'
  ],
  
  // macOS configuration
  mac: {
    category: 'public.app-category.productivity',
    target: ['dmg', 'zip'],
    icon: 'public/favicon.png',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist'
  },
```
- **What's wrong:** ASAR is enabled, but Python and scripts are unpacked and executable; no notarization identity/team settings are visible; Windows signing is not configured; Electron fuses are not configured. The SDK-compliance risk is UNVERIFIED because these settings are primarily electron-builder distribution concerns rather than Electron runtime APIs.
- **SDK citation:** https://www.electronjs.org/docs/latest/tutorial/security#19-check-which-fuses-you-can-change — fuses like `runAsNode` and `nodeCliInspect` "can be used to execute commands on the device through your application." Electron SDK docs do not define electron-builder signing/notarization fields; mark those portions UNVERIFIED against SDK.
- **Required fix:** Add fuse hardening in the build pipeline, document signing/notarization requirements, and ensure unpacked executables/scripts are integrity-checked at runtime.
- **Fixed code:**
```js
// Example direction; exact implementation depends on the packaging pipeline.
// Add @electron/fuses afterPack step to disable runAsNode/nodeCliInspect,
// configure mac notarization and Windows code signing in CI secrets,
// and integrity-check files listed in asarUnpack before execution.
```
- **Why this scales/lasts:** Distribution hardening protects every installed copy and reduces abuse of Electron runtime switches.

## Cleanup Items
- `electron/main.ts.backup` exists and is explicitly ignored by this audit; delete after confirming no unique code is needed.
- `electron_main_old.ts` exists and is explicitly ignored by this audit; delete after confirming no unique code is needed.
- `electron/preload-browser.ts` is a deprecated reference-only stub; consider deleting after verifying no build entry references it.
- `electron/browser-service.ts` appears superseded by `TabsManager` in `electron/main.ts`; if unused, delete rather than keep deprecated `BrowserView` code.
- `check_electron.js` is a root-level diagnostic script that prints Electron object/version details; keep only if it is part of a documented support workflow.

## Sources & Citations
1. https://www.electronjs.org/docs/latest/tutorial/security — accessed 2026-05-22. Relevant excerpts: Electron apps can access "the filesystem, user shell, and more"; displaying arbitrary untrusted content is a severe security risk; "Adopt secure coding practices."
2. https://www.electronjs.org/docs/latest/tutorial/security#2-do-not-enable-nodejs-integration-for-remote-content — accessed 2026-05-22. Quote: "do not enable Node.js integration in any renderer (`BrowserWindow`, `WebContentsView`, or `<webview>`) that loads remote content."
3. https://www.electronjs.org/docs/latest/tutorial/security#3-enable-context-isolation — accessed 2026-05-22. Quote: "Even when `nodeIntegration: false` is used, to truly enforce strong isolation and prevent the use of Node primitives `contextIsolation` must also be used."
4. https://www.electronjs.org/docs/latest/tutorial/security#4-enable-process-sandboxing — accessed 2026-05-22. Quote: "You should enable the sandbox in all renderers."
5. https://www.electronjs.org/docs/latest/tutorial/security#5-handle-session-permission-requests-from-remote-content — accessed 2026-05-22. Quote: "By default, Electron will automatically approve all permission requests unless the developer has manually configured a custom handler."
6. https://www.electronjs.org/docs/latest/tutorial/security#6-do-not-disable-websecurity — accessed 2026-05-22. Quote: "Do not disable `webSecurity` in production applications."
7. https://www.electronjs.org/docs/latest/tutorial/security#7-define-a-content-security-policy — accessed 2026-05-22. Quote: Electron recommends CSP be enabled by any website loaded inside Electron.
8. https://www.electronjs.org/docs/latest/tutorial/security#8-do-not-enable-allowrunninginsecurecontent — accessed 2026-05-22. Quote: Setting `allowRunningInsecureContent` to `true` disables mixed-content protection.
9. https://www.electronjs.org/docs/latest/tutorial/security#13-disable-or-limit-navigation — accessed 2026-05-22. Quote: "Navigation is a common attack vector" and URL parsing/allowlisting is recommended.
10. https://www.electronjs.org/docs/latest/tutorial/security#14-disable-or-limit-creation-of-new-windows — accessed 2026-05-22. Quote: register a window open handler, validate URLs, and deny unexpected window creation.
11. https://www.electronjs.org/docs/latest/tutorial/security#15-do-not-use-shellopenexternal-with-untrusted-content — accessed 2026-05-22. Quote: untrusted `openExternal` "can be leveraged to execute arbitrary commands."
12. https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages — accessed 2026-05-22. Quote: "You should be validating the `sender` of all IPC messages by default."
13. https://www.electronjs.org/docs/latest/tutorial/security#18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols — accessed 2026-05-22. Quote: `file://` pages have "unilateral access to every file on your machine."
14. https://www.electronjs.org/docs/latest/tutorial/security#19-check-which-fuses-you-can-change — accessed 2026-05-22. Quote: fuses like `runAsNode` and `nodeCliInspect` can allow command execution through the application.
15. https://www.electronjs.org/docs/latest/tutorial/security#20-do-not-expose-electron-apis-to-untrusted-web-content — accessed 2026-05-22. Quote: "You should not directly expose Electron's APIs, especially IPC, to untrusted web content in your preload scripts."
16. https://www.electronjs.org/docs/latest/api/browser-view — accessed 2026-05-22. Quote: "The `BrowserView` class is deprecated, and replaced by the new `WebContentsView` class."
17. https://www.electronjs.org/docs/latest/api/web-contents-view — accessed 2026-05-22. Quote: `WebContentsView` is "A View that displays a WebContents" and is created with optional `webPreferences`.
18. https://www.electronjs.org/docs/latest/tutorial/ipc — accessed 2026-05-22. Quote: two-way IPC uses `ipcRenderer.invoke` paired with `ipcMain.handle`; preload should expose limited wrappers rather than whole `ipcRenderer`.
19. https://www.electronjs.org/docs/latest/api/context-bridge — accessed 2026-05-22. Quote: `contextBridge.exposeInMainWorld(apiKey, api)` injects an API onto `window[apiKey]`; supported bridge values are copied/frozen or functions proxied.
20. https://www.electronjs.org/docs/latest/api/shell#shellopenexternalurl-options — accessed 2026-05-22. Quote: `shell.openExternal` opens the given external protocol URL in the desktop's default manner.
21. https://www.electronjs.org/docs/latest/api/utility-process — accessed 2026-05-22. Quote: `utilityProcess.fork` creates a child process with Node.js and message ports and can only be called after app `ready`.
22. https://www.electronjs.org/docs/latest/api/safe-storage — accessed 2026-05-22. Quote: `safeStorage` provides encryption/decryption for local storage and recommends asynchronous encryption APIs.
23. https://www.electronjs.org/docs/latest/api/command-line — accessed 2026-05-22. Quote: `commandLine.appendSwitch` appends Chromium switches such as `remote-debugging-port`; intended usage is controlling Chromium behavior.
24. https://www.electronjs.org/docs/latest/api/app — accessed 2026-05-22. Quote: the `app` module controls "your application's event lifecycle"; `window-all-closed` is emitted when all windows close; `before-quit` can prevent default termination.
