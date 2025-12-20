import { ReactNode, useState, useEffect } from 'react'
import { ContextMenu } from '@/components/shared/ContextMenu'

interface AuthPageLayoutProps {
  children: ReactNode
}

export function AuthPageLayout({ children }: AuthPageLayoutProps) {
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
    <div className="min-h-screen bg-ron-white dark:bg-ron-black glass:bg-transparent flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-georgia text-royal dark:text-royal-light">
            Ron Browser
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 font-raleway font-raleway-light">
            Your intelligent browsing companion
          </p>
        </div>

        {/* Auth Form Container */}
        <div className="bg-white dark:bg-ron-smoke rounded-lg shadow-xl p-8">
          {children}
        </div>
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