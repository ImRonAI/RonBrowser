/**
 * Chain of Thought - Desktop/Computer Use Components
 * 
 * Visualize computer automation actions like clicking, typing, app switching.
 */

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DesktopOS = 'macos' | 'windows' | 'linux'

export type DesktopActionType = 
  | 'click'
  | 'double_click'
  | 'right_click'
  | 'type'
  | 'key_press'
  | 'scroll'
  | 'drag'
  | 'launch_app'
  | 'switch_app'
  | 'screenshot'

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtDesktopPreview
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtDesktopPreviewProps {
  os?: DesktopOS
  screenshot?: string
  activeApp?: string
  cursorPosition?: { x: number; y: number }
  highlightArea?: { x: number; y: number; width: number; height: number }
  height?: number
  className?: string
  children?: React.ReactNode
}

export function ChainOfThoughtDesktopPreview({
  os = 'macos',
  screenshot,
  activeApp,
  cursorPosition,
  highlightArea,
  height = 300,
  className,
  children
}: ChainOfThoughtDesktopPreviewProps) {
  return (
    <div className={cn(
      'rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden',
      'bg-surface-900',
      className
    )}>
      {/* Desktop chrome (menu bar) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-800 border-b border-surface-700">
        {os === 'macos' && (
          <>
            <div className="flex items-center gap-4">
              <AppleIcon className="w-4 h-4 text-surface-300" />
              <span className="text-body-xs font-medium text-surface-200">
                {activeApp || 'Finder'}
              </span>
              <span className="text-body-xs text-surface-400">File</span>
              <span className="text-body-xs text-surface-400">Edit</span>
              <span className="text-body-xs text-surface-400">View</span>
            </div>
            <div className="flex items-center gap-2 text-body-xs text-surface-300">
              <WifiIcon className="w-4 h-4" />
              <BatteryIcon className="w-4 h-4" />
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </>
        )}
        {os === 'windows' && (
          <div className="flex items-center gap-2">
            <WindowsIcon className="w-4 h-4 text-surface-300" />
            <span className="text-body-xs text-surface-200">{activeApp || 'Desktop'}</span>
          </div>
        )}
        {os === 'linux' && (
          <div className="flex items-center gap-2">
            <LinuxIcon className="w-4 h-4 text-surface-300" />
            <span className="text-body-xs text-surface-200">{activeApp || 'Desktop'}</span>
          </div>
        )}
      </div>

      {/* Screen content */}
      <div className="relative" style={{ height }}>
        {screenshot ? (
          <img 
            src={screenshot} 
            alt="Desktop screenshot"
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900 to-blue-900">
            <span className="text-surface-400 text-body-sm">No screenshot</span>
          </div>
        )}

        {/* Cursor indicator */}
        {cursorPosition && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute pointer-events-none"
            style={{ 
              left: `${cursorPosition.x}%`, 
              top: `${cursorPosition.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <CursorIcon className="w-6 h-6 text-white drop-shadow-lg" />
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-accent/30"
            />
          </motion.div>
        )}

        {/* Highlight area */}
        {highlightArea && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute border-2 border-cyan-500 bg-cyan-500/10 rounded"
            style={{
              left: `${highlightArea.x}%`,
              top: `${highlightArea.y}%`,
              width: `${highlightArea.width}%`,
              height: `${highlightArea.height}%`,
            }}
          />
        )}
      </div>

      {/* macOS dock */}
      {os === 'macos' && (
        <div className="flex items-center justify-center gap-1 py-2 bg-surface-800/80 backdrop-blur border-t border-surface-700">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600" title="Finder" />
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500" title="Safari" />
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-teal-500" title="Messages" />
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500" title="Music" />
        </div>
      )}

      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtDesktopAction
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtDesktopActionProps {
  action: DesktopActionType
  target?: string
  value?: string
  coordinates?: { x: number; y: number }
  status: 'pending' | 'running' | 'complete' | 'error'
  duration?: number
  className?: string
}

export function ChainOfThoughtDesktopAction({
  action,
  target,
  value,
  coordinates,
  status,
  duration,
  className
}: ChainOfThoughtDesktopActionProps) {
  const config = getDesktopActionConfig(action)

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg',
      'bg-purple-50 dark:bg-purple-900/20',
      'border border-purple-200 dark:border-purple-800',
      className
    )}>
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center',
        'bg-purple-100 dark:bg-purple-900/40'
      )}>
        {status === 'running' ? (
          <Loader size={16} />
        ) : (
          <config.Icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            {config.label}
          </span>
          <span className="text-label px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
            desktop
          </span>
        </div>

        {target && (
          <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary mt-0.5">
            {target}
          </p>
        )}

        {value && (
          <code className="text-body-xs font-mono text-purple-600 dark:text-purple-400 mt-0.5 block">
            {action === 'type' ? `"${value}"` : value}
          </code>
        )}

        {coordinates && (
          <span className="text-label text-ink-muted">
            ({coordinates.x}, {coordinates.y})
          </span>
        )}
      </div>

      {duration !== undefined && status === 'complete' && (
        <span className="text-label text-ink-muted">{duration}ms</span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDesktopActionConfig(action: DesktopActionType) {
  const configs: Record<DesktopActionType, { Icon: React.FC<{ className?: string }>; label: string }> = {
    click: { Icon: CursorClickIcon, label: 'Click' },
    double_click: { Icon: CursorClickIcon, label: 'Double Click' },
    right_click: { Icon: CursorClickIcon, label: 'Right Click' },
    type: { Icon: KeyboardIcon, label: 'Type' },
    key_press: { Icon: KeyboardIcon, label: 'Key Press' },
    scroll: { Icon: ScrollIcon, label: 'Scroll' },
    drag: { Icon: MoveIcon, label: 'Drag' },
    launch_app: { Icon: AppIcon, label: 'Launch App' },
    switch_app: { Icon: SwitchIcon, label: 'Switch App' },
    screenshot: { Icon: CameraIcon, label: 'Screenshot' },
  }
  return configs[action]
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm17 .25V22l-10-1.91V13.1l10 .15z"/>
    </svg>
  )
}

function LinuxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </svg>
  )
}

function WifiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  )
}

function BatteryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="18" height="12" rx="2" ry="2" />
      <line x1="23" y1="13" x2="23" y2="11" />
    </svg>
  )
}

function CursorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4l7.07 17 2.51-7.39L21 11.07 4 4z"/>
    </svg>
  )
}

function CursorClickIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9l5 12 1.774-5.226L21 14 9 9z" />
      <path d="M16.071 16.071l4.243 4.243" />
      <path d="m7.188 2.239.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  )
}

function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
    </svg>
  )
}

function ScrollIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M5 10l7-7 7 7M5 14l7 7 7-7" />
    </svg>
  )
}

function MoveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 9 2 12 5 15" />
      <polyline points="9 5 12 2 15 5" />
      <polyline points="15 19 12 22 9 19" />
      <polyline points="19 9 22 12 19 15" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  )
}

function AppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function SwitchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}


