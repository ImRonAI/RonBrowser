/**
 * Search Stream Parser
 *
 * Detects and parses search tool calls from SSE streams.
 * Transforms tool calls into rich search result visualizations.
 */

import type { SearchProvider, SearchResult } from '@/components/ai-elements/chain-of-thought-search'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolResult {
  id: string
  result: any
}

export interface ParsedSearchCall {
  provider: SearchProvider
  query: string
  timestamp: number
  toolCallId: string
  raw: ToolCall
}

export interface ParsedSearchResult {
  toolCallId: string
  provider: SearchProvider
  results: SearchResult[]
  duration?: number
  error?: string
  raw: any
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Detection
// ─────────────────────────────────────────────────────────────────────────────

const SEARCH_TOOL_PATTERNS: Record<string, SearchProvider> = {
  // Brave Search
  'mcp__brave__brave_web_search': 'brave',
  'mcp__brave__brave_local_search': 'brave',
  'mcp__brave__brave_news_search': 'brave',
  'mcp__brave__brave_image_search': 'brave',
  'mcp__brave__brave_video_search': 'brave',
  'brave_web_search': 'brave',
  'brave_search': 'brave',

  // Perplexity
  'perplexity_search': 'perplexity',
  'perplexity_api': 'perplexity',

  // Medical/Health
  'pubmed_search': 'pubmed',
  'mcp__pubmed': 'pubmed',
  'openfda_search': 'openfda',
  'mcp__openfda': 'openfda',

  // Data Sources
  'datacommons_search': 'datacommons',
  'mcp__datacommons': 'datacommons',
  'pophive_search': 'pophive',
  'mcp__pophive': 'pophive',
  'cms_search': 'cms',
  'mcp__cms': 'cms',

  // Automation
  'apify_search': 'apify',
  'mcp__apify': 'apify',
  'apify_docker': 'apify',

  // Travel
  'google_flights': 'google-flights',
  'flights_search': 'google-flights',
  'airbnb_search': 'airbnb',
  'mcp__airbnb': 'airbnb',

  // Academic
  'arxiv_search': 'arxiv',
  'mcp__arxiv': 'arxiv',

  // Program Integrity
  'program_integrity': 'program-integrity',
  'mcp__program_integrity': 'program-integrity',
}

export function detectSearchProvider(toolName: string): SearchProvider | null {
  const normalized = toolName.toLowerCase()

  for (const [pattern, provider] of Object.entries(SEARCH_TOOL_PATTERNS)) {
    if (normalized.includes(pattern)) {
      return provider
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Call Parsing
// ─────────────────────────────────────────────────────────────────────────────

export function parseToolCall(toolCall: ToolCall): ParsedSearchCall | null {
  const provider = detectSearchProvider(toolCall.function.name)
  if (!provider) return null

  try {
    const args = JSON.parse(toolCall.function.arguments)
    const query = extractQuery(args, provider)

    if (!query) return null

    return {
      provider,
      query,
      timestamp: Date.now(),
      toolCallId: toolCall.id,
      raw: toolCall,
    }
  } catch (error) {
    console.error('Failed to parse tool call:', error)
    return null
  }
}

function extractQuery(args: any, provider: SearchProvider): string | null {
  // Common query field names
  const queryFields = ['query', 'q', 'search', 'term', 'keyword', 'text', 'input']

  for (const field of queryFields) {
    if (args[field] && typeof args[field] === 'string') {
      return args[field]
    }
  }

  // Provider-specific extraction
  switch (provider) {
    case 'brave':
      return args.query || args.q || null
    case 'perplexity':
      return args.query || args.prompt || null
    case 'pubmed':
      return args.term || args.query || null
    case 'arxiv':
      return args.query || args.search_query || null
    case 'google-flights':
      return `${args.origin || ''} to ${args.destination || ''}`.trim() || null
    case 'airbnb':
      return args.location || args.query || null
    default:
      return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Result Parsing
// ─────────────────────────────────────────────────────────────────────────────

export function parseSearchResults(
  toolResult: ToolResult,
  searchCall: ParsedSearchCall
): ParsedSearchResult {
  const { provider, toolCallId } = searchCall

  try {
    const results = extractResults(toolResult.result, provider)

    return {
      toolCallId,
      provider,
      results,
      raw: toolResult.result,
    }
  } catch (error) {
    return {
      toolCallId,
      provider,
      results: [],
      error: error instanceof Error ? error.message : 'Failed to parse results',
      raw: toolResult.result,
    }
  }
}

function extractResults(data: any, provider: SearchProvider): SearchResult[] {
  if (!data) return []

  // Handle different response structures
  let rawResults: any[] = []

  // Try common result field names
  if (Array.isArray(data)) {
    rawResults = data
  } else if (data.results && Array.isArray(data.results)) {
    rawResults = data.results
  } else if (data.web?.results && Array.isArray(data.web.results)) {
    rawResults = data.web.results // Brave structure
  } else if (data.items && Array.isArray(data.items)) {
    rawResults = data.items
  } else if (data.hits && Array.isArray(data.hits)) {
    rawResults = data.hits
  } else if (data.entries && Array.isArray(data.entries)) {
    rawResults = data.entries
  }

  // Transform to SearchResult format
  return rawResults.map((item, index) => {
    const result = transformToSearchResult(item, provider)
    result.id = result.id || `${provider}-${index}`
    return result
  }).filter(r => r.title && r.url) // Filter out invalid results
}

function transformToSearchResult(item: any, provider: SearchProvider): SearchResult {
  // Base result structure
  const result: SearchResult = {
    id: '',
    title: '',
    url: '',
  }

  // Extract common fields
  result.title = item.title || item.name || item.headline || item.label || ''
  result.url = item.url || item.link || item.href || item.uri || ''
  result.snippet = item.snippet || item.description || item.summary || item.abstract || ''
  result.favicon = item.favicon || item.icon || item.logo || ''
  result.thumbnail = item.thumbnail || item.image || item.preview || ''

  // Provider-specific transformations
  switch (provider) {
    case 'brave':
      result.title = item.title || ''
      result.url = item.url || ''
      result.snippet = item.description || ''
      result.favicon = item.profile?.img || item.favicon || ''
      result.date = item.age || item.published || ''
      break

    case 'pubmed':
      result.title = item.title || item.Title || ''
      result.url = item.url || `https://pubmed.ncbi.nlm.nih.gov/${item.pmid || item.Id}/`
      result.snippet = item.abstract || item.Abstract || ''
      result.author = item.authors?.[0] || item.Authors?.[0] || ''
      result.date = item.pubdate || item.PubDate || ''
      result.metadata = {
        pmid: item.pmid || item.Id,
        journal: item.journal || item.Source,
        doi: item.doi || item.DOI,
      }
      break

    case 'arxiv':
      result.title = item.title || ''
      result.url = item.link || item.id || ''
      result.snippet = item.summary || ''
      result.author = item.author || item.authors?.[0]?.name || ''
      result.date = item.published || item.updated || ''
      result.metadata = {
        arxiv_id: item.id,
        category: item.category,
        pdf_url: item.pdf_url || item.link?.replace('abs', 'pdf'),
      }
      break

    case 'openfda':
      result.title = item.openfda?.brand_name?.[0] || item.product_description || ''
      result.url = `https://api.fda.gov/drug/label.json?search=${item.id || ''}`
      result.snippet = item.description || item.purpose?.[0] || ''
      result.metadata = {
        manufacturer: item.openfda?.manufacturer_name?.[0],
        product_type: item.product_type,
        route: item.openfda?.route?.[0],
      }
      break

    case 'google-flights':
      result.title = `${item.origin} → ${item.destination}`
      result.url = item.booking_url || '#'
      result.snippet = `${item.airline} - ${item.duration} - $${item.price}`
      result.metadata = {
        price: item.price,
        duration: item.duration,
        stops: item.stops,
        departure: item.departure_time,
        arrival: item.arrival_time,
      }
      break

    case 'airbnb':
      result.title = item.name || item.title || ''
      result.url = item.url || item.listing_url || ''
      result.snippet = item.description || `${item.property_type} - ${item.bedrooms} bed, ${item.bathrooms} bath`
      result.thumbnail = item.picture_url || item.thumbnail_url || ''
      result.metadata = {
        price: item.price,
        rating: item.review_scores_rating,
        reviews: item.number_of_reviews,
        property_type: item.property_type,
      }
      break
  }

  // Add relevance score if available
  if (item.score !== undefined) {
    result.relevanceScore = item.score
  } else if (item.relevance !== undefined) {
    result.relevanceScore = item.relevance
  } else if (item.confidence !== undefined) {
    result.relevanceScore = item.confidence
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Processing
// ─────────────────────────────────────────────────────────────────────────────

export class SearchStreamProcessor {
  private searchCalls = new Map<string, ParsedSearchCall>()
  private searchResults = new Map<string, ParsedSearchResult>()

  processToolCall(toolCall: ToolCall): ParsedSearchCall | null {
    const parsed = parseToolCall(toolCall)
    if (parsed) {
      this.searchCalls.set(parsed.toolCallId, parsed)
    }
    return parsed
  }

  processToolResult(toolResult: ToolResult): ParsedSearchResult | null {
    const searchCall = this.searchCalls.get(toolResult.id)
    if (!searchCall) return null

    const parsed = parseSearchResults(toolResult, searchCall)
    this.searchResults.set(toolResult.id, parsed)
    return parsed
  }

  getSearchCall(toolCallId: string): ParsedSearchCall | undefined {
    return this.searchCalls.get(toolCallId)
  }

  getSearchResult(toolCallId: string): ParsedSearchResult | undefined {
    return this.searchResults.get(toolCallId)
  }

  getAllSearchCalls(): ParsedSearchCall[] {
    return Array.from(this.searchCalls.values())
  }

  getAllSearchResults(): ParsedSearchResult[] {
    return Array.from(this.searchResults.values())
  }

  clear() {
    this.searchCalls.clear()
    this.searchResults.clear()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE Event Processing
// ─────────────────────────────────────────────────────────────────────────────

export interface SSESearchEvent {
  type: 'search_start' | 'search_complete' | 'search_error'
  provider: SearchProvider
  query: string
  toolCallId: string
  results?: SearchResult[]
  error?: string
  duration?: number
}

export function parseSSEEvent(event: string): SSESearchEvent | null {
  try {
    const data = JSON.parse(event)

    // Check for tool call
    if (data.tool_calls) {
      for (const toolCall of data.tool_calls) {
        const provider = detectSearchProvider(toolCall.function.name)
        if (provider) {
          const args = JSON.parse(toolCall.function.arguments)
          const query = extractQuery(args, provider)
          if (query) {
            return {
              type: 'search_start',
              provider,
              query,
              toolCallId: toolCall.id,
            }
          }
        }
      }
    }

    // Tool results handling can be added here if needed

    return null
  } catch {
    return null
  }
}