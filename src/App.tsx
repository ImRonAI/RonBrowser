import { useEffect, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { useTabStore } from '@/stores/tabStore'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useInterestsStore } from '@/stores/interestsStore'
import { useSearchStore, selectShowQuickResults, selectShowFullResults, selectShowChat } from '@/stores/searchStore'
import { BrowserLayout } from '@/layouts/BrowserLayout'
import { AuthPageLayout } from '@/layouts/AuthPageLayout'
import { HomePage } from '@/pages/HomePage'
import { SignInPage } from '@/pages/SignInPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { AIElementsShowcase } from '@/pages/AIElementsShowcase'
import { SearchResultsPage } from '@/pages/SearchResultsPage'
import { SearchThinkingOverlay, SearchQuickResults, SearchChat } from '@/components/search-results'
import type { SourceData } from '@/components/search-results/SourceCard'

// ============================================
// DEV MODE FLAGS
// ============================================
const RESET_APP_ON_LAUNCH = false // Disabled to test showcase

// Clear storage AND reset Zustand stores
function resetAppStorage() {
  localStorage.clear()
  useAuthStore.persist.clearStorage()
  useTabStore.persist.clearStorage()
  useOnboardingStore.persist.clearStorage()
  useInterestsStore.persist.clearStorage()
  console.log('All storage cleared!')
}

export function App() {
  const { isDark } = useTheme()
  const { isAuthenticated } = useAuthStore()
  const { tabs, createTab } = useTabStore()
  const { isComplete } = useOnboardingStore()
  const searchStore = useSearchStore()
  const { 
    phase: searchPhase, 
    query: searchQuery, 
    quickResult,
    isStreaming,
    goToFullResults,
    goToChat,
    tryAgain,
    clearSearch,
  } = searchStore
  
  const showQuickResults = selectShowQuickResults(searchStore)
  const showFullResults = selectShowFullResults(searchStore)
  const showChat = selectShowChat(searchStore)
  const showThinking = searchPhase === 'thinking'
  
  // Check URL hash for showcase mode
  const [showShowcase, setShowShowcase] = useState(() => {
    return window.location.hash === '#showcase'
  })

  // Check URL hash for search results mode (DEV override)
  const [showSearchResultsDev, setShowSearchResultsDev] = useState(() => {
    return window.location.hash === '#search' || window.location.hash === '#results'
  })
  
  // DEV: Reset app on launch if flag is set
  useEffect(() => {
    if (RESET_APP_ON_LAUNCH) {
      // Check if we've already reset this session (to avoid infinite reload loop)
      const hasReset = sessionStorage.getItem('app-reset-this-session')
      if (!hasReset) {
        resetAppStorage()
        sessionStorage.setItem('app-reset-this-session', 'true')
        // Force reload to apply cleared state
        window.location.reload()
        return
      }
    }
  }, [])

  // DEV: Keyboard shortcut to reset app (Cmd/Ctrl + Shift + K)
  // DEV: Keyboard shortcut to toggle showcase (Cmd/Ctrl + Shift + S)
  // DEV: Keyboard shortcut to toggle search results (Cmd/Ctrl + Shift + R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        resetAppStorage()
        sessionStorage.removeItem('app-reset-this-session')
        window.location.reload()
      }
      // Toggle AI Elements Showcase with Cmd/Ctrl + Shift + S
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        setShowShowcase(prev => !prev)
      }
      // Toggle Search Results Page with Cmd/Ctrl + Shift + R
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault()
        setShowSearchResultsDev(prev => !prev)
      }
      // ESC to clear search
      if (e.key === 'Escape' && searchPhase !== 'idle') {
        e.preventDefault()
        clearSearch()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchPhase, clearSearch])

  // Initialize with at least one tab
  useEffect(() => {
    if (isAuthenticated && isComplete && tabs.length === 0) {
      createTab('ron://home', true)
    }
  }, [isAuthenticated, isComplete, tabs.length, createTab])

  // Apply theme class to document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  // Stream search results from Sonar Reasoning Pro API
  useEffect(() => {
    if (searchPhase === 'reasoning' && quickResult) {
      streamSonarReasoningPro(quickResult.query)
    }
  }, [searchPhase, quickResult])

  // DEV: Show AI Elements Showcase (accessible from any state via Cmd/Ctrl + Shift + S)
  if (showShowcase) {
    return <AIElementsShowcase />
  }

  // DEV: Show Search Results Page (accessible from any state via #search or #results hash, or Cmd/Ctrl + Shift + R)
  // Also show when full results phase is active
  if (showSearchResultsDev || showFullResults) {
    return (
      <BrowserLayout>
        <SearchResultsPage />
      </BrowserLayout>
    )
  }

  // If not authenticated, show sign in page
  if (!isAuthenticated) {
    return (
      <AuthPageLayout>
        <SignInPage />
      </AuthPageLayout>
    )
  }

  // If not onboarded, show onboarding page
  if (!isComplete) {
    return <OnboardingPage />
  }

  // Handler functions for search quick results
  const handleSendToRon = (source: SourceData) => {
    console.log('Send to Ron:', source)
    // TODO: Implement Ron agent integration
  }

  const handleSendToCoding = (source: SourceData) => {
    console.log('Send to Coding:', source)
    // TODO: Implement coding agent integration
  }

  const handleAttachToTask = (source: SourceData) => {
    console.log('Attach to Task:', source)
    // TODO: Implement task attachment
  }

  const handleStartTask = (source: SourceData) => {
    console.log('Start Task:', source)
    // TODO: Implement task creation
  }

  // Main browser interface with search overlays
  return (
    <>
      <BrowserLayout>
        {/* Show chat interface when in chatting phase */}
        {showChat && quickResult ? (
          <SearchChat
            searchResult={quickResult}
            onBack={() => clearSearch()}
          />
        ) : showQuickResults && quickResult ? (
          <div className="h-full overflow-auto bg-surface-0 dark:bg-surface-900">
            <SearchQuickResults
              result={quickResult}
              isStreaming={isStreaming}
              onSeeFullResults={goToFullResults}
              onTryAgain={tryAgain}
              onLetsChat={goToChat}
              onSendToRon={handleSendToRon}
              onSendToCoding={handleSendToCoding}
              onAttachToTask={handleAttachToTask}
              onStartTask={handleStartTask}
            />
          </div>
        ) : (
          <HomePage />
        )}
      </BrowserLayout>

      {/* Thinking overlay - shows during initial search animation */}
      <SearchThinkingOverlay
        isVisible={showThinking}
        query={searchQuery}
      />
    </>
  )
}

// ============================================
// DEMO: Simulate search streaming
// In production, this would be replaced with actual API calls
// ============================================
async function streamSonarReasoningPro(query: string) {
  const store = useSearchStore.getState()

  // Reset state for new search
  store.setIsStreaming(true)

  // Create reasoning step for displaying progress
  const reasoningStepId = 'reasoning-1'
  store.addReasoningStep({
    id: reasoningStepId,
    label: 'Deep Reasoning',
    description: 'Analyzing your query with advanced reasoning',
    status: 'running'
  })

  try {
    const response = await fetch('http://localhost:8765/api/sonar-reasoning-pro/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `You are a sophisticated search assistant. Show your step-by-step reasoning in <think> tags, then provide a comprehensive answer with inline citations [1], [2], [3].`
          },
          {
            role: 'user',
            content: query
          }
        ],
        reasoning_effort: 'high',
        temperature: 0.2
      })
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body available')
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
          const data = line.slice(6).trim()
          if (data === '[DONE]' || !data) continue

          try {
            const event = JSON.parse(data)

            switch (event.type) {
              case 'reasoning_start':
                store.updateReasoningStep(reasoningStepId, {
                  status: 'running',
                  reasoning: ''
                })
                break

              case 'reasoning':
                const currentStep = store.getState().quickResult?.reasoning.find(r => r.id === reasoningStepId)
                store.updateReasoningStep(reasoningStepId, {
                  reasoning: (currentStep?.reasoning || '') + event.content
                })
                break

              case 'reasoning_end':
                store.updateReasoningStep(reasoningStepId, { status: 'complete' })
                break

              case 'content':
                store.appendAnswer(event.content)
                break

              case 'metadata':
                if (event.citations) {
                  const sources = event.citations.map((c: any) => ({
                    id: c.id,
                    url: c.url,
                    title: c.title,
                    snippet: c.snippet,
                    domain: c.domain,
                    type: 'web' as const
                  }))
                  store.setSources(sources)
                }
                if (event.finish_reason === 'stop') {
                  store.setIsStreaming(false)
                }
                break

              case 'error':
                console.error('Streaming error:', event.error)
                store.updateReasoningStep(reasoningStepId, {
                  status: 'complete',
                  reasoning: `Error: ${event.error}`
                })
                store.setIsStreaming(false)
                break
            }
          } catch (e) {
            console.error('Failed to parse SSE event:', e)
          }
        }
      }
    }
  } catch (error) {
    console.error('Sonar Reasoning Pro streaming error:', error)
    store.updateReasoningStep(reasoningStepId, {
      status: 'complete',
      reasoning: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
    store.setIsStreaming(false)
  }
}
