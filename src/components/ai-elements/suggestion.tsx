/**
 * Suggestion Components - Sleek & Minimal
 * 
 * Pill-shaped suggestions inspired by bolt.new and lovable.dev
 * Sophisticated, refined, and undeniably beautiful.
 */

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

const EASE = [0.16, 1, 0.3, 1] as const

// ─────────────────────────────────────────────────────────────────────────────
// Suggestions Container
// ─────────────────────────────────────────────────────────────────────────────

interface SuggestionsProps {
  children: React.ReactNode
  layout?: 'horizontal' | 'grid' | 'wrap'
  className?: string
}

export function Suggestions({ children, layout = 'wrap', className }: SuggestionsProps) {
  return (
    <div 
      className={cn(
        layout === 'horizontal' && 'flex gap-2 overflow-x-auto scrollbar-none',
        layout === 'grid' && 'grid grid-cols-2 gap-2',
        layout === 'wrap' && 'flex flex-wrap gap-2',
        className
      )}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: index * 0.04, ease: EASE }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion - Sleek Pill Design
// ─────────────────────────────────────────────────────────────────────────────

interface SuggestionProps {
  suggestion: string
  onClick?: (suggestion: string) => void
  icon?: React.ReactNode
  variant?: 'pill' | 'card' | 'ghost'
  className?: string
  children?: React.ReactNode
}

export function Suggestion({ 
  suggestion, 
  onClick, 
  icon,
  variant = 'pill',
  className,
  children 
}: SuggestionProps) {
  const handleClick = () => {
    onClick?.(suggestion)
  }

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'group transition-all duration-300 ease-out',
        
        // Pill variant - default sleek style
        variant === 'pill' && [
          'inline-flex items-center gap-2',
          'px-4 py-2 rounded-full',
          'bg-surface-50 dark:bg-surface-850',
          'border border-surface-200 dark:border-surface-700',
          'hover:border-surface-300 dark:hover:border-surface-600',
          'hover:bg-surface-100 dark:hover:bg-surface-800',
        ],
        
        // Card variant - fuller appearance
        variant === 'card' && [
          'flex items-center gap-3 w-full',
          'p-3 rounded-xl',
          'bg-surface-50 dark:bg-surface-850',
          'border border-surface-200 dark:border-surface-700',
          'hover:border-surface-300 dark:hover:border-surface-600',
          'hover:bg-surface-100 dark:hover:bg-surface-800',
          'text-left',
        ],
        
        // Ghost variant - minimal
        variant === 'ghost' && [
          'inline-flex items-center gap-2',
          'px-3 py-1.5 rounded-lg',
          'hover:bg-surface-100 dark:hover:bg-surface-800',
        ],
        
        className
      )}
    >
      {icon && (
        <span className={cn(
          'flex-shrink-0 transition-opacity',
          variant === 'pill' && 'text-ink-muted/50 dark:text-ink-inverse-muted/50 group-hover:text-ink-muted dark:group-hover:text-ink-inverse-muted text-sm font-light',
          variant === 'card' && 'text-lg',
          variant === 'ghost' && 'text-ink-muted dark:text-ink-inverse-muted text-sm',
        )}>
          {icon}
        </span>
      )}
      
      <span className={cn(
        'transition-colors duration-200',
        variant === 'pill' && 'text-body-sm text-ink-secondary dark:text-ink-inverse-secondary group-hover:text-ink dark:group-hover:text-ink-inverse',
        variant === 'card' && 'text-body-sm text-ink-secondary dark:text-ink-inverse-secondary group-hover:text-ink dark:group-hover:text-ink-inverse',
        variant === 'ghost' && 'text-body-xs text-ink-muted dark:text-ink-inverse-muted group-hover:text-ink dark:group-hover:text-ink-inverse',
      )}>
        {children || suggestion}
      </span>
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SuggestionChip - Ultra Minimal Pill
// ─────────────────────────────────────────────────────────────────────────────

interface SuggestionChipProps {
  text: string
  onClick?: (text: string) => void
  icon?: React.ReactNode
  className?: string
}

export function SuggestionChip({ text, onClick, icon, className }: SuggestionChipProps) {
  return (
    <motion.button
      onClick={() => onClick?.(text)}
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'group inline-flex items-center gap-1.5',
        'px-3 py-1.5 rounded-full',
        'bg-surface-50 dark:bg-surface-850',
        'border border-surface-200 dark:border-surface-700',
        'hover:border-surface-300 dark:hover:border-surface-600',
        'hover:bg-surface-100 dark:hover:bg-surface-800',
        'transition-all duration-300 ease-out',
        className
      )}
    >
      {icon && (
        <span className="w-3.5 h-3.5 text-ink-muted/50 dark:text-ink-inverse-muted/50 group-hover:text-ink-muted dark:group-hover:text-ink-inverse-muted transition-colors">
          {icon}
        </span>
      )}
      <span className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary group-hover:text-ink dark:group-hover:text-ink-inverse transition-colors">
        {text}
      </span>
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FollowUpSuggestions - Contextual Pills
// ─────────────────────────────────────────────────────────────────────────────

interface FollowUpSuggestionsProps {
  suggestions: string[]
  onSelect: (suggestion: string) => void
  className?: string
}

export function FollowUpSuggestions({ suggestions, onSelect, className }: FollowUpSuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1, ease: EASE }}
      className={cn('space-y-3', className)}
    >
      <p className="text-body-xs text-ink-muted/60 dark:text-ink-inverse-muted/60">
        Related
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <SuggestionChip
            key={index}
            text={suggestion}
            onClick={onSelect}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickActions - Minimal Action Pills
// ─────────────────────────────────────────────────────────────────────────────

interface QuickAction {
  id: string
  label: string
  icon?: string
  onClick: () => void
}

interface QuickActionsProps {
  actions: QuickAction[]
  className?: string
}

export function QuickActions({ actions, className }: QuickActionsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {actions.map((action, index) => (
        <motion.button
          key={action.id}
          onClick={action.onClick}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.03 }}
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'group inline-flex items-center gap-2',
            'px-4 py-2 rounded-full',
            'bg-surface-50 dark:bg-surface-850',
            'border border-surface-200 dark:border-surface-700',
            'hover:border-surface-300 dark:hover:border-surface-600',
            'hover:bg-surface-100 dark:hover:bg-surface-800',
            'transition-all duration-300 ease-out',
          )}
        >
          {action.icon && (
            <span className="text-ink-muted/50 dark:text-ink-inverse-muted/50 group-hover:text-ink-muted dark:group-hover:text-ink-inverse-muted transition-colors text-sm">
              {action.icon}
            </span>
          )}
          <span className="text-body-sm text-ink-secondary dark:text-ink-inverse-secondary group-hover:text-ink dark:group-hover:text-ink-inverse transition-colors">
            {action.label}
          </span>
        </motion.button>
      ))}
    </div>
  )
}
