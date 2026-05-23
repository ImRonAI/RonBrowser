/**
 * Tool Executor - Sandboxed Python Tool Execution
 * 
 * Executes Python tools in an isolated UtilityProcess sandbox.
 * The UtilityProcess spawns Python via child_process.spawn.
 * 
 * Architecture:
 * Main Process -> UtilityProcess (utility-runner.js) -> child_process.spawn -> Python
 * 
 * Security benefits:
 * - UtilityProcess runs in isolated OS-level sandbox
 * - Crash isolation: Python crashes don't affect main process
 * - Controlled IPC via message passing
 */

import { utilityProcess, UtilityProcess, app } from 'electron'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ToolInfo } from './tool-manager'

// ============================================
// Configuration
// ============================================

const FEATURE_FLAG = process.env.ENABLE_PYTHON_TOOL_MANAGEMENT === 'true'
const DEFAULT_TIMEOUT = 7000 // 7 seconds (fast tool timeout)

// ============================================
// Types
// ============================================

export interface ExecutionResult {
  success: boolean
  exitCode: number
  result: {
    status: 'success' | 'error'
    content: Array<{ text?: string; json?: unknown }>
    toolUseId?: string
    traceback?: string
  }
  stdout: string
  stderr: string
  duration: number
  error?: string
}

interface PendingExecution {
  resolve: (result: ExecutionResult) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
  stdout: string
  stderr: string
  startTime: number
}

// ============================================
// State
// ============================================

// Pool of UtilityProcess workers (for concurrent execution)
let workerPool: UtilityProcess[] = []
const pendingExecutions = new Map<string, PendingExecution>()

// ============================================
// Lazy-evaluated paths (to avoid calling app.* before ready)
// ============================================

let _utilityRunnerPath: string | null = null
let _pythonPath: string | null = null

function getUtilityRunnerPath(): string {
  if (_utilityRunnerPath === null) {
    _utilityRunnerPath = app.isPackaged
      ? join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'utility-runner.js')
      : join(__dirname, 'utility-runner.js')
  }
  return _utilityRunnerPath
}

function getPythonPath(): string {
  if (_pythonPath === null) {
    const venvPython = app.isPackaged
      ? join(process.resourcesPath, 'bundled_python', 'python')
      : join(__dirname, '..', '..', 'venv', 'bin', 'python')
    
    if (!app.isPackaged) {
      try {
        require('fs').accessSync(venvPython)
        _pythonPath = venvPython
      } catch {
        _pythonPath = process.platform === 'win32' ? 'python' : 'python3'
      }
    } else {
      _pythonPath = venvPython
    }
  }
  return _pythonPath
}

/**
 * Create a new UtilityProcess worker
 */
function createWorker(): UtilityProcess {
  const utilityRunnerPath = getUtilityRunnerPath()
  
  console.log('[ToolExecutor] Creating worker with script:', utilityRunnerPath)
  
  const worker = utilityProcess.fork(utilityRunnerPath, [], {
    stdio: 'pipe',
    serviceName: 'python-tool-executor'
  })

  // Handle messages from the worker
  worker.on('message', (msg: any) => {
    const pending = pendingExecutions.get(msg.requestId)
    if (!pending) return

    switch (msg.type) {
      case 'stdout':
        pending.stdout += msg.data
        break
        
      case 'stderr':
        pending.stderr += msg.data
        break
        
      case 'complete':
        clearTimeout(pending.timeout)
        pendingExecutions.delete(msg.requestId)
        pending.resolve({
          success: msg.success,
          exitCode: msg.exitCode,
          result: msg.result,
          stdout: msg.stdout,
          stderr: msg.stderr,
          duration: msg.duration
        })
        break
        
      case 'error':
        clearTimeout(pending.timeout)
        pendingExecutions.delete(msg.requestId)
        pending.resolve({
          success: false,
          exitCode: -1,
          result: {
            status: 'error',
            content: [{ text: msg.message }]
          },
          stdout: pending.stdout,
          stderr: pending.stderr,
          duration: Date.now() - pending.startTime,
          error: msg.message
        })
        break
    }
  })

  // Handle worker exit
  worker.on('exit', (code) => {
    console.log(`[ToolExecutor] Worker exited with code: ${code}`)
    
    // Clean up any pending executions for this worker
    for (const [requestId, pending] of pendingExecutions.entries()) {
      clearTimeout(pending.timeout)
      pending.resolve({
        success: false,
        exitCode: code ?? -1,
        result: {
          status: 'error',
          content: [{ text: 'Worker process exited unexpectedly' }]
        },
        stdout: pending.stdout,
        stderr: pending.stderr,
        duration: Date.now() - pending.startTime,
        error: 'Worker process exited'
      })
      pendingExecutions.delete(requestId)
    }

    // Remove from pool
    const idx = workerPool.indexOf(worker)
    if (idx >= 0) {
      workerPool.splice(idx, 1)
    }
  })

  return worker
}

/**
 * Get an available worker or create a new one
 */
function getWorker(): UtilityProcess {
  // For now, use a single worker approach
  // TODO: Implement worker pooling for concurrent execution
  if (workerPool.length === 0) {
    workerPool.push(createWorker())
  }
  return workerPool[0]
}

// ============================================
// Execution
// ============================================

/**
 * Execute a Python tool in the sandboxed UtilityProcess.
 * 
 * @param toolInfo - Tool metadata from discovery
 * @param args - Arguments to pass to the tool
 * @param timeout - Execution timeout in milliseconds (default 7 seconds)
 * @returns ExecutionResult with success status and tool output
 */
export async function executeToolInSandbox(
  toolInfo: ToolInfo,
  args: Record<string, unknown> = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<ExecutionResult> {
  if (!FEATURE_FLAG) {
    return {
      success: false,
      exitCode: -1,
      result: {
        status: 'error',
        content: [{ text: 'Python tool management is disabled' }]
      },
      stdout: '',
      stderr: '',
      duration: 0,
      error: 'Feature disabled'
    }
  }

  const requestId = randomUUID()
  const worker = getWorker()

  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    // Set up timeout
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

    // Track pending execution
    pendingExecutions.set(requestId, {
      resolve,
      reject,
      timeout: timeoutHandle,
      stdout: '',
      stderr: '',
      startTime
    })

    // Send execution request to worker
    worker.postMessage({
      type: 'executePythonTool',
      requestId,
      pythonPath: getPythonPath(),
      loadToolPath: '', // Not using load_tool.py wrapper for now
      toolPath: toolInfo.executablePath,
      toolName: toolInfo.name,
      args,
      env: {}
    })
  })
}

/**
 * Execute a tool by name (looks up from discovered tools)
 */
export async function executeToolByName(
  toolName: string,
  args: Record<string, unknown> = {},
  discoveredTools: ToolInfo[]
): Promise<ExecutionResult> {
  const tool = discoveredTools.find(t => t.name === toolName)
  
  if (!tool) {
    return {
      success: false,
      exitCode: -1,
      result: {
        status: 'error',
        content: [{ text: `Tool not found: ${toolName}` }]
      },
      stdout: '',
      stderr: '',
      duration: 0,
      error: 'Tool not found'
    }
  }

  return executeToolInSandbox(tool, args)
}

// ============================================
// Cleanup
// ============================================

/**
 * Terminate all workers (call on app quit)
 */
export function terminateAllWorkers(): void {
  for (const worker of workerPool) {
    try {
      worker.kill()
    } catch (err) {
      console.error('[ToolExecutor] Error killing worker:', err)
    }
  }
  workerPool = []
  
  // Clear pending executions
  for (const [_requestId, pending] of pendingExecutions.entries()) {
    clearTimeout(pending.timeout)
    pending.resolve({
      success: false,
      exitCode: -1,
      result: {
        status: 'error',
        content: [{ text: 'Executor terminated' }]
      },
      stdout: pending.stdout,
      stderr: pending.stderr,
      duration: Date.now() - pending.startTime,
      error: 'Terminated'
    })
  }
  pendingExecutions.clear()
}
