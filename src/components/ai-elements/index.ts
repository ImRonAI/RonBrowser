/**
 * AI Elements Library
 * 
 * A comprehensive component library for building modern AI chat interfaces.
 * Based on Vercel AI SDK AI Elements patterns and best practices.
 * 
 * Components:
 * - Conversation: Container for chat messages with auto-scroll
 * - Message: Individual message display with avatar and content
 * - Reasoning: Collapsible AI thinking/reasoning display
 * - ChainOfThought: Step-by-step analysis visualization
 * - Sources: Citation and reference display
 * - Tool: Tool execution visualization
 * - Branch: Multiple response version management
 * - PromptInput: Rich input with attachments and model selection
 * - Suggestion: Quick action suggestions
 * - Loader: Loading and streaming indicators
 * - Artifact: AI-generated content display (charts, tables)
 * - Actions: Message action buttons (copy, retry, etc.)
 * 
 * Chain of Thought Extensions:
 * - Desktop: Computer use automation visualization
 * - Browser: Web browser automation visualization
 * - Code: Code generation and execution visualization
 * - Retrieval: Database, API, web, vector search visualization
 * - Files: File operations visualization
 * - Phone: Telnyx phone call/SMS visualization
 * - Email: Email actions visualization
 * - Document: Document creation/editing visualization
 * - Agent: Sub-agent orchestration visualization
 */

// Core conversation components
export * from './conversation'
export * from './message'
export * from './response'

// AI thinking components
export * from './reasoning'
export * from './chain-of-thought'

// Chain of Thought Extensions
export * from './chain-of-thought-desktop'
export * from './chain-of-thought-browser'
export * from './chain-of-thought-code'
export * from './chain-of-thought-retrieval'
export * from './chain-of-thought-files'
export * from './chain-of-thought-phone'
export * from './chain-of-thought-email'
export * from './chain-of-thought-document'
export * from './chain-of-thought-agent'

// Context components
export * from './sources'
export * from './tool'

// Branching components
export * from './branch'

// Input components
export * from './prompt-input'
export * from './text-attachment-card'
export * from './suggestion'

// State components
export * from './loader'
export * from './shimmer'

// Artifact components
export * from './artifact'

// Task components
export * from './task'

// Action components
export * from './actions'

// Note: types.ts re-exports are handled specifically to avoid conflicts with
// types already exported from chain-of-thought modules. Import specific types
// from types.ts directly if needed: import type { AIMessage, ... } from './types'

