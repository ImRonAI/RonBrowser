/**
 * Tool Classifier
 * 
 * Maps tool names from the agent's tool catalog to specialized AI Element
 * component types. This is the single source of truth for determining
 * which component renders each tool.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tool Categories
// ─────────────────────────────────────────────────────────────────────────────

export type ToolCategory =
  | 'terminal'         // Shell/bash/exec → Terminal component
  | 'environment'      // Env vars, secrets → EnvironmentVariables component
  | 'schema'           // GET/API fetch, describe → SchemaDisplay component
  | 'code'             // File read/write/edit → CodeBlock component (wrapped in Task)
  | 'file-tree'        // List files, directory tree → FileTree component
  | 'browser'          // Playwright, browser navigate → ChainOfThoughtBrowser + PreviewPanel
  | 'desktop'          // Computer use, screen → ChainOfThoughtDesktop
  | 'search'           // Web search, perplexity → ChainOfThoughtSearch
  | 'retrieval'        // Memory, RAG, vector, db → ChainOfThoughtRetrieval
  | 'orchestration'    // Workflow/swarm/graph → AgentFormationAccordion
  | 'attachment'       // File upload/download → Attachments component
  | 'medical'          // FDA, PubMed, drug tools → specialized medical rendering
  | 'generic'          // Fallback → minimal Tool component

// ─────────────────────────────────────────────────────────────────────────────
// Pattern Matchers (order matters — first match wins)
// ─────────────────────────────────────────────────────────────────────────────

const TERMINAL_PATTERNS = [
  'bash', 'shell', 'terminal', 'exec', 'execute', 'run_command',
  'command', 'subprocess', 'spawn', 'sh', 'zsh', 'powershell',
  'run_script', 'system', 'cmd',
  // Strands built-in
  'code_interpreter', 'python_repl',
]

const ENVIRONMENT_PATTERNS = [
  'env', 'environment', 'secret', 'config', 'dotenv',
  'get_env', 'set_env', 'list_env', 'environment_variable',
  'ssm', 'parameter_store', 'vault',
]

const SCHEMA_PATTERNS = [
  'http_request', 'http_get', 'api_get', 'describe', 'schema',
  'openapi', 'swagger', 'rest_api', 'graphql', 'endpoint',
  'list_tools', 'tool_info', 'get_tool', 'tool_catalog',
]

const CODE_PATTERNS = [
  'read_file', 'write_file', 'edit_file', 'create_file',
  'file_read', 'file_write', 'file_edit', 'file_create',
  'editor',
  'patch', 'modify_file', 'update_file', 'save_file',
  'code_edit', 'code_write', 'str_replace_editor',
  'insert_code', 'replace_code',
]

const FILE_TREE_PATTERNS = [
  'list_files', 'list_directory', 'tree', 'file_tree',
  'ls', 'dir', 'find_files', 'glob', 'list_dir',
  'directory_tree', 'project_structure',
]

const BROWSER_PATTERNS = [
  // Playwright MCP (subagent)
  'playwright_navigate', 'playwright_screenshot', 'playwright_click',
  'playwright_type', 'playwright_scroll', 'playwright_fill',
  'playwright_select', 'playwright_hover', 'playwright_wait',
  'playwright_evaluate', 'playwright_go_back', 'playwright_go_forward',
  'playwright_press', 'playwright_pdf',
  'playwright_iframe_click', 'playwright_iframe_fill',
  'electron_embed_browser',
  // Generic browser
  'browser_navigate', 'browser_click', 'browser_screenshot',
  'browser_type', 'browser_scroll', 'browser_extract',
  'navigate', 'scrape', 'browser',
  // Bright Data web scraping
  'scraping_browser', 'web_scraper',
]

const DESKTOP_PATTERNS = [
  'computer_use', 'computer', 'screen',
  'screenshot', // screenshot is more desktop than browser in computer-use context
  'mouse_click', 'mouse_move', 'mouse_drag',
  'keyboard_type', 'keyboard_press',
  'launch_app', 'switch_app',
]

const SEARCH_PATTERNS = [
  'search', 'web_search', 'perplexity', 'google_search',
  'bing_search', 'tavily', 'serp', 'duckduckgo',
  'brave_search', 'exa_search', 'exa_find',
  'bright_data_search',
]

const RETRIEVAL_PATTERNS = [
  // Memory / RAG
  'mem0', 'memory', 'remember', 'recall', 'retrieve',
  // Vector store
  'vector_search', 'embedding_search', 'semantic_search',
  'similarity_search', 'rag',
  // Knowledge base
  'knowledge_base', 'kb_search',
]

const ORCHESTRATION_PATTERNS = [
  'workflow', 'swarm', 'graph', 'batch',
  'use_agent',
]

const ATTACHMENT_PATTERNS = [
  'upload', 'download', 'attachment', 'file_upload',
  'file_download', 'save_attachment',
]

const MEDICAL_PATTERNS = [
  // FDA tools (25+)
  'fda_drug', 'fda_label', 'fda_event', 'fda_recall', 'fda_ndc',
  'fda_enforcement', 'fda_device', 'fda_food',
  'openfda', 'drug_interaction', 'drug_lookup',
  'ndc_lookup', 'rxnorm', 'snomed', 'icd10',
  'clinical_trial', 'clinicaltrials',
  // PubMed patterns (matched by search first, but medical fallback)
  'pubmed',
]

// ── Exact-match tool name overrides (bypasses pattern matching) ──────────
// Use this for tools that would be misclassified by fuzzy matching.
const EXACT_TOOL_OVERRIDES: Record<string, ToolCategory> = {
  // The 'get' prefix is too broad for schema — these specific tools must be classified correctly
  'shell': 'terminal',
  'editor': 'code',
  'file_read': 'code',
  'environment': 'environment',
  'http_request': 'schema',
  'tool_catalog': 'schema',
  'mem0_memory': 'retrieval',
  'use_agent': 'orchestration',
  'workflow': 'orchestration',
  'swarm': 'orchestration',
  'graph': 'orchestration',
  'batch': 'orchestration',
  'browser': 'browser',
  'code_interpreter': 'terminal',
  // Emit tools render via data-parts, not CoT tool rendering — mark generic
  'emit_plan': 'generic',
  'emit_queue': 'generic',
  'emit_jsx': 'generic',
}

// ─────────────────────────────────────────────────────────────────────────────
// Classifier
// ─────────────────────────────────────────────────────────────────────────────

function matchesPatterns(toolName: string, patterns: string[]): boolean {
  const normalized = toolName.toLowerCase()
  // Split on common delimiters to get segments
  const segments = normalized.split(/[./:\\\s_-]+/g).filter(Boolean)
  
  return patterns.some(pattern => {
    const patternLower = pattern.toLowerCase()
    // Check if any segment matches the pattern exactly
    if (segments.includes(patternLower)) return true
    // Check if the full name contains the pattern
    if (normalized.includes(patternLower)) return true
    return false
  })
}

/**
 * Classify a tool name into a rendering category.
 * Exact overrides are checked first, then pattern matching.
 * First match wins — order of checks determines priority.
 */
export function classifyTool(toolName: string | undefined): ToolCategory {
  if (!toolName) return 'generic'
  
  // Exact overrides (highest priority)
  const exact = EXACT_TOOL_OVERRIDES[toolName.toLowerCase()]
  if (exact) return exact
  
  // Orchestration (most specific multi-agent patterns)
  if (matchesPatterns(toolName, ORCHESTRATION_PATTERNS)) return 'orchestration'
  
  // Desktop / computer-use tools (before browser to disambiguate screenshot)
  if (matchesPatterns(toolName, DESKTOP_PATTERNS)) return 'desktop'
  
  // Browser tools (before search, since some overlap)
  if (matchesPatterns(toolName, BROWSER_PATTERNS)) return 'browser'
  
  // Search tools
  if (matchesPatterns(toolName, SEARCH_PATTERNS)) return 'search'
  
  // Retrieval / memory / RAG
  if (matchesPatterns(toolName, RETRIEVAL_PATTERNS)) return 'retrieval'
  
  // Medical / FDA tools
  if (matchesPatterns(toolName, MEDICAL_PATTERNS)) return 'medical'
  
  // Terminal/shell execution
  if (matchesPatterns(toolName, TERMINAL_PATTERNS)) return 'terminal'
  
  // File tree / directory listing
  if (matchesPatterns(toolName, FILE_TREE_PATTERNS)) return 'file-tree'
  
  // Code file operations (after file-tree so list_files doesn't match)
  if (matchesPatterns(toolName, CODE_PATTERNS)) return 'code'
  
  // Environment variables
  if (matchesPatterns(toolName, ENVIRONMENT_PATTERNS)) return 'environment'
  
  // Schema / API GET
  if (matchesPatterns(toolName, SCHEMA_PATTERNS)) return 'schema'
  
  // Attachments
  if (matchesPatterns(toolName, ATTACHMENT_PATTERNS)) return 'attachment'
  
  return 'generic'
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers for extracting structured data from tool I/O
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unwrap the new Strands tool output shape.
 *
 * After the aisdk_stream.py fix, `toolPart.output` is now the full tool_result
 * dict (minus toolUseId/name):
 *   { status: "success", content: [{text: "..."}], __ui_data__: {type, data} }
 *
 * This helper extracts `__ui_data__.data` and the raw `content` text items
 * so extract functions can use the clean structured data first, falling back
 * to content items or legacy shapes.
 */
function unwrapToolOutput(output: unknown): {
  uiData: Record<string, unknown> | null
  uiType: string | null
  contentTexts: string[]
  raw: unknown
} {
  if (!output || typeof output !== 'object') {
    return { uiData: null, uiType: null, contentTexts: [], raw: output }
  }
  const out = output as Record<string, unknown>

  // Extract __ui_data__
  let uiData: Record<string, unknown> | null = null
  let uiType: string | null = null
  const uiBlock = out.__ui_data__
  if (uiBlock && typeof uiBlock === 'object') {
    const block = uiBlock as Record<string, unknown>
    uiType = typeof block.type === 'string' ? block.type : null
    uiData = block.data && typeof block.data === 'object'
      ? block.data as Record<string, unknown>
      : null
  }

  // Extract content text items
  const contentTexts: string[] = []
  if (Array.isArray(out.content)) {
    for (const item of out.content) {
      if (item && typeof item === 'object' && typeof (item as any).text === 'string') {
        contentTexts.push((item as any).text)
      }
    }
  }

  return { uiData, uiType, contentTexts, raw: output }
}

/** Extract terminal output from tool result */
export function extractTerminalOutput(input: unknown, output: unknown): { command: string; output: string } {
  const inp = input as Record<string, unknown> | undefined

  const command = typeof inp?.command === 'string'
    ? inp.command
    : typeof inp?.cmd === 'string'
      ? inp.cmd
      : typeof inp?.script === 'string'
        ? inp.script
        : typeof input === 'string'
          ? input
          : ''

  const { uiData, uiType, contentTexts, raw } = unwrapToolOutput(output)

  // 1. Prefer __ui_data__ structured data (shell.py returns {command, output, exit_code, status})
  if (uiType === 'terminal' && uiData) {
    const termCommand = typeof uiData.command === 'string' ? uiData.command : command
    const termOutput = typeof uiData.output === 'string' ? uiData.output : ''
    return {
      command: termCommand,
      output: termCommand ? `$ ${termCommand}\n${termOutput}` : termOutput,
    }
  }

  // 2. Fall back to content text items (join all)
  if (contentTexts.length > 0) {
    const outputText = contentTexts.join('\n')
    return { command, output: command ? `$ ${command}\n${outputText}` : outputText }
  }

  // 3. Legacy shape: output is a plain string or simple object
  let outputText = ''
  if (typeof raw === 'string') {
    outputText = raw
  } else if (raw && typeof raw === 'object') {
    const out = raw as Record<string, unknown>
    outputText = typeof out.output === 'string'
      ? out.output
      : typeof out.stdout === 'string'
        ? out.stdout + (typeof out.stderr === 'string' ? '\n' + out.stderr : '')
        : typeof out.result === 'string'
          ? out.result
          : JSON.stringify(out, null, 2)
  }

  return { command, output: command ? `$ ${command}\n${outputText}` : outputText }
}

/** Extract environment variables from tool result */
export function extractEnvironmentVars(output: unknown): Array<{ name: string; value: string }> {
  if (!output || typeof output !== 'object') return []

  const { uiData, uiType } = unwrapToolOutput(output)

  // 1. Prefer __ui_data__ structured data (environment.py returns {variables: [{name, value, protected}], count, action})
  if (uiType === 'environment' && uiData) {
    if (Array.isArray(uiData.variables)) {
      return (uiData.variables as any[])
        .filter((v: any) => v?.name != null)
        .map((v: any) => ({ name: String(v.name), value: String(v.value ?? '') }))
    }
  }

  // 2. Legacy: direct array format [{ name, value }]
  if (Array.isArray(output)) {
    return (output as any[])
      .filter((item: any) => item?.name && item?.value)
      .map((item: any) => ({ name: String(item.name), value: String(item.value) }))
  }

  // 3. Legacy: object format { variables: [...] } or { KEY: VALUE }
  const out = output as Record<string, unknown>
  const vars = (out.variables || out.env || out) as Record<string, unknown>
  if (Array.isArray(vars)) {
    return (vars as any[])
      .filter((v: any) => v?.name != null)
      .map((v: any) => ({ name: String(v.name), value: String(v.value ?? '') }))
  }
  if (typeof vars === 'object' && vars !== null && !Array.isArray(vars)) {
    return Object.entries(vars)
      .filter(([key, v]) => key !== '__ui_data__' && key !== 'status' && key !== 'content' && (typeof v === 'string' || typeof v === 'number'))
      .map(([name, value]) => ({ name, value: String(value) }))
  }

  return []
}

/** Schema parameter shape matching the SchemaDisplay component API */
export type SchemaParameter = {
  name: string
  type: string
  required?: boolean
  description?: string
  location?: 'path' | 'query' | 'header'
}

/** Schema property shape matching the SchemaDisplay component API */
export type SchemaProperty = {
  name: string
  type: string
  required?: boolean
  description?: string
  properties?: SchemaProperty[]
  items?: SchemaProperty
}

export type SchemaInfo = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  description?: string
  parameters?: SchemaParameter[]
  requestBody?: SchemaProperty[]
  responseBody?: SchemaProperty[]
}

/** Extract schema info from API/GET tool result */
export function extractSchemaInfo(input: unknown, output?: unknown): SchemaInfo | null {
  const inp = input as Record<string, unknown> | undefined
  if (!inp) return null
  
  const url = typeof inp.url === 'string' ? inp.url
    : typeof inp.path === 'string' ? inp.path
    : typeof inp.endpoint === 'string' ? inp.endpoint
    : null
  
  if (!url) return null
  
  const method = (typeof inp.method === 'string'
    ? inp.method.toUpperCase()
    : 'GET') as SchemaInfo['method']
  
  const result: SchemaInfo = {
    method,
    path: url,
    description: typeof inp.description === 'string' ? inp.description : undefined,
  }

  // Extract parameters from input if available
  if (Array.isArray(inp.parameters)) {
    result.parameters = (inp.parameters as any[])
      .filter((p: any) => p?.name)
      .map((p: any) => ({
        name: String(p.name),
        type: String(p.type || 'string'),
        required: Boolean(p.required),
        description: typeof p.description === 'string' ? p.description : undefined,
        location: (['path', 'query', 'header'].includes(p.location) ? p.location : undefined) as SchemaParameter['location'],
      }))
  }

  // Extract request body from input if available
  if (Array.isArray(inp.requestBody) || Array.isArray(inp.request_body) || Array.isArray(inp.body)) {
    const bodyArr = (inp.requestBody || inp.request_body || inp.body) as any[]
    result.requestBody = extractSchemaProperties(bodyArr)
  }

  // Extract response body from output if available
  if (output && typeof output === 'object') {
    const out = output as Record<string, unknown>
    if (Array.isArray(out.responseBody) || Array.isArray(out.response_body) || Array.isArray(out.schema)) {
      const responseArr = (out.responseBody || out.response_body || out.schema) as any[]
      result.responseBody = extractSchemaProperties(responseArr)
    }
  }

  return result
}

function extractSchemaProperties(arr: any[]): SchemaProperty[] {
  return arr
    .filter((p: any) => p?.name)
    .map((p: any) => {
      const prop: SchemaProperty = {
        name: String(p.name),
        type: String(p.type || 'string'),
        required: Boolean(p.required),
        description: typeof p.description === 'string' ? p.description : undefined,
      }
      if (Array.isArray(p.properties)) {
        prop.properties = extractSchemaProperties(p.properties)
      }
      if (p.items && typeof p.items === 'object') {
        prop.items = {
          name: String(p.items.name || 'item'),
          type: String(p.items.type || 'string'),
          description: typeof p.items.description === 'string' ? p.items.description : undefined,
        }
      }
      return prop
    })
}

/** Extract code file info from tool result */
export function extractCodeInfo(input: unknown, output: unknown): {
  filename: string
  code: string
  language: string
} | null {
  const inp = input as Record<string, unknown> | undefined
  const out = output as Record<string, unknown> | string | undefined
  
  const filepath = typeof inp?.path === 'string' ? inp.path
    : typeof inp?.file === 'string' ? inp.file
    : typeof inp?.filepath === 'string' ? inp.filepath
    : typeof inp?.filename === 'string' ? inp.filename
    : typeof inp?.file_path === 'string' ? inp.file_path
    : null
  
  if (!filepath) return null
  
  // Get code content from input (write/edit) or output (read)
  let code = ''
  if (typeof inp?.content === 'string') code = inp.content
  else if (typeof inp?.code === 'string') code = inp.code
  else if (typeof inp?.new_str === 'string') code = inp.new_str
  else if (typeof out === 'string') code = out
  else if (out && typeof out === 'object') {
    if (typeof (out as any).content === 'string') code = (out as any).content
    else if (typeof (out as any).text === 'string') code = (out as any).text
    else code = JSON.stringify(out, null, 2)
  }
  
  // Detect language from extension
  const ext = filepath.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
    cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
    swift: 'swift', kt: 'kotlin', scala: 'scala',
    html: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml',
    md: 'markdown', sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash',
    dockerfile: 'dockerfile', makefile: 'makefile',
  }
  const language = langMap[ext] || 'text'
  
  return { filename: filepath, code, language }
}

/** Tree node type for hierarchical file tree rendering */
export type FileTreeNode = {
  path: string
  name: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
}

/** Extract file tree from tool result and build hierarchical structure */
export function extractFileTree(output: unknown): FileTreeNode[] | null {
  if (!output) return null
  
  // Parse flat items first
  let flatItems: Array<{ path: string; name: string; type: 'file' | 'folder' }> = []
  
  // String output: parse line-by-line tree output
  if (typeof output === 'string') {
    const lines = output.split('\n').filter(Boolean)
    flatItems = lines.map(line => {
      const trimmed = line.replace(/^[│├└─\s|`]+/, '').trim()
      const isFolder = trimmed.endsWith('/') || !trimmed.includes('.')
      return {
        path: trimmed.replace(/\/$/, ''),
        name: trimmed.replace(/\/$/, '').split('/').pop() || trimmed,
        type: isFolder ? 'folder' as const : 'file' as const,
      }
    })
  }
  // Array of file objects
  else if (Array.isArray(output)) {
    flatItems = output.map((item: any) => ({
      path: String(item.path || item.name || item),
      name: String(item.name || item.path || item).split('/').pop() || '',
      type: (item.type === 'directory' || item.type === 'folder' || item.is_dir) ? 'folder' as const : 'file' as const,
    }))
  } else {
    return null
  }

  if (flatItems.length === 0) return null

  // Build hierarchical tree from flat paths
  return buildTreeFromPaths(flatItems)
}

/**
 * Builds a hierarchical tree from flat file paths.
 * Groups files by their parent directory segments.
 */
function buildTreeFromPaths(items: Array<{ path: string; name: string; type: 'file' | 'folder' }>): FileTreeNode[] {
  const root: FileTreeNode[] = []
  
  // Map to track created folder nodes by path for nesting
  const folderMap = new Map<string, FileTreeNode>()

  // Sort so folders come before files, and alphabetical within each
  const sorted = [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.path.localeCompare(b.path)
  })

  for (const item of sorted) {
    const segments = item.path.split('/').filter(Boolean)
    
    if (segments.length <= 1) {
      // Top-level item
      const node: FileTreeNode = {
        path: item.path,
        name: item.name || segments[0] || item.path,
        type: item.type,
        ...(item.type === 'folder' ? { children: [] } : {}),
      }
      if (item.type === 'folder') folderMap.set(item.path, node)
      root.push(node)
    } else {
      // Nested item — ensure parent folders exist
      let currentPath = ''
      let currentChildren = root

      for (let i = 0; i < segments.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${segments[i]}` : segments[i]
        
        let folderNode = folderMap.get(currentPath)
        if (!folderNode) {
          // Create intermediate folder
          folderNode = {
            path: currentPath,
            name: segments[i],
            type: 'folder',
            children: [],
          }
          folderMap.set(currentPath, folderNode)
          currentChildren.push(folderNode)
        }
        currentChildren = folderNode.children!
      }

      // Add the leaf node
      const leafNode: FileTreeNode = {
        path: item.path,
        name: segments[segments.length - 1],
        type: item.type,
        ...(item.type === 'folder' ? { children: [] } : {}),
      }
      if (item.type === 'folder') folderMap.set(item.path, leafNode)
      currentChildren.push(leafNode)
    }
  }

  return root
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor Action Extractor
// ─────────────────────────────────────────────────────────────────────────────

export type EditorAction = 'create' | 'view' | 'str_replace' | 'insert' | 'undo_edit' | 'write' | 'unknown'

export interface EditorActionInfo {
  action: EditorAction
  filename: string
  code: string
  language: string
  /** For str_replace: the old text being replaced */
  oldStr?: string
  /** For str_replace: the new text replacing it */
  newStr?: string
  /** For insert: the line number to insert at */
  insertAfterLine?: number
}

/** Extract structured editor action info from editor tool input/output */
export function extractEditorAction(input: unknown, output: unknown): EditorActionInfo | null {
  const inp = input as Record<string, unknown> | undefined
  if (!inp) return null

  // Determine the editor command (Strands editor tool uses 'command' field)
  const command = typeof inp.command === 'string' ? inp.command : null
  const action: EditorAction = command === 'create' ? 'create'
    : command === 'view' ? 'view'
    : command === 'str_replace' ? 'str_replace'
    : command === 'insert' ? 'insert'
    : command === 'undo_edit' ? 'undo_edit'
    : command === 'write' ? 'write'
    : 'unknown'

  // Resolve file path
  const filepath = typeof inp.path === 'string' ? inp.path
    : typeof inp.file === 'string' ? inp.file
    : typeof inp.filepath === 'string' ? inp.filepath
    : typeof inp.filename === 'string' ? inp.filename
    : typeof inp.file_path === 'string' ? inp.file_path
    : ''

  if (!filepath) return null

  // Detect language from extension
  const ext = filepath.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
    cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
    swift: 'swift', kt: 'kotlin', scala: 'scala',
    html: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml',
    md: 'markdown', sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash',
    dockerfile: 'dockerfile', makefile: 'makefile',
  }
  const language = langMap[ext] || 'text'

  // Get code content based on action type
  let code = ''
  const oldStr = typeof inp.old_str === 'string' ? inp.old_str : undefined
  const newStr = typeof inp.new_str === 'string' ? inp.new_str : undefined
  const insertAfterLine = typeof inp.insert_line === 'number' ? inp.insert_line : undefined

  if (action === 'create' || action === 'write') {
    code = typeof inp.file_text === 'string' ? inp.file_text
      : typeof inp.content === 'string' ? inp.content
      : typeof inp.code === 'string' ? inp.code
      : ''
  } else if (action === 'str_replace') {
    code = newStr || ''
  } else if (action === 'insert') {
    code = typeof inp.new_str === 'string' ? inp.new_str : ''
  } else if (action === 'view') {
    // For view, code comes from output
    const out = output as Record<string, unknown> | string | undefined
    if (typeof out === 'string') code = out
    else if (out && typeof out === 'object') {
      if (typeof (out as any).content === 'string') code = (out as any).content
      else if (typeof (out as any).text === 'string') code = (out as any).text
      else if (typeof (out as any).output === 'string') code = (out as any).output
    }
  }

  return {
    action,
    filename: filepath,
    code,
    language,
    oldStr,
    newStr,
    insertAfterLine,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser Action Extractor
// ─────────────────────────────────────────────────────────────────────────────

export type BrowserActionType = 'navigate' | 'click' | 'type' | 'scroll' | 'extract' | 'screenshot' | 'wait' | 'hover' | 'select' | 'fill' | 'press' | 'evaluate'

export interface BrowserActionInfo {
  action: BrowserActionType
  url?: string
  selector?: string
  value?: string
  screenshot?: string
  title?: string
}

/** Extract browser action info from playwright/browser tool input/output */
export function extractBrowserAction(toolName: string | undefined, input: unknown, output: unknown): BrowserActionInfo | null {
  const inp = input as Record<string, unknown> | undefined
  const out = output as Record<string, unknown> | undefined

  // Map tool name to action type
  let action: BrowserActionType = 'navigate'
  const name = (toolName || '').toLowerCase()
  if (name.includes('click')) action = 'click'
  else if (name.includes('fill') || name.includes('type')) action = name.includes('fill') ? 'fill' : 'type'
  else if (name.includes('scroll')) action = 'scroll'
  else if (name.includes('screenshot')) action = 'screenshot'
  else if (name.includes('hover')) action = 'hover'
  else if (name.includes('select')) action = 'select'
  else if (name.includes('wait')) action = 'wait'
  else if (name.includes('press')) action = 'press'
  else if (name.includes('extract') || name.includes('scrape')) action = 'extract'
  else if (name.includes('evaluate')) action = 'evaluate'
  else if (name.includes('navigate') || name.includes('go_to') || name.includes('go_back') || name.includes('go_forward')) action = 'navigate'

  const url = typeof inp?.url === 'string' ? inp.url
    : typeof out?.url === 'string' ? out.url
    : typeof out?.current_url === 'string' ? out.current_url
    : undefined

  const selector = typeof inp?.selector === 'string' ? inp.selector
    : typeof inp?.element === 'string' ? inp.element
    : undefined

  const value = typeof inp?.value === 'string' ? inp.value
    : typeof inp?.text === 'string' ? inp.text
    : typeof inp?.key === 'string' ? inp.key
    : undefined

  const screenshot = typeof out?.screenshot === 'string' ? out.screenshot
    : typeof out?.image === 'string' ? out.image
    : typeof out?.base64 === 'string' ? out.base64
    : undefined

  const title = typeof out?.title === 'string' ? out.title
    : typeof out?.page_title === 'string' ? out.page_title
    : undefined

  return { action, url, selector, value, screenshot, title }
}

// ─────────────────────────────────────────────────────────────────────────────
// Retrieval Extractor
// ─────────────────────────────────────────────────────────────────────────────

export type RetrievalSourceType = 'web' | 'database' | 'api' | 'vector' | 'file' | 'cache' | 'browser' | 'memory'

export interface RetrievalInfo {
  sourceType: RetrievalSourceType
  sourceName: string
  query: string
  results: Array<{
    title: string
    content?: string
    url?: string
    confidence?: number
    metadata?: Record<string, unknown>
  }>
}

/** Extract retrieval info from memory/RAG/vector tool input/output */
export function extractRetrievalInfo(toolName: string | undefined, input: unknown, output: unknown): RetrievalInfo | null {
  const inp = input as Record<string, unknown> | undefined
  const out = output as Record<string, unknown> | Array<unknown> | string | undefined

  const name = (toolName || '').toLowerCase()

  // Determine source type from tool name
  let sourceType: RetrievalSourceType = 'memory'
  if (name.includes('vector') || name.includes('embedding') || name.includes('semantic')) sourceType = 'vector'
  else if (name.includes('database') || name.includes('sql') || name.includes('db')) sourceType = 'database'
  else if (name.includes('knowledge') || name.includes('kb')) sourceType = 'file'
  else if (name.includes('cache')) sourceType = 'cache'
  else if (name.includes('mem0') || name.includes('memory') || name.includes('remember') || name.includes('recall')) sourceType = 'memory'

  // Extract query
  const query = typeof inp?.query === 'string' ? inp.query
    : typeof inp?.text === 'string' ? inp.text
    : typeof inp?.input === 'string' ? inp.input
    : typeof inp?.search === 'string' ? inp.search
    : typeof inp?.question === 'string' ? inp.question
    : typeof input === 'string' ? input
    : ''

  // Extract results from output
  let results: RetrievalInfo['results'] = []
  if (Array.isArray(out)) {
    results = out.map((item: any) => ({
      title: String(item.memory || item.title || item.text || item.content || '').slice(0, 120),
      content: item.content || item.text || item.memory || item.snippet || '',
      url: item.url || item.source || undefined,
      confidence: typeof item.score === 'number' ? item.score : typeof item.confidence === 'number' ? item.confidence : undefined,
      metadata: item.metadata || undefined,
    }))
  } else if (out && typeof out === 'object' && !Array.isArray(out)) {
    const arr = (out as Record<string, unknown>).results ||
      (out as Record<string, unknown>).memories ||
      (out as Record<string, unknown>).matches ||
      (out as Record<string, unknown>).hits
    if (Array.isArray(arr)) {
      results = arr.map((item: any) => ({
        title: String(item.memory || item.title || item.text || item.content || '').slice(0, 120),
        content: item.content || item.text || item.memory || item.snippet || '',
        url: item.url || item.source || undefined,
        confidence: typeof item.score === 'number' ? item.score : typeof item.confidence === 'number' ? item.confidence : undefined,
        metadata: item.metadata || undefined,
      }))
    }
  }

  return {
    sourceType,
    sourceName: toolName || 'Retrieval',
    query,
    results,
  }
}
