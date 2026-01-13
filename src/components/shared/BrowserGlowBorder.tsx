/**
 * BrowserGlowBorder Component
 * 
 * A stunning animated glow border that appears around the entire app
 * when the browser tool is being actively used by the agent.
 * 
 * Features:
 * - Purple, dark blue, and teal gradient glow
 * - Approximately 40-60px (one fingerwidth) in height
 * - Smooth fade in/out animation
 * - Persists across website navigation
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/stores/agentStore'
import { useMemo } from 'react'

export function BrowserGlowBorder() {
  // Check if browser tool is currently being used
  const currentToolUse = useAgentStore((state) => state.currentToolUse)
  const isStreaming = useAgentStore((state) => state.isStreaming)
  
  // Detect if the browser tool is active
  const isBrowserToolActive = useMemo(() => {
    if (!currentToolUse) return false
    
    // Match browser-related tool names
    const browserToolNames = ['browser', 'navigate', 'click', 'type', 'screenshot', 'get_text', 'get_html', 'evaluate']
    const toolName = currentToolUse.name?.toLowerCase() || ''
    
    return browserToolNames.some(name => toolName.includes(name)) && 
           currentToolUse.status === 'running'
  }, [currentToolUse])
  
  // Also show glow during any streaming with browser context
  const showGlow = isBrowserToolActive || (isStreaming && currentToolUse?.name?.toLowerCase().includes('browser'))

  return (
    <AnimatePresence>
      {showGlow && (
        <>
          {/* Top border glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="fixed top-0 left-0 right-0 h-[50px] pointer-events-none z-[9999]"
            style={{
              background: `
                linear-gradient(
                  to bottom,
                  rgba(139, 92, 246, 0.4),
                  rgba(88, 28, 135, 0.25) 30%,
                  rgba(20, 184, 166, 0.15) 60%,
                  transparent
                )
              `,
              filter: 'blur(8px)',
            }}
          />
          
          {/* Bottom border glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 h-[50px] pointer-events-none z-[9999]"
            style={{
              background: `
                linear-gradient(
                  to top,
                  rgba(139, 92, 246, 0.4),
                  rgba(88, 28, 135, 0.25) 30%,
                  rgba(20, 184, 166, 0.15) 60%,
                  transparent
                )
              `,
              filter: 'blur(8px)',
            }}
          />
          
          {/* Left border glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="fixed top-0 left-0 bottom-0 w-[50px] pointer-events-none z-[9999]"
            style={{
              background: `
                linear-gradient(
                  to right,
                  rgba(139, 92, 246, 0.4),
                  rgba(88, 28, 135, 0.25) 30%,
                  rgba(20, 184, 166, 0.15) 60%,
                  transparent
                )
              `,
              filter: 'blur(8px)',
            }}
          />
          
          {/* Right border glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="fixed top-0 right-0 bottom-0 w-[50px] pointer-events-none z-[9999]"
            style={{
              background: `
                linear-gradient(
                  to left,
                  rgba(139, 92, 246, 0.4),
                  rgba(88, 28, 135, 0.25) 30%,
                  rgba(20, 184, 166, 0.15) 60%,
                  transparent
                )
              `,
              filter: 'blur(8px)',
            }}
          />

          {/* Animated pulse overlay for extra visual impact */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.3, 0.6, 0.3],
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 2, 
              ease: 'easeInOut',
              repeat: Infinity,
            }}
            className="fixed inset-0 pointer-events-none z-[9998]"
            style={{
              background: `
                radial-gradient(
                  ellipse at center,
                  transparent 60%,
                  rgba(139, 92, 246, 0.08) 80%,
                  rgba(88, 28, 135, 0.12) 90%,
                  rgba(20, 184, 166, 0.06) 100%
                )
              `,
            }}
          />
        </>
      )}
    </AnimatePresence>
  )
}
