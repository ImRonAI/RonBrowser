/**
 * SourcesGrid
 * 
 * Layout component for displaying source cards in rows of 5.
 * Handles responsive layout and horizontal scrolling if needed.
 */

import { SourceCard, type SourceData } from './SourceCard'

interface SourcesGridProps {
  sources: SourceData[]
  onSendToRon?: (source: SourceData) => void
  onSendToCoding?: (source: SourceData) => void
  onAttachToTask?: (source: SourceData) => void
  onStartTask?: (source: SourceData) => void
  onPreview?: (source: SourceData) => void
  className?: string
}

export function SourcesGrid({
  sources,
  onSendToRon,
  onSendToCoding,
  onAttachToTask,
  onStartTask,
  onPreview,
  className = '',
}: SourcesGridProps) {
  if (sources.length === 0) return null

  return (
    <div className={`w-full ${className}`}>
      {/* Grid: 5 columns on large screens, responsive down */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {sources.map((source, index) => (
          <SourceCard
            key={source.id}
            source={source}
            citationNumber={index + 1}
            onSendToRon={onSendToRon ? () => onSendToRon(source) : undefined}
            onSendToCoding={onSendToCoding ? () => onSendToCoding(source) : undefined}
            onAttachToTask={onAttachToTask ? () => onAttachToTask(source) : undefined}
            onStartTask={onStartTask ? () => onStartTask(source) : undefined}
            onPreview={onPreview ? () => onPreview(source) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

export default SourcesGrid
