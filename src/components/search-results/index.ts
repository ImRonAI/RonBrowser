/**
 * Search Results Components
 * 
 * A comprehensive component library for displaying search results from multiple providers.
 * Supports SonarReasoningPro analysis and universal result cards with Open-to-Chat integration.
 * 
 * Components:
 * - SearchLayout: Container for displaying search results with filters and view modes
 * - SonarBrain: Displays SonarReasoningPro analysis with chain of thought and sources
 * - UniversalResultCard: Polymorphic card for displaying different result types
 * - OpenToChatButton: Button component for routing results to internal agents
 * - OpenToChatButtonWithAgent: Extended button showing the target agent name
 */

// Layout components
export { SearchLayout } from './SearchLayout'

// AI reasoning components
export { SonarBrain } from './SonarBrain'

// Result card components
export { UniversalResultCard } from './UniversalResultCard'

// Action components
export { OpenToChatButton, OpenToChatButtonWithAgent } from './OpenToChatButton'

// Re-export commonly used search types
export type {
  SearchResponse,
  UniversalResult,
  ResultType,
  SearchFilters,
} from '@/types/search'
