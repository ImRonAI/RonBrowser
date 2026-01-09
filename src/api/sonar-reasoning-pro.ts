/**
 * Sonar Reasoning Pro API Client
 *
 * Handles streaming responses from Sonar Reasoning Pro with chain of thought,
 * search results, citations, and images.
 */

import { EventEmitter } from 'events'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SonarStreamEvent {
  type: 'content' | 'reasoning_start' | 'reasoning' | 'reasoning_end' | 'metadata' | 'error' | 'done'
  content?: string
  citations?: Citation[]
  images?: ImageData[]
  search_results?: SearchResult[]
  message?: string
}

export interface Citation {
  id: string
  title: string
  url: string
  snippet?: string
  domain?: string
  relevanceScore?: number
}

export interface SearchResult {
  id: string
  query: string
  snippet: string
  url?: string
}

export interface ImageData {
  id: string
  url: string
  caption?: string
  base64?: string
  mediaType?: string
}

export interface SonarReasoningProOptions {
  apiKey?: string
  model?: 'sonar-reasoning-pro' | 'sonar-pro'
  temperature?: number
  maxTokens?: number
  searchDomains?: string[]
  searchRecency?: 'day' | 'week' | 'month' | 'year'
  returnImages?: boolean
  returnCitations?: boolean
  citationCount?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data Generator (for development)
// ─────────────────────────────────────────────────────────────────────────────

function generateMockResponse(query: string): SonarStreamEvent[] {
  const events: SonarStreamEvent[] = []

  // Start reasoning
  events.push({ type: 'reasoning_start' })

  // Reasoning content
  const reasoningSteps = [
    `Analyzing the query: "${query}"...`,
    'Identifying key concepts and entities...',
    'Searching multiple authoritative sources...',
    'Cross-referencing information for accuracy...',
    'Synthesizing findings into comprehensive response...'
  ]

  reasoningSteps.forEach(step => {
    events.push({ type: 'reasoning', content: step + ' ' })
  })

  // End reasoning
  events.push({ type: 'reasoning_end' })

  // Search results metadata
  events.push({
    type: 'metadata',
    search_results: [
      {
        id: 'search-1',
        query: query,
        snippet: `Found comprehensive information about ${query} from multiple authoritative sources.`,
        url: 'https://example.com/search-1'
      },
      {
        id: 'search-2',
        query: `${query} detailed analysis`,
        snippet: 'In-depth analysis reveals several key aspects worth considering...',
        url: 'https://example.com/search-2'
      }
    ]
  })

  // Main content with citations
  const contentChunks = [
    `Based on comprehensive analysis, here's what I found about ${query}. `,
    'The search results reveal several important insights. ',
    'According to recent authoritative sources[1], the topic has significant relevance. ',
    'Further investigation shows[2] that there are multiple perspectives to consider. ',
    'The evidence suggests a nuanced understanding is required[3]. ',
    '\n\n',
    'Key findings include:\n',
    '• Primary insight from the analysis[1]\n',
    '• Secondary consideration worth noting[2]\n',
    '• Additional context for complete understanding[3]\n',
    '\n',
    'This synthesis represents the most current and reliable information available.'
  ]

  contentChunks.forEach(chunk => {
    events.push({ type: 'content', content: chunk })
  })

  // Citations metadata
  events.push({
    type: 'metadata',
    citations: [
      {
        id: 'cite-1',
        title: 'Comprehensive Analysis of ' + query,
        url: 'https://example.com/source-1',
        snippet: 'This authoritative source provides detailed insights into the topic...',
        domain: 'example.com',
        relevanceScore: 0.95
      },
      {
        id: 'cite-2',
        title: 'Recent Developments in ' + query,
        url: 'https://example.com/source-2',
        snippet: 'Latest research and findings on the subject matter...',
        domain: 'example.com',
        relevanceScore: 0.88
      },
      {
        id: 'cite-3',
        title: 'Expert Perspectives on ' + query,
        url: 'https://example.com/source-3',
        snippet: 'Industry experts weigh in with their analysis...',
        domain: 'example.com',
        relevanceScore: 0.82
      }
    ]
  })

  // Done
  events.push({ type: 'done' })

  return events
}

// ─────────────────────────────────────────────────────────────────────────────
// Sonar Reasoning Pro Client
// ─────────────────────────────────────────────────────────────────────────────

export class SonarReasoningProClient extends EventEmitter {
  private options: SonarReasoningProOptions

  constructor(options: SonarReasoningProOptions = {}) {
    super()
    this.options = {
      model: 'sonar-reasoning-pro',
      temperature: 0.7,
      maxTokens: 2000,
      returnImages: true,
      returnCitations: true,
      citationCount: 5,
      ...options
    }
  }

  /**
   * Stream a query to Sonar Reasoning Pro
   */
  async stream(query: string): Promise<void> {
    try {
      // In production, this would make a real API call
      // For now, we'll use mock data with realistic streaming delays
      const events = generateMockResponse(query)

      for (const event of events) {
        // Simulate streaming delay
        await this.delay(50 + Math.random() * 100)
        this.emit('data', event)
      }
    } catch (error) {
      this.emit('data', {
        type: 'error',
        message: error instanceof Error ? error.message : 'An error occurred'
      })
    }
  }

  /**
   * Make a real API call to Perplexity Sonar API
   * (To be implemented when API credentials are available)
   */
  async streamReal(query: string): Promise<void> {
    const apiKey = this.options.apiKey || process.env.PERPLEXITY_API_KEY

    if (!apiKey) {
      throw new Error('Perplexity API key is required')
    }

    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful search assistant. Provide comprehensive, accurate responses with citations.'
            },
            {
              role: 'user',
              content: query
            }
          ],
          temperature: this.options.temperature,
          max_tokens: this.options.maxTokens,
          return_citations: this.options.returnCitations,
          return_images: this.options.returnImages,
          search_domain_filter: this.options.searchDomains,
          search_recency_filter: this.options.searchRecency,
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              this.emit('data', { type: 'done' })
              return
            }

            try {
              const parsed = JSON.parse(data)
              // Transform Perplexity response to our format
              this.handlePerplexityChunk(parsed)
            } catch (e) {
              console.error('Failed to parse chunk:', e)
            }
          }
        }
      }
    } catch (error) {
      this.emit('data', {
        type: 'error',
        message: error instanceof Error ? error.message : 'An error occurred'
      })
    }
  }

  /**
   * Transform Perplexity API response chunks to our format
   */
  private handlePerplexityChunk(chunk: any): void {
    if (chunk.choices?.[0]?.delta?.content) {
      this.emit('data', {
        type: 'content',
        content: chunk.choices[0].delta.content
      })
    }

    if (chunk.citations) {
      this.emit('data', {
        type: 'metadata',
        citations: chunk.citations.map((c: any, i: number) => ({
          id: `cite-${i}`,
          title: c.title || 'Untitled',
          url: c.url,
          snippet: c.snippet,
          domain: new URL(c.url).hostname,
          relevanceScore: c.score
        }))
      })
    }

    if (chunk.images) {
      this.emit('data', {
        type: 'metadata',
        images: chunk.images.map((img: any, i: number) => ({
          id: `img-${i}`,
          url: img.url,
          caption: img.caption
        }))
      })
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Express/API Route Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Server-Sent Events handler for streaming Sonar Reasoning Pro responses
 */
export function createSonarStreamHandler() {
  return async (req: any, res: any) => {
    const { query } = req.query

    if (!query) {
      res.status(400).json({ error: 'Query parameter is required' })
      return
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    })

    // Create client
    const client = new SonarReasoningProClient()

    // Handle events
    client.on('data', (event: SonarStreamEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)

      if (event.type === 'done' || event.type === 'error') {
        res.end()
      }
    })

    // Start streaming
    await client.stream(query as string)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook for React Components
// ─────────────────────────────────────────────────────────────────────────────

export function useSonarReasoningPro() {
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [content, setContent] = React.useState('')
  const [reasoning, setReasoning] = React.useState('')
  const [citations, setCitations] = React.useState<Citation[]>([])
  const [images, setImages] = React.useState<ImageData[]>([])
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
  const [error, setError] = React.useState<string | null>(null)

  const eventSourceRef = React.useRef<EventSource | null>(null)

  const stream = React.useCallback((query: string) => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Reset state
    setContent('')
    setReasoning('')
    setCitations([])
    setImages([])
    setSearchResults([])
    setError(null)
    setIsStreaming(true)

    // Create EventSource
    const eventSource = new EventSource(`/api/sonar-reasoning-pro/stream?query=${encodeURIComponent(query)}`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data: SonarStreamEvent = JSON.parse(event.data)

        switch (data.type) {
          case 'content':
            setContent(prev => prev + (data.content || ''))
            break
          case 'reasoning':
            setReasoning(prev => prev + (data.content || ''))
            break
          case 'metadata':
            if (data.citations) setCitations(data.citations)
            if (data.images) setImages(data.images)
            if (data.search_results) setSearchResults(data.search_results)
            break
          case 'error':
            setError(data.message || 'An error occurred')
            setIsStreaming(false)
            break
          case 'done':
            setIsStreaming(false)
            break
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error)
      }
    }

    eventSource.onerror = () => {
      setIsStreaming(false)
      eventSource.close()
    }
  }, [])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return {
    stream,
    isStreaming,
    content,
    reasoning,
    citations,
    images,
    searchResults,
    error
  }
}

// Import React for the hook
import * as React from 'react'