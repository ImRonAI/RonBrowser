/**
 * Example Integration for Enhanced Chain of Thought with Search
 *
 * This file demonstrates how to integrate the enhanced Chain of Thought
 * component that renders web searches with rich visuals.
 */

import React, { useState, useEffect } from 'react'
import { ChainOfThoughtEnhanced, useChainOfThoughtStream, type ChainOfThoughtStepData } from './chain-of-thought-enhanced'
import { WebPreview, WebPreviewBody } from './web-preview'
import type { SearchResult } from './chain-of-thought-search'

// ─────────────────────────────────────────────────────────────────────────────
// Example: Chat Message with Chain of Thought
// ─────────────────────────────────────────────────────────────────────────────

interface ChatMessageWithCoTProps {
  message: string
  stream?: ReadableStream
  className?: string
}

export function ChatMessageWithCoT({
  message,
  stream,
  className
}: ChatMessageWithCoTProps) {
  const { steps } = useChainOfThoughtStream(stream || null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleResultClick = (result: SearchResult) => {
    // Open result in new tab or preview
    window.open(result.url, '_blank')
  }

  const handleExpandPreview = (result: SearchResult) => {
    // Show preview in modal or sidebar
    setPreviewUrl(result.url)
  }

  return (
    <div className={className}>
      {/* Chain of Thought - Always rendered inside the message */}
      {steps.length > 0 && (
        <ChainOfThoughtEnhanced
          steps={steps}
          onResultClick={handleResultClick}
          onExpandPreview={handleExpandPreview}
          className="mb-4"
        />
      )}

      {/* Message content */}
      <div className="prose dark:prose-invert">
        {message}
      </div>

      {/* Web Preview Modal */}
      {previewUrl && (
        <WebPreviewModal
          url={previewUrl}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Example: Standalone Chain of Thought with Mock Data
// ─────────────────────────────────────────────────────────────────────────────

export function ChainOfThoughtDemo() {
  const [steps, setSteps] = useState<ChainOfThoughtStepData[]>([])

  useEffect(() => {
    // Simulate a search flow
    const simulateSearch = async () => {
      // Step 1: Thinking
      setSteps([{
        id: 'step-1',
        type: 'thinking',
        label: 'Understanding your request',
        description: 'I need to search for information about React performance optimization',
        status: 'complete',
        timestamp: Date.now(),
      }])

      await delay(1000)

      // Step 2: Search starts
      setSteps(prev => [...prev, {
        id: 'step-2',
        type: 'search',
        label: 'Searching Brave',
        description: 'React performance optimization best practices',
        status: 'running',
        searchData: {
          provider: 'brave',
          query: 'React performance optimization best practices',
          results: [],
        },
        timestamp: Date.now(),
      }])

      await delay(2000)

      // Step 3: Search completes
      setSteps(prev => prev.map(step =>
        step.id === 'step-2'
          ? {
              ...step,
              status: 'complete',
              searchData: {
                ...step.searchData!,
                results: [
                  {
                    id: 'result-1',
                    title: 'React Performance Optimization: Complete Guide',
                    url: 'https://react.dev/learn/render-and-commit',
                    snippet: 'Learn how to optimize your React applications for better performance...',
                    favicon: 'https://react.dev/favicon.ico',
                    relevanceScore: 0.95,
                  },
                  {
                    id: 'result-2',
                    title: '21 Performance Optimization Techniques for React Apps',
                    url: 'https://www.codementor.io/blog/react-optimization',
                    snippet: 'Comprehensive list of techniques to improve React app performance...',
                    relevanceScore: 0.88,
                  },
                  {
                    id: 'result-3',
                    title: 'React.memo, useMemo, and useCallback Explained',
                    url: 'https://kentcdodds.com/blog/usememo-and-usecallback',
                    snippet: 'Deep dive into React\'s memoization hooks and when to use them...',
                    favicon: 'https://kentcdodds.com/favicon.ico',
                    author: 'Kent C. Dodds',
                    date: '2024-01-15',
                    relevanceScore: 0.92,
                  },
                ],
                duration: 342,
              },
            }
          : step
      ))

      await delay(1000)

      // Step 4: Another search
      setSteps(prev => [...prev, {
        id: 'step-3',
        type: 'search',
        label: 'Searching arXiv',
        description: 'React performance research papers',
        status: 'running',
        searchData: {
          provider: 'arxiv',
          query: 'React performance research papers',
          results: [],
        },
        timestamp: Date.now(),
      }])

      await delay(1500)

      // Complete the arXiv search
      setSteps(prev => prev.map(step =>
        step.id === 'step-3'
          ? {
              ...step,
              status: 'complete',
              searchData: {
                ...step.searchData!,
                results: [
                  {
                    id: 'arxiv-1',
                    title: 'Performance Analysis of Virtual DOM in Modern Web Frameworks',
                    url: 'https://arxiv.org/abs/2024.12345',
                    snippet: 'We present a comprehensive analysis of Virtual DOM performance...',
                    author: 'Smith et al.',
                    date: '2024-02-20',
                    metadata: {
                      arxiv_id: '2024.12345',
                      category: 'cs.SE',
                      pdf_url: 'https://arxiv.org/pdf/2024.12345.pdf',
                    },
                  },
                ],
                duration: 523,
              },
            }
          : step
      ))

      // Final thinking step
      await delay(1000)
      setSteps(prev => [...prev, {
        id: 'step-4',
        type: 'thinking',
        label: 'Synthesizing results',
        description: 'Found comprehensive information about React performance optimization from multiple sources',
        status: 'complete',
        timestamp: Date.now(),
      }])
    }

    simulateSearch()
  }, [])

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Chain of Thought Demo</h2>
      <ChainOfThoughtEnhanced
        steps={steps}
        onResultClick={(result) => console.log('Clicked:', result)}
        onExpandPreview={(result) => console.log('Preview:', result)}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Example: SSE Event Handler
// ─────────────────────────────────────────────────────────────────────────────

export function handleSSEMessage(
  event: MessageEvent,
  setSteps: React.Dispatch<React.SetStateAction<ChainOfThoughtStepData[]>>
) {
  try {
    const data = JSON.parse(event.data)

    // Handle different event types from your SSE stream
    if (data.type === 'tool_call') {
      const provider = detectSearchProvider(data.tool)
      if (provider) {
        const step: ChainOfThoughtStepData = {
          id: data.id,
          type: 'search',
          label: `Searching ${provider}`,
          description: data.query || data.arguments?.query,
          status: 'running',
          searchData: {
            provider,
            query: data.query || data.arguments?.query || '',
            results: [],
          },
          timestamp: Date.now(),
        }
        setSteps(prev => [...prev, step])
      }
    }

    if (data.type === 'tool_result') {
      // Update the corresponding search step with results
      setSteps(prev => prev.map(step =>
        step.id === data.tool_call_id
          ? {
              ...step,
              status: 'complete',
              searchData: {
                ...step.searchData!,
                results: parseSearchResults(data.result),
                duration: data.duration,
              },
            }
          : step
      ))
    }

    if (data.type === 'thinking' || data.type === 'reasoning') {
      const step: ChainOfThoughtStepData = {
        id: `thinking-${Date.now()}`,
        type: 'thinking',
        label: 'Analyzing',
        description: data.content,
        status: 'complete',
        timestamp: Date.now(),
      }
      setSteps(prev => [...prev, step])
    }
  } catch (error) {
    console.error('Failed to handle SSE message:', error)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

interface WebPreviewModalProps {
  url: string
  onClose: () => void
}

function WebPreviewModal({ url, onClose }: WebPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-6xl h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Web Preview</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            ✕
          </button>
        </div>
        <div className="h-[calc(100%-4rem)]">
          <WebPreview defaultUrl={url}>
            <WebPreviewBody />
          </WebPreview>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function detectSearchProvider(toolName: string): 'brave' | 'arxiv' | 'perplexity' | null {
  if (toolName.includes('brave')) return 'brave'
  if (toolName.includes('arxiv')) return 'arxiv'
  if (toolName.includes('perplexity')) return 'perplexity'
  return null
}

function parseSearchResults(data: any): SearchResult[] {
  // Transform raw API results to SearchResult format
  if (Array.isArray(data)) {
    return data.map((item, index) => ({
      id: item.id || `result-${index}`,
      title: item.title || item.name || '',
      url: item.url || item.link || '',
      snippet: item.snippet || item.description || '',
      favicon: item.favicon,
      thumbnail: item.thumbnail,
      date: item.date || item.published,
      author: item.author,
      source: item.source,
      relevanceScore: item.score || item.relevance,
      metadata: item.metadata,
    }))
  }

  // Handle Brave Search format
  if (data.web?.results) {
    return data.web.results.map((item: any, index: number) => ({
      id: `brave-${index}`,
      title: item.title,
      url: item.url,
      snippet: item.description,
      favicon: item.profile?.img,
      date: item.age,
    }))
  }

  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// Export for use in main application
// ─────────────────────────────────────────────────────────────────────────────

export { ChainOfThoughtEnhanced } from './chain-of-thought-enhanced'
export { WebPreview, WebPreviewBody } from './web-preview'
