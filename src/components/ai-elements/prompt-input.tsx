/**
 * PromptInput Components
 * 
 * Comprehensive chat input with attachments, model selection, and keyboard shortcuts.
 * Includes large paste detection (2000+ chars) that auto-converts to text attachments.
 */

import React, { useState, useRef, forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Loader } from './loader'
import { TextAttachmentCard } from './text-attachment-card'
import { fileToDataUrl, makePastedTextFilename } from '@/utils/file-utils'
import type { ChatStatus, AIModel, PromptInputMessage, TextAttachment } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LARGE_PASTE_THRESHOLD_CHARS = 2000

// ─────────────────────────────────────────────────────────────────────────────
// PromptInput
// ─────────────────────────────────────────────────────────────────────────────

interface PromptInputProps {
  onSubmit?: (message: PromptInputMessage) => void
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(
  function PromptInput({ 
    onSubmit, 
    value: controlledValue, 
    onChange, 
    placeholder = 'Ask anything...', 
    disabled,
    className, 
    children 
  }, ref) {
    const [internalValue, setInternalValue] = useState('')
    const [files, setFiles] = useState<File[]>([])
    const [textAttachments, setTextAttachments] = useState<TextAttachment[]>([])
    
    const value = controlledValue !== undefined ? controlledValue : internalValue
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const combinedRef = (ref || textareaRef) as React.RefObject<HTMLTextAreaElement>

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      if (onChange) {
        onChange(newValue)
      } else {
        setInternalValue(newValue)
      }
    }

    const handleSubmit = () => {
      if (!value.trim() && files.length === 0 && textAttachments.length === 0) return
      
      onSubmit?.({ 
        text: value, 
        files,
        textAttachments: textAttachments.length > 0 ? textAttachments : undefined
      })
      
      if (!onChange) {
        setInternalValue('')
      }
      setFiles([])
      setTextAttachments([])
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    }

    const handleFileAdd = (newFiles: File[]) => {
      setFiles(prev => [...prev, ...newFiles])
    }

    const handleFileRemove = (index: number) => {
      setFiles(prev => prev.filter((_, i) => i !== index))
    }

    // Handle text attachment operations
    const handleTextAttachmentRemove = (id: string) => {
      setTextAttachments(prev => prev.filter(att => att.id !== id))
    }

    const handleTextAttachmentUpdate = (
      id: string, 
      next: Pick<TextAttachment, 'file' | 'dataUrl' | 'preview'>
    ) => {
      setTextAttachments(prev => prev.map(att => 
        att.id === id ? { ...att, ...next } : att
      ))
    }

    // Handle paste events - detect large pastes and convert to attachments
    const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      // 1) If the clipboard contains files (e.g., pasted image), attach them
      const items = Array.from(e.clipboardData.items || [])
      const fileItems = items
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((f): f is File => Boolean(f))

      if (fileItems.length > 0) {
        e.preventDefault()
        handleFileAdd(fileItems)
        return
      }

      // 2) If the clipboard contains a large text paste, convert to a txt attachment
      const text = e.clipboardData.getData('text/plain')
      if (text && text.length >= LARGE_PASTE_THRESHOLD_CHARS) {
        e.preventDefault()
        const file = new File([text], makePastedTextFilename(), {
          type: 'text/plain',
        })
        const dataUrl = await fileToDataUrl(file)
        const newAttachment: TextAttachment = {
          id: Math.random().toString(36).substr(2, 9),
          file,
          dataUrl,
          preview: dataUrl,
        }
        setTextAttachments(prev => [...prev, newAttachment])
      }
    }

    const hasAttachments = files.length > 0 || textAttachments.length > 0

    return (
      <div className={cn(
        'bg-surface-50 dark:bg-surface-800',
        'border border-surface-200 dark:border-surface-700',
        'rounded-2xl',
        'focus-within:border-accent dark:focus-within:border-accent-light',
        'focus-within:ring-2 focus-within:ring-accent/20 dark:focus-within:ring-accent-light/20',
        'transition-all duration-200',
        className
      )}>
        {/* Attachments preview */}
        {hasAttachments && (
          <PromptInputAttachments>
            {/* Regular file attachments */}
            {files.map((file, index) => (
              <PromptInputAttachment 
                key={`file-${index}`} 
                file={file} 
                onRemove={() => handleFileRemove(index)} 
              />
            ))}
            {/* Text attachments with special handling */}
            {textAttachments.map((attachment) => (
              <TextAttachmentCard
                key={attachment.id}
                attachment={attachment}
                onRemove={handleTextAttachmentRemove}
                onUpdate={handleTextAttachmentUpdate}
              />
            ))}
          </PromptInputAttachments>
        )}

        {/* Main textarea area */}
        <PromptInputBody>
          <textarea
            ref={combinedRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full px-4 py-3 bg-transparent',
              'text-body-md text-ink dark:text-ink-inverse',
              'placeholder:text-ink-muted dark:placeholder:text-ink-inverse-muted',
              'resize-none focus:outline-none',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'min-h-[48px] max-h-[200px]'
            )}
          />
        </PromptInputBody>

        {/* Render children (tools, footer, etc.) with context */}
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            // Pass context to specific child types
            if (child.type === PromptInputFooter || child.type === PromptInputTools) {
              return React.cloneElement(child as React.ReactElement<any>, {
                onSubmit: handleSubmit,
                onFileAdd: handleFileAdd,
                disabled,
                hasValue: !!value.trim() || hasAttachments
              })
            }
          }
          return child
        })}
      </div>
    )
  }
)


// ─────────────────────────────────────────────────────────────────────────────
// PromptInputBody
// ─────────────────────────────────────────────────────────────────────────────

interface PromptInputBodyProps {
  children: React.ReactNode
  className?: string
}

export function PromptInputBody({ children, className }: PromptInputBodyProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PromptInputTextarea
// ─────────────────────────────────────────────────────────────────────────────

interface PromptInputTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
}

export const PromptInputTextarea = forwardRef<HTMLTextAreaElement, PromptInputTextareaProps>(
  function PromptInputTextarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={1}
        className={cn(
          'w-full px-4 py-3 bg-transparent',
          'text-body-md text-ink dark:text-ink-inverse',
          'placeholder:text-ink-muted dark:placeholder:text-ink-inverse-muted',
          'resize-none focus:outline-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'min-h-[48px] max-h-[200px]',
          className
        )}
        {...props}
      />
    )
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// PromptInputFooter
// ─────────────────────────────────────────────────────────────────────────────

interface PromptInputFooterProps {
  children?: React.ReactNode
  onSubmit?: () => void
  disabled?: boolean
  hasValue?: boolean
  className?: string
}

export function PromptInputFooter({ children, onSubmit, disabled, hasValue, className }: PromptInputFooterProps) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-2',
      'px-3 py-2',
      'border-t border-surface-200 dark:border-surface-700',
      className
    )}>
      <div className="flex items-center gap-1">
        {children}
      </div>
      
      {/* Default submit button if no custom one provided */}
      {!React.Children.toArray(children).some(
        child => React.isValidElement(child) && child.type === PromptInputSubmit
      ) && (
        <PromptInputSubmit 
          onClick={onSubmit}
          disabled={disabled || !hasValue}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PromptInputTools
// ─────────────────────────────────────────────────────────────────────────────

interface PromptInputToolsProps {
  children: React.ReactNode
  onFileAdd?: (files: File[]) => void
  className?: string
}

export function PromptInputTools({ children, className }: PromptInputToolsProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PromptInputButton
// ─────────────────────────────────────────────────────────────────────────────

interface PromptInputButtonProps {
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
  label?: string
  className?: string
  children?: React.ReactNode
}

export function PromptInputButton({ 
  onClick, 
  disabled, 
  variant = 'ghost',
  size = 'sm',
  icon,
  label,
  className,
  children 
}: PromptInputButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={cn(
        'flex items-center gap-1.5 rounded-lg',
        'transition-colors duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // Size
        size === 'sm' && 'px-2 py-1.5 text-body-xs',
        size === 'md' && 'px-3 py-2 text-body-sm',
        // Variants
        variant === 'ghost' && 'hover:bg-surface-100 dark:hover:bg-surface-700 text-ink-muted dark:text-ink-inverse-muted',
        variant === 'outline' && 'border border-surface-300 dark:border-surface-600 hover:border-accent dark:hover:border-accent-light text-ink dark:text-ink-inverse',
        variant === 'default' && 'bg-accent dark:bg-accent-light text-white hover:opacity-90',
        className
      )}
      title={label}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PromptInputSubmit
// ─────────────────────────────────────────────────────────────────────────────

interface PromptInputSubmitProps {
  onClick?: () => void
  disabled?: boolean
  status?: ChatStatus
  className?: string
}

export function PromptInputSubmit({ onClick, disabled, status = 'ready', className }: PromptInputSubmitProps) {
  const isLoading = status === 'submitted' || status === 'streaming'

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || isLoading}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={cn(
        'w-9 h-9 rounded-xl',
        'bg-accent dark:bg-accent-light text-white',
        'flex items-center justify-center',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'hover:shadow-glow-accent',
        'transition-all duration-200',
        className
      )}
    >
      {isLoading ? (
        <Loader size={16} />
      ) : status === 'error' ? (
        <RefreshIcon className="w-4 h-4" />
      ) : (
        <SendIcon className="w-4 h-4" />
      )}
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PromptInputAttachments
// ─────────────────────────────────────────────────────────────────────────────

interface PromptInputAttachmentsProps {
  children: React.ReactNode
  className?: string
}

export function PromptInputAttachments({ children, className }: PromptInputAttachmentsProps) {
  return (
    <div className={cn(
      'flex flex-wrap gap-2 p-3',
      'border-b border-surface-200 dark:border-surface-700',
      className
    )}>
      <AnimatePresence>
        {children}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PromptInputAttachment
// ─────────────────────────────────────────────────────────────────────────────

interface PromptInputAttachmentProps {
  file: File
  onRemove?: () => void
  className?: string
}

export function PromptInputAttachment({ file, onRemove, className }: PromptInputAttachmentProps) {
  const isImage = file.type.startsWith('image/')
  const [preview, setPreview] = useState<string | null>(null)

  React.useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file, isImage])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        'relative group',
        'flex items-center gap-2 p-2 pr-8 rounded-lg',
        'bg-surface-100 dark:bg-surface-700',
        className
      )}
    >
      {isImage && preview ? (
        <img src={preview} alt={file.name} className="w-10 h-10 rounded object-cover" />
      ) : (
        <FileIcon className="w-6 h-6 text-ink-muted dark:text-ink-inverse-muted" />
      )}
      
      <div className="min-w-0">
        <p className="text-body-xs font-medium text-ink dark:text-ink-inverse truncate max-w-[120px]">
          {file.name}
        </p>
        <p className="text-label text-ink-muted dark:text-ink-inverse-muted">
          {formatFileSize(file.size)}
        </p>
      </div>

      {onRemove && (
        <button
          onClick={onRemove}
          className={cn(
            'absolute top-1 right-1',
            'w-5 h-5 rounded-full',
            'bg-surface-200 dark:bg-surface-600',
            'hover:bg-red-100 dark:hover:bg-red-900/30',
            'flex items-center justify-center',
            'opacity-0 group-hover:opacity-100',
            'transition-opacity duration-200'
          )}
        >
          <XIcon className="w-3 h-3 text-ink-muted dark:text-ink-inverse-muted" />
        </button>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PromptInputModelSelect
// ─────────────────────────────────────────────────────────────────────────────

interface PromptInputModelSelectProps {
  models: AIModel[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function PromptInputModelSelect({ models, value, onValueChange, className }: PromptInputModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedModel = models.find(m => m.id === value)

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2',
          'px-3 py-1.5 rounded-lg',
          'bg-surface-100 dark:bg-surface-700',
          'hover:bg-surface-200 dark:hover:bg-surface-600',
          'text-body-xs text-ink dark:text-ink-inverse',
          'transition-colors duration-200'
        )}
      >
        <span>{selectedModel?.name || 'Select model'}</span>
        <ChevronIcon className={cn(
          'w-3 h-3 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'absolute bottom-full left-0 mb-1',
              'min-w-[160px] p-1 rounded-lg',
              'bg-surface-0 dark:bg-surface-800',
              'border border-surface-200 dark:border-surface-700',
              'shadow-lg',
              'z-10'
            )}
          >
            {models.map(model => (
              <button
                key={model.id}
                onClick={() => {
                  onValueChange(model.id)
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full px-3 py-2 rounded-md text-left',
                  'text-body-xs',
                  model.id === value
                    ? 'bg-accent/10 text-accent dark:text-accent-light'
                    : 'text-ink dark:text-ink-inverse hover:bg-surface-100 dark:hover:bg-surface-700',
                  'transition-colors duration-200'
                )}
              >
                {model.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
