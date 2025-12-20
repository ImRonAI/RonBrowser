import { useEffect } from 'react'
import { useUserPreferencesStore } from '@/stores/userPreferencesStore'

/**
 * Hook for managing theme (light/dark/glass mode)
 * Integrates with userPreferencesStore and handles DOM class management
 */
export function useTheme() {
  const { theme, setTheme, toggleTheme } = useUserPreferencesStore()

  useEffect(() => {
    // Apply theme on mount and when it changes
    const root = document.documentElement

    const applyTheme = (themeValue: typeof theme) => {
      // Remove all theme classes first
      root.classList.remove('dark', 'glass')

      if (themeValue === 'dark') {
        root.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else if (themeValue === 'glass') {
        root.classList.add('glass')
        localStorage.setItem('theme', 'glass')
      } else if (themeValue === 'light') {
        localStorage.setItem('theme', 'light')
      } else {
        // System preference
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (isDark) {
          root.classList.add('dark')
        }
        localStorage.setItem('theme', 'system')
      }
    }

    applyTheme(theme)

    // Listen for system theme changes when in system mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        root.classList.remove('dark', 'glass')
        if (e.matches) {
          root.classList.add('dark')
        }
      }
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [theme])

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark' ||
           (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
    isGlass: theme === 'glass'
  }
}