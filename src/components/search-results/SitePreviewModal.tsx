/**
 * SitePreviewModal
 * 
 * Modal for previewing websites in an iframe.
 * Includes fallback UI for sites that block iframe embedding.
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  XMarkIcon, 
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface SitePreviewModalProps {
  isOpen: boolean
  url: string
  title?: string
  onClose: () => void
}

export function SitePreviewModal({
  isOpen,
  url,
  title,
  onClose,
}: SitePreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Reset state when URL changes
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      setHasError(false)
    }
  }, [url, isOpen])

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false)
  }, [])

  const handleIframeError = useCallback(() => {
    setIsLoading(false)
    setHasError(true)
  }, [])

  const handleOpenInNewTab = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        className="
          relative w-[90vw] h-[85vh] max-w-6xl
          bg-slate-900/95 backdrop-blur-xl
          border border-white/10
          rounded-2xl overflow-hidden
          shadow-2xl shadow-black/50
          flex flex-col
        "
      >
        {/* Header */}
        <div className="
          flex items-center justify-between
          px-4 py-3
          bg-slate-800/50
          border-b border-white/10
        ">
          {/* Title & URL */}
          <div className="flex-1 min-w-0 mr-4">
            {title && (
              <h2 
                id="preview-title"
                className="text-sm font-medium text-white/90 truncate"
              >
                {title}
              </h2>
            )}
            <p className="text-xs text-white/50 truncate">{url}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenInNewTab}
              className="
                flex items-center gap-1.5
                px-3 py-1.5
                text-xs font-medium text-white/70 hover:text-white
                bg-white/5 hover:bg-white/10
                border border-white/10 hover:border-white/20
                rounded-lg
                transition-colors
              "
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              <span>Open in Tab</span>
            </button>
            <button
              onClick={onClose}
              className="
                p-1.5
                text-white/50 hover:text-white
                hover:bg-white/10
                rounded-lg
                transition-colors
              "
              aria-label="Close preview"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative">
          {/* Loading State */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-white/50">Loading preview...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
                <div className="p-4 bg-amber-500/10 rounded-full">
                  <ExclamationTriangleIcon className="w-10 h-10 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white/90 mb-2">
                    Preview Unavailable
                  </h3>
                  <p className="text-sm text-white/60 mb-4">
                    This website doesn't allow embedding in previews. 
                    You can open it in a new tab instead.
                  </p>
                </div>
                <button
                  onClick={handleOpenInNewTab}
                  className="
                    flex items-center gap-2
                    px-5 py-2.5
                    bg-gradient-to-r from-purple-600 to-purple-700
                    hover:from-purple-500 hover:to-purple-600
                    text-white font-medium
                    rounded-xl
                    shadow-lg shadow-purple-500/20
                    transition-all duration-200
                  "
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  <span>Open in New Tab</span>
                </button>
              </div>
            </div>
          )}

          {/* Iframe */}
          <iframe
            src={url}
            title={title || 'Website Preview'}
            className={`
              w-full h-full border-0
              ${isLoading || hasError ? 'invisible' : 'visible'}
            `}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  )
}

export default SitePreviewModal
