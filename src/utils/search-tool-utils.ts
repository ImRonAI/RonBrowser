import type { SearchProvider, SearchResult } from '@/components/ai-elements/chain-of-thought-search'
import { detectSearchProvider } from '@/components/ai-elements/chain-of-thought-search'

const QUERY_FIELDS = ['query', 'q', 'search', 'term', 'keyword', 'text', 'input', 'prompt']

export function getSearchProvider(toolName?: string): SearchProvider | null {
  if (!toolName) return null
  return detectSearchProvider(toolName)
}

export function extractSearchQuery(input: unknown): string | null {
  const normalized = normalizeJsonValue(input)
  if (typeof normalized === 'string') {
    return normalized.trim() || null
  }

  if (!normalized || typeof normalized !== 'object') return null
  const args = normalized as Record<string, unknown>

  for (const field of QUERY_FIELDS) {
    const value = args[field]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  const origin = typeof args.origin === 'string' ? args.origin : ''
  const destination = typeof args.destination === 'string' ? args.destination : ''
  if (origin || destination) {
    return `${origin} to ${destination}`.trim()
  }

  if (typeof args.location === 'string' && args.location.trim()) {
    return args.location.trim()
  }

  return null
}

export function extractSearchResults(
  output: unknown,
  provider?: SearchProvider | null
): SearchResult[] {
  const normalized = normalizeJsonValue(output)
  if (!normalized) return []

  let rawResults: any[] = []

  if (Array.isArray(normalized)) {
    rawResults = normalized
  } else if (isRecord(normalized)) {
    if (Array.isArray(normalized.flat_results)) {
      rawResults = normalized.flat_results
    } else if (Array.isArray(normalized.results)) {
      rawResults = normalized.results
    } else if (Array.isArray(normalized.items)) {
      rawResults = normalized.items
    } else if (Array.isArray(normalized.hits)) {
      rawResults = normalized.hits
    } else if (Array.isArray(normalized.entries)) {
      rawResults = normalized.entries
    } else if (isRecord(normalized.web) && Array.isArray(normalized.web.results)) {
      rawResults = normalized.web.results
    }
  }

  return rawResults
    .map((item, index) => transformToSearchResult(item, provider, index))
    .filter((result) => result.title && result.url)
}

function normalizeJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}

function transformToSearchResult(
  item: Record<string, any>,
  provider: SearchProvider | null | undefined,
  index: number
): SearchResult {
  const result: SearchResult = {
    id: '',
    title: '',
    url: '',
  }

  result.title = item.title || item.name || item.headline || item.label || ''
  result.url = item.url || item.link || item.href || item.uri || ''
  result.snippet = item.snippet || item.description || item.summary || item.abstract || ''
  result.favicon = item.favicon || item.icon || item.logo || ''
  result.thumbnail = item.thumbnail || item.image || item.preview || ''

  switch (provider) {
    case 'brave':
      result.title = item.title || result.title
      result.url = item.url || result.url
      result.snippet = item.description || result.snippet
      result.favicon = item.profile?.img || result.favicon
      result.date = item.age || item.published || result.date
      break
    case 'pubmed':
      result.title = item.title || item.Title || result.title
      result.url =
        item.url ||
        (item.pmid || item.Id ? `https://pubmed.ncbi.nlm.nih.gov/${item.pmid || item.Id}/` : '') ||
        result.url
      result.snippet = item.abstract || item.Abstract || result.snippet
      result.author = item.authors?.[0] || item.Authors?.[0] || result.author
      result.date = item.pubdate || item.PubDate || result.date
      result.metadata = {
        pmid: item.pmid || item.Id,
        journal: item.journal || item.Source,
        doi: item.doi || item.DOI,
      }
      break
    case 'arxiv':
      result.title = item.title || result.title
      result.url = item.link || item.id || result.url
      result.snippet = item.summary || result.snippet
      result.author = item.author || item.authors?.[0]?.name || result.author
      result.date = item.published || item.updated || result.date
      result.metadata = {
        arxiv_id: item.id,
        category: item.category,
        pdf_url: item.pdf_url || item.link?.replace('abs', 'pdf'),
      }
      break
    case 'openfda':
      result.title = item.openfda?.brand_name?.[0] || item.product_description || result.title
      result.url = item.id ? `https://api.fda.gov/drug/label.json?search=${item.id}` : result.url
      result.snippet = item.description || item.purpose?.[0] || result.snippet
      result.metadata = {
        manufacturer: item.openfda?.manufacturer_name?.[0],
        product_type: item.product_type,
        route: item.openfda?.route?.[0],
      }
      break
    case 'google-flights':
      result.title = `${item.origin || ''} -> ${item.destination || ''}`.trim() || result.title
      result.url = item.booking_url || result.url
      result.snippet = `${item.airline || ''} ${item.duration ? `- ${item.duration}` : ''} ${item.price ? `- $${item.price}` : ''}`.trim()
      result.metadata = {
        price: item.price,
        duration: item.duration,
        stops: item.stops,
        departure: item.departure_time,
        arrival: item.arrival_time,
      }
      break
    case 'airbnb':
      result.title = item.name || item.title || result.title
      result.url = item.url || item.listing_url || result.url
      result.snippet =
        item.description ||
        `${item.property_type || ''}${item.bedrooms ? ` - ${item.bedrooms} bed` : ''}${item.bathrooms ? `, ${item.bathrooms} bath` : ''}`.trim()
      result.thumbnail = item.picture_url || item.thumbnail_url || result.thumbnail
      result.metadata = {
        price: item.price,
        rating: item.review_scores_rating,
        reviews: item.number_of_reviews,
        property_type: item.property_type,
      }
      break
    default:
      break
  }

  if (item.score !== undefined) {
    result.relevanceScore = item.score
  } else if (item.relevance !== undefined) {
    result.relevanceScore = item.relevance
  } else if (item.confidence !== undefined) {
    result.relevanceScore = item.confidence
  }

  if (!result.title && result.url) {
    result.title = result.url
  }

  result.id = result.id || `${provider || 'search'}-${index}`
  return result
}
