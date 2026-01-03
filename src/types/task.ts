/**
 * Task Types
 * 
 * Comprehensive type definitions for the task management system.
 * Designed for AI population with strong presentation focus.
 */

// ============================================
// Core Types
// ============================================

export type TaskStatus = 'backlog' | 'in-progress' | 'review' | 'blocked' | 'testing' | 'done'
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'
export type TaskType = 'feature' | 'bug' | 'improvement' | 'research' | 'documentation' | 'support' | 'other'
export type UrgencyLevel = 'routine' | 'urgent' | 'emergent' | 'stat'
export type EffortSize = 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl'
export type HealthIndicator = 'on-track' | 'at-risk' | 'critical' | 'blocked'
export type SourceChannel = 'email' | 'phone' | 'portal' | 'fax' | 'in-person' | 'referral' | 'ai-generated' | 'manual'
export type CommunicationType = 'phone' | 'email' | 'sms' | 'video' | 'fax' | 'message' | 'meeting'
export type CommunicationDirection = 'inbound' | 'outbound'

// ============================================
// Contact Types
// ============================================

export interface TaskContact {
  id: string
  name: string
  email?: string
  phone?: string
  avatar?: string
  initials: string
  role?: string
  preferredContactMethod?: 'email' | 'phone' | 'sms'
  preferredContactTime?: string
}

// ============================================
// Interest/Label Types
// ============================================

export interface TaskLabel {
  id: string
  label: string
  color: string
  category?: 'project' | 'area' | 'type' | 'sprint' | 'custom'
}

// ============================================
// Subtask Types
// ============================================

export interface Subtask {
  id: string
  title: string
  completed: boolean
  completedAt?: number
  completedBy?: string
  order: number
}

// ============================================
// Attachment Types
// ============================================

export interface TaskAttachment {
  id: string
  name: string
  url: string
  type: 'document' | 'image' | 'link' | 'email' | 'meeting' | 'video'
  mimeType?: string
  size?: number
  uploadedAt: number
  uploadedBy?: string
  thumbnail?: string
}

// ============================================
// Communication Types
// ============================================

export interface TaskCommunication {
  id: string
  type: CommunicationType
  direction: CommunicationDirection
  timestamp: number
  participants: TaskContact[]
  subject?: string
  summary?: string // AI-generated
  content?: string
  duration?: number // For calls/videos in seconds
  transcript?: string // For calls/videos via AI
  sentiment?: 'positive' | 'neutral' | 'negative' | 'urgent'
  actionItems?: string[]
  attachments?: TaskAttachment[]
  threadId?: string // For email threads
  meetingLink?: string
  recordingUrl?: string
  isRead?: boolean
}

// ============================================
// History/Changelog Types
// ============================================

export type TaskHistoryEventType = 
  | 'created'
  | 'status_changed'
  | 'priority_changed'
  | 'assignee_changed'
  | 'field_updated'
  | 'comment_added'
  | 'document_attached'
  | 'communication_logged'
  | 'ai_interaction'
  | 'subtask_created'
  | 'subtask_completed'
  | 'external_sync'
  | 'due_date_changed'
  | 'label_added'
  | 'label_removed'

export interface TaskHistoryEvent {
  id: string
  type: TaskHistoryEventType
  timestamp: number
  actor: {
    id: string
    name: string
    type: 'user' | 'system' | 'ai'
    avatar?: string
  }
  description: string
  changes?: {
    field: string
    oldValue?: string | number | boolean | null
    newValue?: string | number | boolean | null
  }[]
  metadata?: Record<string, unknown>
}

// ============================================
// AI Conversation Types
// ============================================

export interface TaskConversation {
  id: string
  taskId: string
  createdAt: number
  lastActiveAt: number
  summary?: string // AI-generated
  messageCount: number
  primaryIntent?: string // Categorized by AI
  messages: TaskConversationMessage[]
}

export interface TaskConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
  toolUses?: {
    id: string
    name: string
    input?: Record<string, unknown>
    result?: unknown
    status: 'pending' | 'running' | 'success' | 'error'
  }[]
  tokens?: {
    input: number
    output: number
  }
}

// ============================================
// Dependency Types
// ============================================

export interface TaskDependency {
  id: string
  taskId: string
  taskTitle: string
  type: 'blocks' | 'blocked-by' | 'related'
  status: TaskStatus
}

// ============================================
// Main Task Interface
// ============================================

export interface Task {
  id: string
  
  // ─────────────────────────────────────────
  // Core Fields
  // ─────────────────────────────────────────
  title: string
  description?: string // Rich text
  status: TaskStatus
  priority?: TaskPriority
  type?: TaskType
  
  // ─────────────────────────────────────────
  // Dates & Deadlines
  // ─────────────────────────────────────────
  createdAt: number
  updatedAt: number
  dueDate?: number | null
  startDate?: number
  completedAt?: number
  slaDeadline?: number
  
  // ─────────────────────────────────────────
  // People
  // ─────────────────────────────────────────
  assignees: TaskContact[]
  createdBy?: TaskContact
  primaryContact?: TaskContact
  relatedContacts?: TaskContact[]
  waitingOn?: TaskContact | string // Can be external party text
  
  // ─────────────────────────────────────────
  // Organization
  // ─────────────────────────────────────────
  labels: TaskLabel[]
  projectId?: string
  projectName?: string
  epicId?: string
  epicName?: string
  sprintId?: string
  sprintName?: string
  
  // ─────────────────────────────────────────
  // Progress & Estimation
  // ─────────────────────────────────────────
  subtasks: Subtask[]
  progress?: number // 0-100
  estimatedEffort?: EffortSize | number // T-shirt or story points
  actualTimeSpent?: number // In minutes
  
  // ─────────────────────────────────────────
  // AI-Optimized Fields
  // ─────────────────────────────────────────
  complexityScore?: number // 1-10, AI-calculated
  riskScore?: number // 1-10, AI-calculated
  predictedCompletionDate?: number
  completionConfidence?: number // 0-100
  suggestedSprint?: string
  autoGeneratedSummary?: string
  nextAction?: string
  
  // ─────────────────────────────────────────
  // Visual Enhancement
  // ─────────────────────────────────────────
  color?: string
  icon?: string
  coverImage?: string
  customBadge?: string
  healthIndicator?: HealthIndicator
  
  // ─────────────────────────────────────────
  // Communication & Context
  // ─────────────────────────────────────────
  sourceChannel?: SourceChannel
  emailThreadRef?: string[]
  meetingLinks?: string[]
  documentLinks?: TaskAttachment[]
  callbackNumber?: string
  externalRefId?: string // Third-party system ID
  
  // ─────────────────────────────────────────
  // Flags & Toggles
  // ─────────────────────────────────────────
  hasNotification: boolean
  isRecurring?: boolean
  recurringSchedule?: string // iCal RRULE
  isUrgent?: boolean
  isComplianceFlag?: boolean
  isSensitive?: boolean // HIPAA, etc.
  
  // ─────────────────────────────────────────
  // Dependencies
  // ─────────────────────────────────────────
  dependencies?: TaskDependency[]
  blockers?: string[] // Rich text array
  
  // ─────────────────────────────────────────
  // Workflow
  // ─────────────────────────────────────────
  urgencyLevel?: UrgencyLevel
  escalationTrigger?: number // Timestamp when escalation happens
  timeToFirstResponse?: number // Auto-calculated duration
  templateUsed?: string
  successMetrics?: string[]
  
  // ─────────────────────────────────────────
  // Related Data (populated on detail view)
  // ─────────────────────────────────────────
  communications?: TaskCommunication[]
  history?: TaskHistoryEvent[]
  conversations?: TaskConversation[]
  
  // ─────────────────────────────────────────
  // Integration
  // ─────────────────────────────────────────
  syncedSystems?: string[]
  lastSyncTime?: Record<string, number>
}

// ============================================
// Helper Types
// ============================================

export interface TaskFilters {
  status?: TaskStatus[]
  priority?: TaskPriority[]
  assignee?: string[]
  labels?: string[]
  dateRange?: { start: number; end: number }
  search?: string
}

export interface TaskSort {
  field: keyof Task
  direction: 'asc' | 'desc'
}

// ============================================
// Status Metadata
// ============================================

export const TASK_STATUS_CONFIG: Record<TaskStatus, {
  label: string
  color: string
  bgColor: string
  icon: string
}> = {
  'backlog': {
    label: 'Backlog',
    color: 'text-surface-500 dark:text-surface-400',
    bgColor: 'bg-surface-100 dark:bg-surface-800',
    icon: 'inbox'
  },
  'in-progress': {
    label: 'In Progress',
    color: 'text-accent dark:text-accent-light',
    bgColor: 'bg-accent/10 dark:bg-accent-light/10',
    icon: 'play'
  },
  'review': {
    label: 'Review',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    icon: 'eye'
  },
  'blocked': {
    label: 'Blocked',
    color: 'text-danger',
    bgColor: 'bg-danger/10',
    icon: 'alert-circle'
  },
  'testing': {
    label: 'Testing',
    color: 'text-info',
    bgColor: 'bg-info/10',
    icon: 'beaker'
  },
  'done': {
    label: 'Done',
    color: 'text-success',
    bgColor: 'bg-success/10',
    icon: 'check-circle'
  }
}

export const TASK_PRIORITY_CONFIG: Record<TaskPriority, {
  label: string
  color: string
  bgColor: string
  weight: number
}> = {
  'critical': {
    label: 'Critical',
    color: 'text-danger',
    bgColor: 'bg-danger/10',
    weight: 4
  },
  'high': {
    label: 'High',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    weight: 3
  },
  'medium': {
    label: 'Medium',
    color: 'text-info',
    bgColor: 'bg-info/10',
    weight: 2
  },
  'low': {
    label: 'Low',
    color: 'text-surface-500',
    bgColor: 'bg-surface-100 dark:bg-surface-800',
    weight: 1
  }
}

export const HEALTH_INDICATOR_CONFIG: Record<HealthIndicator, {
  label: string
  emoji: string
  color: string
}> = {
  'on-track': {
    label: 'On Track',
    emoji: '🟢',
    color: 'text-success'
  },
  'at-risk': {
    label: 'At Risk',
    emoji: '🟡',
    color: 'text-warning'
  },
  'critical': {
    label: 'Critical',
    emoji: '🔴',
    color: 'text-danger'
  },
  'blocked': {
    label: 'Blocked',
    emoji: '⚫',
    color: 'text-ink-muted dark:text-ink-inverse-muted'
  }
}

// ============================================
// Full Task Interface (Extended for Detail View)
// ============================================

/**
 * FullTask extends the base Task interface with all detailed fields
 * needed for the task detail view, including AI elements and rich metadata.
 */
export interface FullTask extends Task {
  // Additional fields for detailed view
  tags?: TaskLabel[]
  assignee?: TaskContact | null
  progressPercentage?: number
  
  // Comments are part of communications but can be standalone
  comments?: TaskConversationMessage[]
  
  // Attachments for the detail view
  attachments?: TaskAttachment[]
  
  // Checklist (alias for subtasks for compatibility)
  checklist?: Subtask[]
  
  // Project reference
  project?: {
    id: string
    name: string
  } | null
}

