/**
 * Shimmer Component
 * 
 * Loading skeleton with shimmer animation.
 */

import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// Shimmer
// ─────────────────────────────────────────────────────────────────────────────

interface ShimmerProps {
  className?: string
}

export function Shimmer({ className }: ShimmerProps) {
  return (
    <div 
      className={cn(
        'relative overflow-hidden',
        'bg-surface-200 dark:bg-surface-700',
        'rounded-md',
        className
      )}
    >
      <div 
        className={cn(
          'absolute inset-0',
          'bg-gradient-to-r from-transparent via-surface-100 dark:via-surface-600 to-transparent',
          'animate-shimmer'
        )}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ShimmerText
// ─────────────────────────────────────────────────────────────────────────────

interface ShimmerTextProps {
  lines?: number
  className?: string
}

export function ShimmerText({ lines = 3, className }: ShimmerTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer 
          key={i} 
          className={cn(
            'h-4',
            // Make last line shorter
            i === lines - 1 && 'w-3/4'
          )} 
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ShimmerMessage
// ─────────────────────────────────────────────────────────────────────────────

interface ShimmerMessageProps {
  showAvatar?: boolean
  className?: string
}

export function ShimmerMessage({ showAvatar = true, className }: ShimmerMessageProps) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      {showAvatar && (
        <Shimmer className="w-8 h-8 rounded-xl flex-shrink-0" />
      )}
      <div className="flex-1 space-y-2">
        <Shimmer className="h-4 w-1/4" />
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-5/6" />
        <Shimmer className="h-4 w-2/3" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ShimmerCard
// ─────────────────────────────────────────────────────────────────────────────

interface ShimmerCardProps {
  className?: string
}

export function ShimmerCard({ className }: ShimmerCardProps) {
  return (
    <div className={cn(
      'p-4 rounded-xl',
      'border border-surface-200 dark:border-surface-700',
      className
    )}>
      <div className="flex items-center gap-3 mb-4">
        <Shimmer className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-4 w-1/3" />
          <Shimmer className="h-3 w-1/4" />
        </div>
      </div>
      <ShimmerText lines={2} />
    </div>
  )
}
