/**
 * SearchLayout
 * 
 * Full search results layout component.
 * Displays comprehensive search results with filtering, sorting, and multiple result types.
 * 
 * TODO: This is a placeholder - full implementation in Phase 2
 */

import type { SearchResponse, UniversalResult, SearchFilters } from '@/types/search'

interface SearchLayoutProps {
  searchResponse: SearchResponse | null
  searchQuery: string
  isLoading?: boolean
  error?: string | null
  viewMode?: 'grid' | 'list'
  filters?: SearchFilters
  onResultClick?: (result: UniversalResult) => void
  onFilterChange?: (filters: SearchFilters) => void
  onExpandPreview?: (result: UniversalResult) => void
}

export function SearchLayout({
  searchResponse,
  searchQuery,
  isLoading,
  error,
}: SearchLayoutProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-red-400 mb-2">Error loading results</p>
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!searchResponse) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-white/40">No results to display</p>
      </div>
    )
  }

  const { results = [], sonarReasoning, totalCount } = searchResponse

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-medium text-white/90 mb-2">
          {totalCount || results.length} results for "{searchQuery}"
        </h2>
        {sonarReasoning?.summary && (
          <p className="text-white/60 text-sm">{sonarReasoning.summary}</p>
        )}
      </div>

      {/* Chain of Thought (if available) */}
      {sonarReasoning?.chainOfThought?.steps && sonarReasoning.chainOfThought.steps.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-sm font-medium text-white/70 mb-4">Analysis Steps</h3>
          <div className="space-y-3">
            {sonarReasoning.chainOfThought.steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  step.status === 'complete' ? 'bg-teal-400' :
                  step.status === 'running' ? 'bg-purple-400' : 'bg-slate-500'
                }`} />
                <div>
                  <p className="text-sm text-white/80">{step.label}</p>
                  {step.description && (
                    <p className="text-xs text-white/50">{step.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result) => (
          <div 
            key={result.id}
            className="
              bg-white/5 border border-white/10 rounded-xl p-4
              hover:bg-white/10 hover:border-white/20
              transition-all duration-200 cursor-pointer
            "
          >
            <div className="flex items-start gap-3">
              {/* Type Badge */}
              <span className={`
                px-2 py-0.5 text-xs font-medium rounded
                ${result.type === 'video' ? 'bg-red-500/20 text-red-300' :
                  result.type === 'academic' ? 'bg-amber-500/20 text-amber-300' :
                  result.type === 'code' ? 'bg-green-500/20 text-green-300' :
                  result.type === 'image' ? 'bg-blue-500/20 text-blue-300' :
                  'bg-slate-500/20 text-slate-300'}
              `}>
                {result.type}
              </span>
            </div>
            
            <h4 className="text-sm font-medium text-white/90 mt-2 line-clamp-2">
              {'title' in result ? result.title : 'Untitled'}
            </h4>
            
            {'snippet' in result && result.snippet && (
              <p className="text-xs text-white/50 mt-1 line-clamp-2">
                {result.snippet}
              </p>
            )}
            
            {'url' in result && (
              <p className="text-xs text-purple-400 mt-2 truncate">
                {result.url}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Related Queries */}
      {sonarReasoning?.relatedQueries && sonarReasoning.relatedQueries.length > 0 && (
        <div className="pt-4">
          <h3 className="text-sm font-medium text-white/60 mb-3">Related Searches</h3>
          <div className="flex flex-wrap gap-2">
            {sonarReasoning.relatedQueries.map((query, i) => (
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
    </div>
  )
}

export default SearchLayout
