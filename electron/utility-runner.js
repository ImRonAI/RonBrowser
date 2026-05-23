/**
 * Utility Runner - UtilityProcess Entry Point
 * 
 * This Node.js script runs inside Electron's UtilityProcess sandbox.
 * It receives messages from the main process and spawns Python tools
 * using child_process.spawn, capturing stdout/stderr and reporting
 * results back via parentPort.postMessage.
 * 
 * Architecture:
 * Main Process -> UtilityProcess (this script) -> child_process.spawn -> Python
 */

const { parentPort } = require('electron')
const { spawn } = require('child_process')
const path = require('path')

const PYTHON_TOOL_RUNNER = String.raw`
import sys
import json
import importlib.util
import traceback

try:
    request = json.load(sys.stdin)
    tool_path = request.get('toolPath')
    tool_name = request.get('toolName')
    args = request.get('args') or {}

    spec = importlib.util.spec_from_file_location('tool_module', tool_path)
    if spec is None or spec.loader is None:
        raise RuntimeError('Unable to load tool module')
    tool_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tool_module)

    tool_func = None
    for name, obj in vars(tool_module).items():
        if (callable(obj) and hasattr(obj, '__wrapped__')) or name == tool_name:
            tool_func = obj
            break

    if tool_func is None:
        for name, obj in vars(tool_module).items():
            if callable(obj) and not name.startswith('_') and name != 'tool':
                tool_func = obj
                break

    if tool_func is None:
        result = {'status': 'error', 'content': [{'text': 'No callable tool function found in module'}]}
    else:
        output = tool_func(**args) if args else tool_func()
        if isinstance(output, dict) and 'status' in output:
            result = output
        else:
            result = {'status': 'success', 'content': [{'text': str(output)}]}
except Exception as e:
    result = {
        'status': 'error',
        'content': [{'text': f'Error executing tool: {str(e)}'}],
        'traceback': traceback.format_exc()
    }

print(json.dumps(result))
`

// Handle messages from the main process
parentPort.on('message', async (msg) => {
  if (msg.type === 'executePythonTool') {
    await executePythonTool(msg)
  } else if (msg.type === 'ping') {
    parentPort.postMessage({ type: 'pong', timestamp: Date.now() })
  }
})

/**
 * Execute a Python tool via subprocess
 * 
 * @param {Object} msg - Message from main process
 * @param {string} msg.pythonPath - Path to Python executable
 * @param {string} msg.loadToolPath - Path to load_tool.py (or direct tool path)
 * @param {string} msg.toolPath - Path to the tool .py file
 * @param {string} msg.toolName - Name to register the tool under
 * @param {Object} msg.args - Arguments to pass to the tool
 * @param {Object} msg.env - Additional environment variables
 * @param {number} msg.requestId - Unique request ID for correlation
 */
async function executePythonTool(msg) {
  const {
    pythonPath,
    toolPath,
    toolName,
    args = {},
    env = {},
    requestId
  } = msg

  const startTime = Date.now()

  try {
    const proc = spawn(pythonPath, ['-c', PYTHON_TOOL_RUNNER], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(toolPath)
    })
    proc.stdin.end(JSON.stringify({ toolPath, toolName, args }))

    let stdout = ''
    let stderr = ''

    // Capture stdout
    proc.stdout.on('data', (data) => {
      const chunk = data.toString()
      stdout += chunk
      // Send streaming output if needed
      parentPort.postMessage({
        type: 'stdout',
        requestId,
        data: chunk
      })
    })

    // Capture stderr (for logging, not errors)
    proc.stderr.on('data', (data) => {
      const chunk = data.toString()
      stderr += chunk
      parentPort.postMessage({
        type: 'stderr',
        requestId,
        data: chunk
      })
    })

    // Handle process completion
    proc.on('close', (exitCode) => {
      const duration = Date.now() - startTime

      // Try to parse the stdout as JSON (ToolResult)
      let result
      try {
        result = JSON.parse(stdout.trim())
      } catch {
        // If not valid JSON, wrap in a result structure
        result = {
          status: exitCode === 0 ? 'success' : 'error',
          content: [{ text: stdout || 'No output' }]
        }
      }

      parentPort.postMessage({
        type: 'complete',
        requestId,
        success: exitCode === 0 && result.status !== 'error',
        exitCode,
        result,
        stdout,
        stderr,
        duration
      })
    })

    // Handle spawn errors
    proc.on('error', (err) => {
      parentPort.postMessage({
        type: 'error',
        requestId,
        message: err.message,
        code: err.code
      })
    })

  } catch (err) {
    parentPort.postMessage({
      type: 'error',
      requestId,
      message: err.message
    })
  }
}

// Signal that the utility runner is ready
parentPort.postMessage({ type: 'ready', timestamp: Date.now() })
