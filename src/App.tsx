import { useEffect, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { useTabStore } from '@/stores/tabStore'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useInterestsStore } from '@/stores/interestsStore'
import { BrowserLayout } from '@/layouts/BrowserLayout'
import { AuthPageLayout } from '@/layouts/AuthPageLayout'
import { HomePage } from '@/pages/HomePage'
import { SignInPage } from '@/pages/SignInPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { AIElementsShowcase } from '@/pages/AIElementsShowcase'
import { SearchResultsPage } from '@/pages/SearchResultsPage'

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
  console.log('🧹 All storage cleared!')
}

export function App() {
  const { isDark } = useTheme()
  const { isAuthenticated } = useAuthStore()
  const { tabs, createTab } = useTabStore()
  const { isComplete } = useOnboardingStore()
  // Check URL hash for showcase mode
  const [showShowcase, setShowShowcase] = useState(() => {
    return window.location.hash === '#showcase'
  })

  // Check URL hash for search results mode
  const [showSearchResults, setShowSearchResults] = useState(() => {
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
        setShowSearchResults(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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

  // DEV: Show AI Elements Showcase (accessible from any state via Cmd/Ctrl + Shift + S)
  if (showShowcase) {
    return <AIElementsShowcase />
  }

  // DEV: Show Search Results Page (accessible from any state via #search or #results hash, or Cmd/Ctrl + Shift + R)
  if (showSearchResults) {
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

  // Main browser interface
  return (
    <BrowserLayout>
      <HomePage />
    </BrowserLayout>
  )
}