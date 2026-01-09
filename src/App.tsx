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

  // Simulate search results for demo (in production, this would come from API)
  useEffect(() => {
    if (searchPhase === 'reasoning' && quickResult) {
      simulateSearchStream()
    }
  }, [searchPhase])

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
function simulateSearchStream() {
  const store = useSearchStore.getState()
  
  // Add reasoning steps
  const steps = [
    { id: 'step-1', label: 'Analyzing query', description: 'Understanding search intent and key concepts', status: 'running' as const },
    { id: 'step-2', label: 'Searching sources', description: 'Querying multiple data providers', status: 'pending' as const },
    { id: 'step-3', label: 'Synthesizing results', description: 'Combining and ranking findings', status: 'pending' as const },
  ]
  
  // Add first step
  store.addReasoningStep(steps[0])
  
  // Simulate progression
  setTimeout(() => {
    store.updateReasoningStep('step-1', { status: 'complete', reasoning: 'Identified key topics: AI, machine learning, neural networks' })
    store.addReasoningStep({ ...steps[1], status: 'running' })
  }, 1500)
  
  setTimeout(() => {
    store.updateReasoningStep('step-2', { status: 'complete', reasoning: 'Found 15 relevant sources across web, academic, and video content' })
    store.addReasoningStep({ ...steps[2], status: 'running' })
    
    // Add sources
    const mockSources: SourceData[] = [
      { id: '1', url: 'https://arxiv.org/abs/1706.03762', title: 'Attention Is All You Need', snippet: 'The dominant sequence transduction models...', domain: 'arxiv.org', type: 'academic' },
      { id: '2', url: 'https://youtube.com/watch?v=aircAruvnKk', title: 'But what is a neural network?', snippet: 'Deep learning explained visually...', domain: 'youtube.com', type: 'video' },
      { id: '3', url: 'https://www.technologyreview.com/deep-learning', title: 'Deep Learning Explained', snippet: 'A comprehensive guide to deep learning...', domain: 'technologyreview.com', type: 'web' },
      { id: '4', url: 'https://github.com/tensorflow/tensorflow', title: 'TensorFlow - Machine Learning Framework', snippet: 'An open source ML framework...', domain: 'github.com', type: 'code' as any },
      { id: '5', url: 'https://pytorch.org/tutorials', title: 'PyTorch Tutorials', snippet: 'Learn deep learning with PyTorch...', domain: 'pytorch.org', type: 'web' },
    ]
    store.setSources(mockSources)
  }, 3000)
  
  // Start answer streaming
  setTimeout(() => {
    store.updateReasoningStep('step-3', { status: 'complete' })
    
    const fullAnswer = `Artificial intelligence and machine learning are transforming how we interact with technology. At its core, machine learning enables computers to learn patterns from data without being explicitly programmed for each task.

Neural networks, inspired by the human brain, form the foundation of modern deep learning. These networks consist of layers of interconnected nodes that process and transform data, enabling remarkable capabilities in image recognition, natural language processing, and decision-making.

The field has seen explosive growth with the introduction of transformer architectures in 2017, which power today's large language models. Key frameworks like TensorFlow and PyTorch have democratized access to these technologies, enabling researchers and developers worldwide to build sophisticated AI applications.`
    
    // Stream answer character by character (simulated)
    let currentIndex = 0
    const streamInterval = setInterval(() => {
      if (currentIndex < fullAnswer.length) {
        const chunkSize = Math.floor(Math.random() * 5) + 3 // 3-7 chars at a time
        const chunk = fullAnswer.slice(currentIndex, currentIndex + chunkSize)
        store.appendAnswer(chunk)
        currentIndex += chunkSize
      } else {
        clearInterval(streamInterval)
        store.setIsStreaming(false)
        store.updateQuickResult({
          relatedQueries: [
            'deep learning fundamentals',
            'neural network architecture',
            'transformer models explained',
            'AI applications in healthcare',
          ],
        })
      }
    }, 50)
  }, 4500)
}
