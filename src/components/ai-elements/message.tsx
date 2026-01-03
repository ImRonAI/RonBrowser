/**
 * Message Components
 * 
 * Display individual chat messages with avatars, content, and role-based styling.
 */

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { MessageRole } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Message
// ─────────────────────────────────────────────────────────────────────────────

interface MessageProps {
  from: MessageRole
  children: React.ReactNode
  className?: string
}

export function Message({ from, children, className }: MessageProps) {
  const isUser = from === 'user'
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group flex items-start gap-3',
        isUser ? 'flex-row-reverse is-user' : 'is-assistant',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MessageAvatar
// ─────────────────────────────────────────────────────────────────────────────

interface MessageAvatarProps {
  src?: string
  name?: string
  fallback?: React.ReactNode
  className?: string
}

export function MessageAvatar({ src, name, fallback, className }: MessageAvatarProps) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  
  return (
    <div 
      className={cn(
        'flex-shrink-0 w-8 h-8 rounded-xl overflow-hidden',
        'flex items-center justify-center',
        'bg-surface-200 dark:bg-surface-700',
        'text-body-sm font-medium text-ink-muted dark:text-ink-inverse-muted',
        // User styling
        'group-[.is-user]:bg-surface-200 group-[.is-user]:dark:bg-surface-700',
        // Assistant styling  
        'group-[.is-assistant]:bg-gradient-to-br group-[.is-assistant]:from-accent group-[.is-assistant]:to-accent-light',
        className
      )}
    >
      {src ? (
        <img 
          src={src} 
          alt={name || 'Avatar'} 
          className="w-full h-full object-cover"
        />
      ) : fallback ? (
        <span className="text-white">{fallback}</span>
      ) : (
        <span className="group-[.is-assistant]:text-white">{initials || '?'}</span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MessageContent
// ─────────────────────────────────────────────────────────────────────────────

interface MessageContentProps {
  children: React.ReactNode
  variant?: 'contained' | 'flat'
  className?: string
}

export function MessageContent({ children, variant = 'contained', className }: MessageContentProps) {
  return (
    <div 
      className={cn(
        'flex flex-col gap-2 max-w-[80%]',
        // User alignment
        'group-[.is-user]:items-end',
        // Assistant alignment
        'group-[.is-assistant]:items-start',
        className
      )}
    >
      <div
        className={cn(
          variant === 'contained' && [
            'px-4 py-3 rounded-2xl',
            // User styling
            'group-[.is-user]:bg-accent group-[.is-user]:dark:bg-accent-light',
            'group-[.is-user]:text-white group-[.is-user]:rounded-br-md',
            // Assistant styling
            'group-[.is-assistant]:bg-surface-100 group-[.is-assistant]:dark:bg-surface-800',
            'group-[.is-assistant]:text-ink group-[.is-assistant]:dark:text-ink-inverse',
            'group-[.is-assistant]:rounded-bl-md',
          ],
          variant === 'flat' && [
            'p-0',
            'group-[.is-assistant]:bg-transparent',
            'text-ink dark:text-ink-inverse',
          ]
        )}
      >
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MessageActions
// ─────────────────────────────────────────────────────────────────────────────

interface MessageActionsProps {
  children: React.ReactNode
  className?: string
}

export function MessageActions({ children, className }: MessageActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'flex items-center gap-1 mt-1',
        'opacity-0 group-hover:opacity-100',
        'transition-opacity duration-200',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
