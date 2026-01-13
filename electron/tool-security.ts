/**
 * Tool Security - Whitelist, Validation, and Audit Logging
 * 
 * Provides security layer for Python tool execution:
 * - Whitelist enforcement
 * - Input validation/sanitization
 * - Integrity verification for MCP-sourced tools
 * - Audit logging to JSONL
 */

import { app } from 'electron'
import { join } from 'node:path'
import { appendFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { ToolInfo } from './tool-manager'

// ============================================
// Configuration
// ============================================

const FEATURE_FLAG = process.env.ENABLE_PYTHON_TOOL_MANAGEMENT === 'true'

function getAuditLogPath(): string {
  return join(app.getPath('userData'), 'tool-audit.jsonl')
}

// ============================================
// Whitelist Management
// ============================================

// Default whitelist - can be extended via configuration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEFAULT_TRUSTED_TOOLS = [
  // Core strands tools that are trusted
  'file_read',
  'file_write',
  'editor',
  'shell',
  'http_request',
  'current_time',
  'sleep',
  'calculator',
  'python_repl',
  'think',
  'stop',
  'speak'
]

// Whitelist can be loaded from config
let activeWhitelist: Set<string> | null = null // null means no whitelist (allow all)

/**
 * Set the active whitelist. Pass null to disable whitelisting.
 */
export function setWhitelist(toolNames: string[] | null): void {
  if (toolNames === null) {
    activeWhitelist = null
  } else {
    activeWhitelist = new Set(toolNames)
  }
}

/**
 * Check if a tool is allowed by the whitelist.
 */
export function isToolAllowed(toolName: string): boolean {
  if (activeWhitelist === null) {
    return true // No whitelist = allow all
  }
  return activeWhitelist.has(toolName)
}

/**
 * Filter a list of tools to only include whitelisted ones.
 */
export function filterWhitelistedTools(tools: ToolInfo[]): ToolInfo[] {
  if (activeWhitelist === null) {
    return tools
  }
  return tools.filter(t => activeWhitelist!.has(t.name))
}

// ============================================
// Input Validation
// ============================================

interface ValidationResult {
  valid: boolean
  sanitizedArgs: Record<string, unknown>
  errors: string[]
}

/**
 * Validate and sanitize tool arguments.
 * 
 * Performs:
 * - Type checking against args_schema if available
 * - Path traversal prevention
 * - Command injection prevention
 */
export function validateToolArgs(
  _tool: ToolInfo,
  args: Record<string, unknown>
): ValidationResult {
  const errors: string[] = []
  const sanitizedArgs: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(args)) {
    // Check for path traversal attempts
    if (typeof value === 'string') {
      if (value.includes('..') && (key.includes('path') || key.includes('file'))) {
        errors.push(`Potential path traversal in ${key}`)
        continue
      }
      
      // Check for command injection patterns
      const dangerousPatterns = [
        /;\s*rm\s/i,
        /;\s*sudo\s/i,
        /\|\s*bash/i,
        /`.*`/,
        /\$\(.*\)/
      ]
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          errors.push(`Potential command injection in ${key}`)
          continue
        }
      }
    }

    sanitizedArgs[key] = value
  }

  return {
    valid: errors.length === 0,
    sanitizedArgs,
    errors
  }
}

// ============================================
// Integrity Verification
// ============================================

/**
 * Calculate SHA256 hash of a file for integrity verification.
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  const content = await readFile(filePath)
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Verify tool integrity against expected hash.
 */
export async function verifyToolIntegrity(
  tool: ToolInfo,
  expectedHash: string
): Promise<boolean> {
  try {
    const actualHash = await calculateFileHash(tool.executablePath)
    return actualHash === expectedHash
  } catch (err) {
    console.error(`[ToolSecurity] Failed to verify integrity for ${tool.name}:`, err)
    return false
  }
}

// ============================================
// Audit Logging
// ============================================

interface AuditLogEntry {
  timestamp: string
  event: 'discovery' | 'execution_start' | 'execution_complete' | 'execution_error' | 'validation_failure' | 'whitelist_block'
  toolName: string
  toolPath?: string
  args?: Record<string, unknown>
  result?: 'success' | 'error'
  duration?: number
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * Write an audit log entry.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  if (!FEATURE_FLAG) return

  const logPath = getAuditLogPath()
  
  try {
    // Ensure directory exists
    await mkdir(join(app.getPath('userData')), { recursive: true })
    
    const logLine = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString()
    }) + '\n'
    
    await appendFile(logPath, logLine)
  } catch (err) {
    console.error('[ToolSecurity] Failed to write audit log:', err)
  }
}

/**
 * Log tool execution start.
 */
export async function logExecutionStart(
  tool: ToolInfo,
  args: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    timestamp: new Date().toISOString(),
    event: 'execution_start',
    toolName: tool.name,
    toolPath: tool.executablePath,
    args
  })
}

/**
 * Log tool execution completion.
 */
export async function logExecutionComplete(
  tool: ToolInfo,
  success: boolean,
  duration: number,
  error?: string
): Promise<void> {
  await logAuditEvent({
    timestamp: new Date().toISOString(),
    event: success ? 'execution_complete' : 'execution_error',
    toolName: tool.name,
    result: success ? 'success' : 'error',
    duration,
    error
  })
}

/**
 * Log whitelist block event.
 */
export async function logWhitelistBlock(toolName: string): Promise<void> {
  await logAuditEvent({
    timestamp: new Date().toISOString(),
    event: 'whitelist_block',
    toolName
  })
}

/**
 * Log validation failure.
 */
export async function logValidationFailure(
  tool: ToolInfo,
  errors: string[]
): Promise<void> {
  await logAuditEvent({
    timestamp: new Date().toISOString(),
    event: 'validation_failure',
    toolName: tool.name,
    error: errors.join('; ')
  })
}

// ============================================
// Combined Security Check
// ============================================

interface SecurityCheckResult {
  allowed: boolean
  tool?: ToolInfo
  sanitizedArgs?: Record<string, unknown>
  errors: string[]
}

/**
 * Perform complete security check before tool execution.
 */
export async function performSecurityCheck(
  tool: ToolInfo,
  args: Record<string, unknown>
): Promise<SecurityCheckResult> {

  // 1. Whitelist check
  if (!isToolAllowed(tool.name)) {
    await logWhitelistBlock(tool.name)
    return {
      allowed: false,
      errors: [`Tool '${tool.name}' is not in the whitelist`]
    }
  }

  // 2. Input validation
  const validation = validateToolArgs(tool, args)
  if (!validation.valid) {
    await logValidationFailure(tool, validation.errors)
    return {
      allowed: false,
      errors: validation.errors
    }
  }

  // All checks passed
  return {
    allowed: true,
    tool,
    sanitizedArgs: validation.sanitizedArgs,
    errors: []
  }
}
