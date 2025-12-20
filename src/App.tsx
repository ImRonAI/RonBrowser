import { useEffect } from 'react'
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

// ============================================
// DEV MODE FLAGS
// ============================================
const RESET_APP_ON_LAUNCH = true

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        resetAppStorage()
        sessionStorage.removeItem('app-reset-this-session')
        window.location.reload()
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