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

  // Handle right-click to show context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()

      // Get selected text if any
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
      "bg-ron-white dark:bg-ron-black glass:bg-transparent"
    )}>
      {/* Browser Chrome - Elevated Glass Header */}
      <div className={cn(
        "flex-shrink-0 relative z-50",
        // Base glass treatment
        "bg-white/70 dark:bg-ron-smoke/80 glass:bg-white/30",
        "backdrop-blur-xl backdrop-saturate-150",
        // Border
        "border-b border-ron-text/5 dark:border-white/5 glass:border-white/30",
        // Shadow for depth
        "shadow-sm shadow-black/5 dark:shadow-black/20"
      )}>
        {/* Subtle inner glow at top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 glass:via-white/60 to-transparent" />
        
        <ChromeToolbar />
        <TabBar />
        
        {/* Bottom accent line */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-royal/10 dark:via-royal-light/10 glass:via-royal/20 to-transparent" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        <div className="h-full overflow-auto">
          {children}
        </div>

        {/* Agent Panel Overlay */}
        <AgentPanel />

        {/* Screen Vision Overlay */}
        <ScreenVisionOverlay />

        {/* Interests Widget - Neural Network Visualization */}
        <InterestsWidget />

        {/* Panel backdrop with smooth animation */}
        <AnimatePresence>
          {isPanelOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-black/10 dark:bg-black/30 glass:bg-black/5 backdrop-blur-[2px] z-40"
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