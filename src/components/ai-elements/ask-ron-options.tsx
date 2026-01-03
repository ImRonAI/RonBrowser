/**
 * AskRonOptions Component
 *
 * Displays AI-suggested options when user invokes "Ask Ron" with selected text.
 * Follows the design system patterns from suggestion.tsx and prompt-input.tsx.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { RonExtractionInline } from './ron-extraction'
import { Loader } from './loader'

const EASE = [0.16, 1, 0.3, 1] as const

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AskRonOption {
  id: string
  label: string
  description?: string
}

interface AskRonOptionsProps {
  /** The selected text that was sent to Ron */
  selectedText: string
  /** The URL where the text was selected from */
  sourceUrl: string
  /** Whether Ron is currently thinking/loading options */
  isLoading?: boolean
  /** Current thinking text to display */
  thinkingText?: string
  /** The 3 AI-suggested options */
  options: AskRonOption[]
  /** Callback when an option is selected */
  onSelectOption: (option: AskRonOption) => void
  /** Callback when "Something Else" is selected */
  onSelectSomethingElse: () => void
  /** Callback to close/cancel */
  onClose: () => void
  /** Additional class names */
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// OptionButton - Individual option following Suggestion pattern
// ─────────────────────────────────────────────────────────────────────────────

interface OptionButtonProps {
  option: AskRonOption
  letter: string
  index: number
  onClick: () => void
}

function OptionButton({ option, letter, index, onClick }: OptionButtonProps) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06, ease: EASE }}
      whileHover={{ scale: 1.01, x: 2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'w-full p-3 rounded-xl text-left',
        'bg-surface-50 dark:bg-surface-850',
        'border border-surface-200 dark:border-surface-700',
        'hover:border-surface-300 dark:hover:border-surface-600',
        'hover:bg-surface-100 dark:hover:bg-surface-800',
        'transition-all duration-300 ease-out',
        'group'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Letter badge */}
        <span className={cn(
          'flex-shrink-0 w-6 h-6 rounded-md',
          'flex items-center justify-center',
          'bg-surface-100 dark:bg-surface-700',
          'text-body-xs font-medium',
          'text-ink-muted dark:text-ink-inverse-muted',
          'group-hover:bg-accent/10 dark:group-hover:bg-accent-light/10',
          'group-hover:text-accent dark:group-hover:text-accent-light',
          'transition-colors duration-200'
        )}>
          {letter}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-body-sm',
            'text-ink-secondary dark:text-ink-inverse-secondary',
            'group-hover:text-ink dark:group-hover:text-ink-inverse',
            'transition-colors duration-200'
          )}>
            {option.label}
          </p>
          {option.description && (
            <p className="mt-0.5 text-body-xs text-ink-muted dark:text-ink-inverse-muted line-clamp-1">
              {option.description}
            </p>
          )}
        </div>

        {/* Arrow */}
        <motion.span
          className={cn(
            'flex-shrink-0 w-4 h-4',
            'text-ink-muted/0 dark:text-ink-inverse-muted/0',
            'group-hover:text-ink-muted dark:group-hover:text-ink-inverse-muted',
            'transition-colors duration-200'
          )}
        >
          <ArrowIcon />
        </motion.span>
      </div>
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SomethingElseButton - Custom input option
// ─────────────────────────────────────────────────────────────────────────────

interface SomethingElseButtonProps {
  onClick: () => void
}

function SomethingElseButton({ onClick }: SomethingElseButtonProps) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: 0.24, ease: EASE }}
      whileHover={{ scale: 1.01, x: 2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'w-full p-3 rounded-xl text-left',
        'bg-surface-50 dark:bg-surface-850',
        'border border-dashed border-surface-300 dark:border-surface-600',
        'hover:border-solid hover:border-accent/50 dark:hover:border-accent-light/50',
        'hover:bg-accent/5 dark:hover:bg-accent-light/5',
        'transition-all duration-300 ease-out',
        'group'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Letter badge */}
        <span className={cn(
          'flex-shrink-0 w-6 h-6 rounded-md',
          'flex items-center justify-center',
          'bg-surface-100 dark:bg-surface-700',
          'text-body-xs font-medium',
          'text-ink-muted dark:text-ink-inverse-muted',
          'group-hover:bg-accent/10 dark:group-hover:bg-accent-light/10',
          'group-hover:text-accent dark:group-hover:text-accent-light',
          'transition-colors duration-200'
        )}>
          D
        </span>

        {/* Content */}
        <div className="flex-1">
          <p className={cn(
            'text-body-sm',
            'text-ink-secondary dark:text-ink-inverse-secondary',
            'group-hover:text-ink dark:group-hover:text-ink-inverse',
            'transition-colors duration-200'
          )}>
            Something else...
          </p>
          <p className="text-body-xs text-ink-muted dark:text-ink-inverse-muted">
            Type or speak what you want
          </p>
        </div>

        {/* Chat icon */}
        <span className={cn(
          'flex-shrink-0 w-4 h-4',
          'text-ink-muted/50 dark:text-ink-inverse-muted/50',
          'group-hover:text-accent dark:group-hover:text-accent-light',
          'transition-colors duration-200'
        )}>
          <ChatIcon />
        </span>
      </div>
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AskRonOptions - Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function AskRonOptions({
  selectedText,
  sourceUrl,
  isLoading = false,
  thinkingText = 'Analyzing...',
  options,
  onSelectOption,
  onSelectSomethingElse,
  onClose,
  className,
}: AskRonOptionsProps) {
  const letters = ['A', 'B', 'C']

  // Parse hostname safely
  let hostname = 'this page'
  try {
    hostname = new URL(sourceUrl).hostname
  } catch {
    // Keep default
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ duration: 0.2, ease: EASE }}
      className={cn('w-full max-w-sm', className)}
    >
      <div className={cn(
        'rounded-2xl overflow-hidden',
        'bg-surface-0 dark:bg-surface-900',
        'border border-surface-200 dark:border-surface-700',
        'shadow-lg'
      )}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <RonExtractionInline
                isThinking={isLoading}
                thinkingText={thinkingText}
              />
              {!isLoading && (
                <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
                  Ask Ron
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              aria-label="Close"
              className={cn(
                'p-1 rounded-md',
                'text-ink-muted dark:text-ink-inverse-muted',
                'hover:bg-surface-100 dark:hover:bg-surface-800',
                'hover:text-ink dark:hover:text-ink-inverse',
                'transition-colors duration-200'
              )}
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Selected text preview */}
          <div className={cn(
            'mt-3 p-2.5 rounded-lg',
            'bg-surface-50 dark:bg-surface-850'
          )}>
            <p className="text-label text-ink-muted dark:text-ink-inverse-muted mb-1">
              From {hostname}
            </p>
            <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary line-clamp-2 italic">
              "{selectedText}"
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-surface-200 dark:bg-surface-700" />

        {/* Options */}
        <div className="p-3 space-y-2">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6 flex flex-col items-center justify-center gap-2"
              >
                <Loader size={20} />
                <p className="text-body-xs text-ink-muted dark:text-ink-inverse-muted">
                  {thinkingText}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="options"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {options.slice(0, 3).map((option, index) => (
                  <OptionButton
                    key={option.id}
                    option={option}
                    letter={letters[index]}
                    index={index}
                    onClick={() => onSelectOption(option)}
                  />
                ))}
                <SomethingElseButton onClick={onSelectSomethingElse} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-4 pb-3">
          <p className="text-center text-label text-ink-muted/60 dark:text-ink-inverse-muted/60">
            <kbd className="px-1 py-0.5 rounded text-label bg-surface-100 dark:bg-surface-800 font-mono">Esc</kbd>
            {' '}to cancel
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('w-full h-full', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('w-full h-full', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('w-full h-full', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default AskRonOptions
