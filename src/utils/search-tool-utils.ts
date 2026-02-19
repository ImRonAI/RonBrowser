// ─────────────────────────────────────────────────────────────────────────────
// Types & helpers (previously imported from deleted chain-of-thought-search.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export type SearchProvider =
  | 'brave'
  | 'perplexity'
  | 'tavily'
  | 'exa'
  | 'bright-data'
  | 'pubmed'
  | 'arxiv'
  | 'openfda'
  | 'google-flights'
  | 'airbnb'
  | 'wikipedia'
  | 'youtube'
  | 'hackernews'
  | 'huggingface'

export interface SearchResult {
  id: string
  title: string
  url: string
  snippet?: string
  favicon?: string
  thumbnail?: string
  date?: string
  author?: string
  relevanceScore?: number
  metadata?: Record<string, unknown>
}

/** Map a tool name to a SearchProvider identifier */
function detectSearchProvider(toolName: string): SearchProvider | null {
  const name = toolName.toLowerCase()
  if (name.includes('brave')) return 'brave'
  if (name.includes('perplexity') || name.includes('sonar')) return 'perplexity'
  if (name.includes('tavily')) return 'tavily'
  if (name.includes('exa')) return 'exa'
  if (name.includes('bright_data') || name.includes('brightdata')) return 'bright-data'
  if (name.includes('pubmed')) return 'pubmed'
  if (name.includes('arxiv')) return 'arxiv'
  if (name.includes('openfda') || name.includes('fda')) return 'openfda'
  if (name.includes('flight')) return 'google-flights'
  if (name.includes('airbnb')) return 'airbnb'
  if (name.includes('wikipedia') || name.includes('wiki')) return 'wikipedia'
  if (name.includes('youtube')) return 'youtube'
  if (name.includes('hackernews') || name.includes('hacker_news') || name.includes('hn_')) return 'hackernews'
  if (name.includes('huggingface') || name.includes('hf_')) return 'huggingface'
  return null
}

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
    case 'tavily':
      result.title = item.title || result.title
      result.url = item.url || result.url
      result.snippet = item.content || item.raw_content || item.snippet || result.snippet
      result.relevanceScore = item.score || item.relevance_score || result.relevanceScore
      result.date = item.published_date || result.date
      break
    case 'exa':
      result.title = item.title || result.title
      result.url = item.url || result.url
      result.snippet = item.text || item.highlights?.[0] || item.snippet || result.snippet
      result.author = item.author || result.author
      result.date = item.publishedDate || result.date
      result.relevanceScore = item.score || item.similarity || result.relevanceScore
      break
    case 'bright-data':
      result.title = item.title || item.name || result.title
      result.url = item.url || item.link || result.url
      result.snippet = item.description || item.text || item.content || result.snippet
      result.thumbnail = item.image || item.thumbnail || result.thumbnail
      break
    case 'wikipedia':
      result.title = item.title || result.title
      result.url = item.url || (item.pageid ? `https://en.wikipedia.org/?curid=${item.pageid}` : '') || result.url
      result.snippet = item.snippet || item.extract || item.description || result.snippet
      result.thumbnail = item.thumbnail?.source || item.originalimage?.source || result.thumbnail
      break
    case 'youtube':
      result.title = item.title || item.snippet?.title || result.title
      result.url = item.url || (item.videoId ? `https://youtube.com/watch?v=${item.videoId}` : '') || result.url
      result.snippet = item.description || item.snippet?.description || result.snippet
      result.thumbnail = item.thumbnail || item.snippet?.thumbnails?.default?.url || result.thumbnail
      result.author = item.channelTitle || item.channel || result.author
      result.date = item.publishedAt || result.date
      break
    case 'hackernews':
      result.title = item.title || result.title
      result.url = item.url || item.story_url || (item.objectID ? `https://news.ycombinator.com/item?id=${item.objectID}` : '') || result.url
      result.snippet = item.story_text || item.comment_text || result.snippet
      result.author = item.author || result.author
      result.date = item.created_at || result.date
      result.metadata = {
        points: item.points,
        num_comments: item.num_comments,
      }
      break
    case 'huggingface':
      result.title = item.id || item.modelId || item.name || result.title
      result.url = item.url || (item.id ? `https://huggingface.co/${item.id}` : '') || result.url
      result.snippet = item.description || item.pipeline_tag || result.snippet
      result.metadata = {
        downloads: item.downloads,
        likes: item.likes,
        pipeline_tag: item.pipeline_tag,
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
