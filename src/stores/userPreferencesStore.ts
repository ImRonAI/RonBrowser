import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'glass' | 'system'
type InteractionMode = 'talk' | 'type'
type ContentDensity = 'compact' | 'comfortable' | 'spacious'
type SearchMode = 'ai-web' | 'deep-research' | 'chat'

interface UserPreferences {
  // Appearance
  theme: Theme
  contentDensity: ContentDensity
  showAnimations: boolean
  reduceMotion: boolean

  // Interaction
  defaultInteractionMode: InteractionMode
  defaultSearchMode: SearchMode
  autoPlayVideos: boolean
  openLinksInNewTab: boolean

  // Privacy
  doNotTrack: boolean
  blockTrackers: boolean
  clearBrowsingDataOnExit: boolean

  // Content
  showBiasIndicators: boolean
  showHypeScores: boolean
  preferSummaries: boolean
  articleViewMode: 'synthesis' | 'source' | 'counterpoint'

  // Notifications
  enableNotifications: boolean
  notifyOnBreakingNews: boolean
  notifyOnAgentMessages: boolean

  // Advanced
  developerMode: boolean
  experimentalFeatures: boolean
}

interface UserPreferencesState extends UserPreferences {
  // Actions
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setContentDensity: (density: ContentDensity) => void
  setInteractionMode: (mode: InteractionMode) => void
  setSearchMode: (mode: SearchMode) => void
  updatePreferences: (updates: Partial<UserPreferences>) => void
  resetToDefaults: () => void
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  contentDensity: 'comfortable',
  showAnimations: true,
  reduceMotion: false,
  defaultInteractionMode: 'type',
  defaultSearchMode: 'ai-web',
  autoPlayVideos: false,
  openLinksInNewTab: true,
  doNotTrack: true,
  blockTrackers: true,
  clearBrowsingDataOnExit: false,
  showBiasIndicators: true,
  showHypeScores: true,
  preferSummaries: true,
  articleViewMode: 'synthesis',
  enableNotifications: true,
  notifyOnBreakingNews: false,
  notifyOnAgentMessages: true,
  developerMode: false,
  experimentalFeatures: false
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PREFERENCES,

      setTheme: (theme: Theme) => {
        set({ theme })
        // Apply theme to document
        if (typeof window !== 'undefined') {
          const root = document.documentElement
          // Remove all theme classes first
          root.classList.remove('dark', 'glass')

          if (theme === 'dark') {
            root.classList.add('dark')
            localStorage.setItem('theme', 'dark')
          } else if (theme === 'glass') {
            root.classList.add('glass')
            localStorage.setItem('theme', 'glass')
          } else if (theme === 'light') {
            localStorage.setItem('theme', 'light')
          } else {
            // System preference
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            if (isDark) {
              root.classList.add('dark')
            }
            localStorage.setItem('theme', 'system')
          }

          // Notify Electron main process to apply native effects (vibrancy/acrylic)
          window.electron?.setTheme(theme)
        }
      },

      toggleTheme: () => {
        const currentTheme = get().theme
        // Cycle: light -> dark -> glass -> light
        const themeOrder: Theme[] = ['light', 'dark', 'glass']
        const currentIndex = themeOrder.indexOf(currentTheme === 'system' ? 'light' : currentTheme)
        const nextIndex = (currentIndex + 1) % themeOrder.length
        get().setTheme(themeOrder[nextIndex])
      },

      setContentDensity: (density: ContentDensity) => {
        set({ contentDensity: density })
      },

      setInteractionMode: (mode: InteractionMode) => {
        set({ defaultInteractionMode: mode })
      },

      setSearchMode: (mode: SearchMode) => {
        set({ defaultSearchMode: mode })
      },

      updatePreferences: (updates: Partial<UserPreferences>) => {
        set(state => ({ ...state, ...updates }))
        // Handle theme changes
        if (updates.theme) {
          get().setTheme(updates.theme)
        }
      },

      resetToDefaults: () => {
        set(DEFAULT_PREFERENCES)
        get().setTheme(DEFAULT_PREFERENCES.theme)
      }
    }),
    {
      name: 'user-preferences-storage'
    }
  )
)

// Initialize theme on app load
if (typeof window !== 'undefined') {
  const store = useUserPreferencesStore.getState()
  store.setTheme(store.theme)

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const store = useUserPreferencesStore.getState()
    if (store.theme === 'system') {
      const root = document.documentElement
      if (e.matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  })
}