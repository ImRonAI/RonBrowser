/**
 * SearchLayout Component
 * 
 * Main container component that orchestrates SonarBrain and search results display.
 * Features 2-column responsive layout with filter/sort controls.
 * 
 * @example
 * ```tsx
 * <SearchLayout 
 *   searchResponse={searchData} 
 *   searchQuery="user query"
 * />
 * ```
 */

import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SonarBrain } from '@/components/search-results/SonarBrain'
import { UniversalResultCard } from '@/components/search-results/UniversalResultCard'
import type {
  SearchResponse,
  SearchFilters,
  UniversalResult,
  ResultType,
} from '@/types/search'

/**
 * Props for SearchLayout component
 */
export interface SearchLayoutProps {
  /** Full search response containing results and SonarReasoning */
  searchResponse: SearchResponse | null
  /** Original search query string */
  searchQuery: string
  /** Loading state indicator */
  isLoading?: boolean
  /** Error message to display */
  error?: string | null
  /** Initial filter state */
  initialFilters?: SearchFilters
  /** Callback when filters change */
  onFilterChange?: (filters: SearchFilters) => void
  /** Callback when a result is clicked */
  onResultClick?: (result: UniversalResult) => void
}

/**
 * Main SearchLayout component
 * 
 * Displays SonarBrain in left column and search results in right column
 * with filter/sort controls and empty state handling.
 */
export function SearchLayout({
  searchResponse,
  searchQuery,
  isLoading = false,
  error = null,
  initialFilters,
  onFilterChange,
  onResultClick,
}: SearchLayoutProps) {
  // Filter and sort state
  const [filters, setFilters] = useState<SearchFilters>(
    initialFilters || { sortBy: 'relevance' }
  )

  // Update filters and notify parent
  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters)
    onFilterChange?.(newFilters)
  }

  // Filter and sort results
  const filteredResults = useMemo(() => {
    if (!searchResponse?.results || searchResponse.results.length === 0) {
      return []
    }

    let results = [...searchResponse.results]

    // Filter by type
    if (filters.type) {
      if (Array.isArray(filters.type)) {
        results = results.filter((result) => filters.type!.includes(result.type))
      } else {
        results = results.filter((result) => result.type === filters.type)
      }
    }

    // Filter by minimum relevance score
    if (filters.minRelevanceScore !== undefined) {
      results = results.filter(
        (result) => (result.relevanceScore ?? 0) >= filters.minRelevanceScore!
      )
    }

    // Sort results
    results.sort((a, b) => {
      switch (filters.sortBy) {
        case 'date':
          // Sort by publishDate (newest first)
          const dateA = getPublicationDate(a)
          const dateB = getPublicationDate(b)
          if (!dateA) return 1
          if (!dateB) return -1
          return dateB.getTime() - dateA.getTime()

        case 'popularity':
          // Sort by metrics (viewCount, likes, stars, etc.)
          const popularityA = getPopularityScore(a)
          const popularityB = getPopularityScore(b)
          return popularityB - popularityA

        case 'relevance':
        default:
          // Sort by relevanceScore (highest first)
          const relevanceA = a.relevanceScore ?? 0
          const relevanceB = b.relevanceScore ?? 0
          return relevanceB - relevanceA
      }
    })

    return results
  }, [searchResponse?.results, filters])

  // Handle filter by type change
  const handleTypeFilterChange = (typeValue: string) => {
    if (typeValue === 'all') {
      handleFilterChange({ ...filters, type: undefined })
    } else {
      handleFilterChange({ ...filters, type: typeValue as ResultType })
    }
  }

  // Handle sort change
  const handleSortChange = (sortValue: string) => {
    handleFilterChange({ ...filters, sortBy: sortValue as 'relevance' | 'date' | 'popularity' })
  }

  // Loading state
  if (isLoading || !searchResponse) {
    return (
      <div className="w-full p-8">
        <Card className="w-full">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4 text-muted-foreground">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-lg font-medium">Loading search results...</p>
              <p className="text-sm">Searching for: "{searchQuery}"</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="w-full p-8">
        <Card className="border-destructive">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4 text-destructive">
              <p className="text-lg font-medium">Error loading search results</p>
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No results state
  const hasNoResults = !searchResponse.results || searchResponse.results.length === 0
  const hasNoFilteredResults = filteredResults.length === 0

  if (hasNoResults) {
    return (
      <div className="w-full p-8">
        <Card className="w-full">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4 text-muted-foreground">
              <p className="text-lg font-medium">No results found</p>
              <p className="text-sm">Try adjusting your search query or filters</p>
              <Badge variant="outline" className="mt-2">
                Query: "{searchQuery}"
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Header with query and controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Search Results</h1>
          <p className="text-sm text-muted-foreground">
            {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
        </div>

        {/* Filter and sort controls */}
        <div className="flex flex-wrap gap-3">
          {/* Type filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Type:</span>
            <select
              value={filters.type || 'all'}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
              title="Filter by result type"
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Types</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="podcast">Podcast</option>
              <option value="web">Web</option>
              <option value="article">Article</option>
              <option value="social">Social</option>
              <option value="travel">Travel</option>
              <option value="academic">Academic</option>
              <option value="image">Image</option>
              <option value="code">Code</option>
            </select>
          </div>

          {/* Sort control */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Sort by:</span>
            <select
              value={filters.sortBy || 'relevance'}
              onChange={(e) => handleSortChange(e.target.value)}
              title="Sort results by"
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Date</option>
              <option value="popularity">Popularity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
        {/* Left column: SonarBrain */}
        <div className="space-y-4">
          {searchResponse.sonarReasoning ? (
            <SonarBrain
              sonarReasoning={searchResponse.sonarReasoning}
              searchQuery={searchQuery}
            />
          ) : (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-base">Sonar Reasoning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No reasoning analysis available for this search.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Results grid/list */}
        <div className="space-y-4">
          {hasNoFilteredResults ? (
            <Card className="w-full">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center space-y-4 text-muted-foreground">
                  <p className="text-lg font-medium">No results match your filters</p>
                  <Button
                    variant="outline"
                    onClick={() => handleFilterChange({ sortBy: 'relevance' })}
                  >
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-4 pr-4">
                {filteredResults.map((result) => (
                  <UniversalResultCard
                    key={result.id}
                    result={result}
                    searchQuery={searchQuery}
                    onClick={() => onResultClick?.(result)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Helper function to get publication date from a result
 */
function getPublicationDate(result: UniversalResult): Date | null {
  if ('publishDate' in result && result.publishDate) {
    return new Date(result.publishDate)
  }
  if ('date' in result && result.date) {
    return new Date(result.date)
  }
  if ('publishedAt' in result && result.publishedAt) {
    return new Date(result.publishedAt)
  }
  return null
}

/**
 * Helper function to get popularity score for sorting
 * Prioritizes metrics like viewCount, likes, stars, etc.
 */
function getPopularityScore(result: UniversalResult): number {
  let score = 0

  if ('viewCount' in result && result.viewCount) {
    score += result.viewCount
  }
  if ('likes' in result && result.likes) {
    score += result.likes
  }
  if ('shares' in result && result.shares) {
    score += result.shares
  }
  if ('comments' in result && result.comments) {
    score += result.comments
  }
  if ('stars' in result && result.stars) {
    score += result.stars * 10 // Weight stars more heavily
  }
  if ('forks' in result && result.forks) {
    score += result.forks * 5
  }
  if ('downloads' in result && result.downloads) {
    score += result.downloads
  }
  if ('citationCount' in result && result.citationCount) {
    score += result.citationCount * 100 // Weight citations heavily
  }
  if ('rating' in result && result.rating) {
    score += result.rating * 100
  }
  if ('reviews' in result && result.reviews) {
    score += result.reviews * 10
  }

  return score
}
