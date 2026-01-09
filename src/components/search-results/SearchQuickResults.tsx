/**
 * SearchQuickResults
 * 
 * Main quick results view for search with:
 * - Collapsible Chain of Thought (auto-collapses when answer starts)
 * - Streamed answer display with Raleway typography
 * - Source cards in responsive grid
 * - "See Full Results" and "Try Again" action buttons
 */

import { useState, useEffect, useRef } from 'react'
import { 
  ChevronDownIcon, 
  ChevronRightIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import { SourcesGrid } from './SourcesGrid'
import type { SourceData } from './SourceCard'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface ReasoningStep {
  id: string
  label: string
  description: string
  status: 'pending' | 'running' | 'complete'
  reasoning?: string
  sources?: string[]
}

export interface QuickSearchResult {
  query: string
  answer: string
  isAnswerComplete: boolean
  reasoning: ReasoningStep[]
  sources: SourceData[]
  relatedQueries: string[]
}

interface SearchQuickResultsProps {
  result: QuickSearchResult
  isStreaming: boolean
  onSeeFullResults: () => void
  onTryAgain: (feedback?: string) => void
  onLetsChat?: () => void
  onSendToRon?: (source: SourceData) => void
  onSendToCoding?: (source: SourceData) => void
  onAttachToTask?: (source: SourceData) => void
  onStartTask?: (source: SourceData) => void
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Reasoning Step Component
// ─────────────────────────────────────────────────────────────────────────────
function ReasoningStepItem({ step }: { step: ReasoningStep }) {
  const getStatusIcon = () => {
    switch (step.status) {
      case 'complete':
        return <CheckCircleIcon className="w-4 h-4 text-teal-400" />
      case 'running':
        return (
          <div className="w-4 h-4 flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )
      default:
        return <ClockIcon className="w-4 h-4 text-slate-500" />
    }
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5">{getStatusIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">{step.label}</span>
          {step.sources && step.sources.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400">
              {step.sources.length} sources
            </span>
          )}
        </div>
        <p className="text-xs text-white/50 mt-0.5">{step.description}</p>
        {step.reasoning && (
          <p className="text-xs text-white/40 mt-1 italic">{step.reasoning}</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export function SearchQuickResults({
  result,
  isStreaming,
  onSeeFullResults,
  onTryAgain,
  onLetsChat,
  onSendToRon,
  onSendToCoding,
  onAttachToTask,
  onStartTask,
  className = '',
}: SearchQuickResultsProps) {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(true)
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)
  const [feedback, setFeedback] = useState('')
  const answerRef = useRef<HTMLDivElement>(null)

  // Auto-collapse reasoning when answer starts streaming
  useEffect(() => {
    if (result.answer.length > 0 && isReasoningExpanded) {
      // Delay collapse for smooth UX
      const timer = setTimeout(() => {
        setIsReasoningExpanded(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [result.answer])

  // Auto-scroll answer as it streams
  useEffect(() => {
    if (answerRef.current && isStreaming) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight
    }
  }, [result.answer, isStreaming])

  const handleTryAgain = () => {
    if (showFeedbackInput && feedback.trim()) {
      onTryAgain(feedback.trim())
      setFeedback('')
      setShowFeedbackInput(false)
    } else {
      setShowFeedbackInput(true)
    }
  }

  const handleTryAgainWithoutFeedback = () => {
    onTryAgain()
    setShowFeedbackInput(false)
    setFeedback('')
  }

  return (
    <div className={`max-w-4xl mx-auto p-6 space-y-6 ${className}`}>
      {/* Query Display */}
      <div className="text-center mb-8">
        <p className="text-sm text-white/40 mb-1">Results for</p>
        <h1 className="text-xl font-medium text-white/90">{result.query}</h1>
      </div>

      {/* Chain of Thought Section */}
      {result.reasoning.length > 0 && (
        <div 
          className="
            bg-white/5 dark:bg-slate-800/30
            border border-white/10 dark:border-slate-700/50
            rounded-xl overflow-hidden
            transition-all duration-300
          "
        >
          {/* Toggle Header */}
          <button
            onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
            className="
              w-full flex items-center justify-between
              px-4 py-3
              hover:bg-white/5 transition-colors
            "
          >
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white/80">Chain of Thought</span>
              <span className="text-xs px-2 py-0.5 bg-purple-500/20 rounded-full text-purple-300">
                {result.reasoning.filter(s => s.status === 'complete').length}/{result.reasoning.length}
              </span>
            </div>
            {isReasoningExpanded ? (
              <ChevronDownIcon className="w-4 h-4 text-white/50" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-white/50" />
            )}
          </button>

          {/* Collapsible Content */}
          <div
            className={`
              overflow-hidden transition-all duration-300 ease-out
              ${isReasoningExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
            `}
          >
            <div className="px-4 pb-4 space-y-1 border-t border-white/5">
              {result.reasoning.map((step) => (
                <ReasoningStepItem key={step.id} step={step} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Answer Section */}
      <div 
        ref={answerRef}
        className="
          bg-white/5 dark:bg-slate-800/30
          border border-white/10 dark:border-slate-700/50
          rounded-xl p-6
          max-h-[50vh] overflow-y-auto
        "
      >
        {result.answer ? (
          <div className="prose prose-invert max-w-none">
            <p 
              className="
                text-base leading-relaxed text-white/80
                font-['Raleway',_sans-serif] font-light
                whitespace-pre-wrap
              "
            >
              {result.answer}
              {/* Typing cursor */}
              {isStreaming && (
                <span className="inline-block w-0.5 h-5 bg-purple-400 ml-0.5 animate-pulse" />
              )}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-white/40">
              <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span>Generating answer...</span>
            </div>
          </div>
        )}
      </div>

      {/* Sources Section */}
      {result.sources.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/60">
              Sources ({result.sources.length})
            </h2>
          </div>
          <SourcesGrid
            sources={result.sources}
            onSendToRon={onSendToRon}
            onSendToCoding={onSendToCoding}
            onAttachToTask={onAttachToTask}
            onStartTask={onStartTask}
          />
        </div>
      )}

      {/* Related Queries */}
      {result.relatedQueries.length > 0 && result.isAnswerComplete && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-white/60">Related Searches</h2>
          <div className="flex flex-wrap gap-2">
            {result.relatedQueries.map((query, i) => (
              <button
                key={i}
                className="
                  px-3 py-1.5 text-sm
                  bg-white/5 hover:bg-white/10
                  border border-white/10 hover:border-white/20
                  rounded-full text-white/70 hover:text-white/90
                  transition-all duration-200
                "
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {result.isAnswerComplete && (
        <div className="flex items-center justify-center gap-4 pt-4">
          {/* Let's Chat Button - Primary CTA */}
          {onLetsChat && (
            <button
              onClick={onLetsChat}
              className="
                flex items-center gap-2
                px-6 py-2.5
                bg-gradient-to-r from-teal-500 to-teal-600
                hover:from-teal-400 hover:to-teal-500
                text-white font-medium
                rounded-xl
                shadow-lg shadow-teal-500/20
                transition-all duration-200
                hover:-translate-y-0.5
              "
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
              <span>Let's Chat</span>
            </button>
          )}

          {/* See Full Results Button */}
          <button
            onClick={onSeeFullResults}
            className="
              flex items-center gap-2
              px-6 py-2.5
              bg-gradient-to-r from-purple-600 to-purple-700
              hover:from-purple-500 hover:to-purple-600
              text-white font-medium
              rounded-xl
              shadow-lg shadow-purple-500/20
              transition-all duration-200
              hover:-translate-y-0.5
            "
          >
            <span>See Full Results</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>

          {/* Try Again Button */}
          <div className="relative">
            {showFeedbackInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What would you like different?"
                  className="
                    px-4 py-2
                    bg-white/5 border border-white/20
                    rounded-xl text-sm text-white
                    placeholder:text-white/40
                    focus:outline-none focus:border-purple-500/50
                    w-64
                  "
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTryAgain()
                    if (e.key === 'Escape') setShowFeedbackInput(false)
                  }}
                  autoFocus
                />
                <button
                  onClick={handleTryAgain}
                  className="
                    px-4 py-2
                    bg-white/10 hover:bg-white/20
                    border border-white/20
                    rounded-xl text-sm text-white/80
                    transition-colors
                  "
                >
                  Search
                </button>
                <button
                  onClick={handleTryAgainWithoutFeedback}
                  className="
                    p-2
                    text-white/50 hover:text-white/80
                    transition-colors
                  "
                  title="Search again without feedback"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleTryAgain}
                className="
                  flex items-center gap-2
                  px-4 py-2.5
                  bg-white/5 hover:bg-white/10
                  border border-white/10 hover:border-white/20
                  text-white/70 hover:text-white/90
                  rounded-xl
                  transition-all duration-200
                "
              >
                <ArrowPathIcon className="w-4 h-4" />
                <span>Try Again</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchQuickResults
