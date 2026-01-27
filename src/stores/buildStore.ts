/**
 * Build Workbench Store
 * 
 * State management for the Build Agent Workbench including:
 * - Agent switching with thread isolation
 * - Message threads keyed by agent
 * - Execution plan
 * - Projects
 * - Current view state
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AgentProfile,
  BuildMessage,
  CodingProject,
  ExecutionPlan,
  Source,
  Citation,
  CenterView,
  MessageBlock,
} from '@/components/build/types'

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// State Interface
// ─────────────────────────────────────────────────────────────────────────────

interface Artifact {
  id: string
  name: string
  kind: string
  projectId?: string
}

interface Todo {
  id: string
  text: string
  done: boolean
}

interface BuildState {
  // Agent management
  activeAgentId: string | null
  agents: AgentProfile[]

  // Thread management (keyed by threadKey)
  threads: Record<string, BuildMessage[]>
  workspaceId: string  // default workspace/user scope
  streamingMessageId: string | null
  isStreaming: boolean

  // View state
  activeCenterView: CenterView
  activeProjectId: string | null

  // Execution plan
  currentPlan: ExecutionPlan | null

  // Projects
  projects: CodingProject[]

  // Right rail data
  sources: Source[]
  citations: Citation[]
  todos: Todo[]

  // Preview state
  previewUrl: string | null
  previewTitle: string | null

  // Artifacts
  artifacts: Artifact[]

  // Navigation counter for headline rotation
  navigationCounter: number

  // Error state
  error: { message: string; code?: string } | null

  // ─────────────────────────────────────────────────────────────────────────
  // Computed
  // ─────────────────────────────────────────────────────────────────────────
  
  activeThreadKey: () => string
  activeMessages: () => BuildMessage[]

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  // Agent actions
  setActiveAgent: (agentId: string) => void
  loadAgents: (agents: AgentProfile[]) => void

  // Message actions
  addMessage: (message: BuildMessage) => void
  addUserMessage: (content: string) => void
  updateStreamingMessage: (messageId: string, blocks: MessageBlock[]) => void
  finalizeStreamingMessage: () => void
  clearThread: () => void

  // View actions
  selectProject: (projectId: string) => void
  setCenterView: (view: CenterView) => void
  incrementNavigation: () => void

  // Plan actions
  updatePlan: (plan: ExecutionPlan) => void
  clearPlan: () => void

  // Project actions
  addProject: (project: CodingProject) => void
  loadProjects: (projects: CodingProject[]) => void

  // Right rail actions
  upsertSources: (sources: Source[]) => void
  upsertCitations: (citations: Citation[]) => void
  updateTodos: (todos: Todo[]) => void

  // Preview actions
  setPreview: (url: string, title?: string) => void
  clearPreview: () => void

  // Artifact actions
  addArtifact: (artifact: Artifact) => void

  // Tool call actions
  updateToolCall: (toolName: string, status: string, output?: string, error?: string) => void

  // Streaming actions
  setStreaming: (isStreaming: boolean) => void

  // Error actions
  setError: (message: string, code?: string) => void
  clearError: () => void

  // Reset
  reset: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Agents (seed data)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Default Agents (seed data)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_AGENTS: AgentProfile[] = [
  {
    id: 'super-agent',
    name: 'Super Agent',
    description: 'Strands-based orchestration agent with MCP/A2A capabilities',
    tools: ['mcp-client', 'use_agent', 'swarm', 'think'],
    avatar: '', // Icons handled by UI
  },
  {
    id: 'search-agent',
    name: 'Search Agent',
    description: 'Deep research and synthesis using Perplexity & MCPs',
    tools: ['perplexity_deep_research', 'mcp-client', 'swarm'],
    avatar: '', // Icons handled by UI
  },
  {
    id: 'sandbox-agent',
    name: 'Sandbox Agent',
    description: 'Full-stack coding agent with browser preview capabilities',
    tools: ['mcp-playwright', 'code-interpreter', 'use_computer'],
    avatar: '', // Icons handled by UI
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useBuildStore = create<BuildState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeAgentId: 'sandbox-agent',
      agents: DEFAULT_AGENTS,
      threads: {},
      workspaceId: 'default',
      streamingMessageId: null,
      isStreaming: false,
      activeCenterView: 'chat',
      activeProjectId: null,
      currentPlan: null,
      projects: [],
      sources: [],
      citations: [],
      todos: [],
      previewUrl: null,
      previewTitle: null,
      artifacts: [],
      navigationCounter: 0,
      error: null,

      // Computed
      activeThreadKey: () => {
        const { workspaceId, activeAgentId } = get()
        return `${workspaceId}:${activeAgentId || 'default'}`
      },

      activeMessages: () => {
        const { threads } = get()
        const key = get().activeThreadKey()
        return threads[key] || []
      },

      // Agent actions
      setActiveAgent: (agentId) => {
        set({
          activeAgentId: agentId,
          activeCenterView: 'chat',
          activeProjectId: null,
          // Clear right rail when switching agents
          sources: [],
          citations: [],
          currentPlan: null,
        })
      },

      loadAgents: (agents) => {
        set({ agents })
      },

      // Message actions
      addMessage: (message) => {
        const key = get().activeThreadKey()
        set((state) => ({
          threads: {
            ...state.threads,
            [key]: [...(state.threads[key] || []), message],
          },
        }))
      },

      addUserMessage: (content) => {
        const message: BuildMessage = {
          id: generateId(),
          role: 'user',
          blocks: [{ type: 'text', content }],
          timestamp: Date.now(),
        }
        get().addMessage(message)
      },

      updateStreamingMessage: (messageId, blocks) => {
        const key = get().activeThreadKey()
        set((state) => {
          const messages = state.threads[key] || []
          const idx = messages.findIndex((m) => m.id === messageId)
          if (idx === -1) {
            // Create new streaming message
            return {
              threads: {
                ...state.threads,
                [key]: [
                  ...messages,
                  {
                    id: messageId,
                    role: 'assistant',
                    blocks,
                    timestamp: Date.now(),
                    isStreaming: true,
                  },
                ],
              },
              streamingMessageId: messageId,
            }
          }
          // Update existing
          const updated = [...messages]
          updated[idx] = { ...updated[idx], blocks, isStreaming: true }
          return {
            threads: { ...state.threads, [key]: updated },
            streamingMessageId: messageId,
          }
        })
      },

      finalizeStreamingMessage: () => {
        const { streamingMessageId } = get()
        if (!streamingMessageId) return

        const key = get().activeThreadKey()
        set((state) => {
          const messages = state.threads[key] || []
          const idx = messages.findIndex((m) => m.id === streamingMessageId)
          if (idx === -1) return state

          const updated = [...messages]
          updated[idx] = { ...updated[idx], isStreaming: false }
          return {
            threads: { ...state.threads, [key]: updated },
            streamingMessageId: null,
            isStreaming: false,
          }
        })
      },

      clearThread: () => {
        const key = get().activeThreadKey()
        set((state) => ({
          threads: { ...state.threads, [key]: [] },
          sources: [],
          citations: [],
          currentPlan: null,
        }))
      },

      // View actions
      selectProject: (projectId) => {
        set({
          activeProjectId: projectId,
          activeCenterView: 'project',
        })
      },

      setCenterView: (view) => {
        set({ activeCenterView: view })
      },

      incrementNavigation: () => {
        set((state) => ({
          navigationCounter: state.navigationCounter + 1,
        }))
      },

      // Plan actions
      updatePlan: (plan) => {
        set({ currentPlan: plan })
      },

      clearPlan: () => {
        set({ currentPlan: null })
      },

      // Project actions
      addProject: (project) => {
        set((state) => ({
          projects: [...state.projects.filter((p) => p.id !== project.id), project],
        }))
      },

      loadProjects: (projects) => {
        set({ projects })
      },

      // Right rail actions
      upsertSources: (sources) => {
        set((state) => {
          const existing = new Map(state.sources.map((s) => [s.url, s]))
          sources.forEach((s) => existing.set(s.url, s))
          return { sources: Array.from(existing.values()) }
        })
      },

      upsertCitations: (citations) => {
        set((state) => {
          const existing = new Map(state.citations.map((c) => [c.url, c]))
          citations.forEach((c) => existing.set(c.url, c))
          return { citations: Array.from(existing.values()) }
        })
      },

      updateTodos: (todos) => {
        set({ todos })
      },

      // Preview actions
      setPreview: (url, title) => {
        set({ previewUrl: url, previewTitle: title || null })
      },

      clearPreview: () => {
        set({ previewUrl: null, previewTitle: null })
      },

      // Artifact actions
      addArtifact: (artifact) => {
        set((state) => ({
          artifacts: [...state.artifacts.filter((a) => a.id !== artifact.id), artifact],
        }))
      },

      // Tool call actions
      updateToolCall: (toolName, status, output, error) => {
        // Update the last tool_call block in the streaming message
        const { streamingMessageId } = get()
        if (!streamingMessageId) return

        const key = get().activeThreadKey()
        set((state) => {
          const messages = state.threads[key] || []
          const idx = messages.findIndex((m) => m.id === streamingMessageId)
          if (idx === -1) return state

          const msg = messages[idx]
          const blocks = msg.blocks.map((block) => {
            if (block.type === 'tool_call' && block.toolName === toolName) {
              return { ...block, status: status as any, output, error }
            }
            return block
          })

          const updated = [...messages]
          updated[idx] = { ...updated[idx], blocks }
          return { threads: { ...state.threads, [key]: updated } }
        })
      },

      // Streaming actions
      setStreaming: (isStreaming) => {
        set({ isStreaming })
      },

      // Error actions
      setError: (message, code) => {
        set({ error: { message, code } })
      },

      clearError: () => {
        set({ error: null })
      },

      // Reset
      reset: () => {
        set({
          threads: {},
          currentPlan: null,
          sources: [],
          citations: [],
          todos: [],
          previewUrl: null,
          previewTitle: null,
          artifacts: [],
          error: null,
          isStreaming: false,
          streamingMessageId: null,
        })
      },
    }),
    {
      name: 'build-store-v2',
      version: 3,
      migrate: (state: any) => {
        if (!state) return state
        if (!state.activeAgentId || state.activeAgentId === 'super-agent') {
          return { ...state, activeAgentId: 'sandbox-agent' }
        }
        return state
      },
      partialize: (state) => ({
        activeAgentId: state.activeAgentId,
        threads: state.threads,
        projects: state.projects,
        navigationCounter: state.navigationCounter,
      }),
    }
  )
)
