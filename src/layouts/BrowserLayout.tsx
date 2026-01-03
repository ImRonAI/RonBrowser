import { ReactNode, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChromeToolbar } from '@/components/chrome/ChromeToolbar'
import { TabBar } from '@/components/chrome/TabBar'
import { AgentPanel } from '@/components/agent-panel/AgentPanel'
import { ScreenVisionOverlay } from '@/components/agent-panel/ScreenVisionOverlay'
import { InterestsWidget } from '@/components/interests/InterestsWidget'
import { ContextMenu } from '@/components/shared/ContextMenu'
import { useAgentStore } from '@/stores/agentStore'
import { cn } from '@/utils/cn'

interface BrowserLayoutProps {
  children: ReactNode
}

export function BrowserLayout({ children }: BrowserLayoutProps) {
  const { isPanelOpen } = useAgentStore()
  const [isExternalMode, setIsExternalMode] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    isOpen: boolean
    selectedText?: string
  }>({
    x: 0,
    y: 0,
    isOpen: false,
  })

  // Listen for external mode changes and Ask Ron events from main process
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electron?.browser) {
      const modeCleanup = window.electron.browser.onExternalMode((isExternal: boolean) => {
        setIsExternalMode(isExternal)
      })

      const askRonCleanup = window.electron.browser.onAskRon(({ selectionText, sourceUrl }) => {
        useAgentStore.getState().startAskRon(selectionText, sourceUrl)
      })

      return () => {
        modeCleanup()
        askRonCleanup()
      }
    }
  }, [])

  // Handle right-click to show context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()

      const selection = window.getSelection()
      const selectedText = selection?.toString().trim()

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        isOpen: true,
        selectedText,
      })
    }

    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  return (
    <div className={cn(
      "flex flex-col h-screen overflow-hidden",
      "bg-surface-0 dark:bg-surface-900"
    )}>
      {/* Browser Chrome - Elevated Header */}
      <div className={cn(
        "flex-shrink-0 relative z-[100]",
        // Background
        "bg-surface-0/95 dark:bg-surface-900/95",
        "backdrop-blur-xl",
        // Border
        "border-b border-surface-200 dark:border-surface-700",
        // Shadow
        "shadow-subtle dark:shadow-none"
      )}>
        {/* Subtle inner glow at top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-surface-200 dark:via-surface-700 to-transparent" />
        
        <ChromeToolbar />
        <TabBar />
        
        {/* Bottom accent line */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/10 dark:via-accent-light/10 to-transparent" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* React content - hidden when WebContentsView is showing external websites */}
        {!isExternalMode && (
          <div className="h-full overflow-auto scrollbar-thin">
            {children}
          </div>
        )}

        {/* Agent Panel Overlay */}
        <AgentPanel />

        {/* Screen Vision Overlay */}
        <ScreenVisionOverlay />

        {/* Interests Widget */}
        <InterestsWidget />

        {/* Panel backdrop */}
        <AnimatePresence>
          {isPanelOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-ink/5 dark:bg-ink-inverse/5 backdrop-blur-[2px] z-40"
              onClick={() => useAgentStore.getState().closePanel()}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Context Menu */}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isOpen={contextMenu.isOpen}
        selectedText={contextMenu.selectedText}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
