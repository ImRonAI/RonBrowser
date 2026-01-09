# Ron Browser - Search & Agent Integration Plan

## Overview

This document outlines the phased implementation plan for integrating the Perplexity search capabilities with the Ron Browser frontend. The implementation builds upon the existing Python tools in `/agent/perplexity/` and connects them to the React frontend search UI.

---

## Phase 1: Frontend Search UI Foundation (The Lift: Easy)
**Target: Complete search results UI components**

### 1.1 Complete Search Results Components
- [x] `LoadingOverlay` - Reusable loading with rotating SVGs + quirky messages
- [x] `SearchThinkingOverlay` - Search-specific thinking state
- [x] `SourceCard` - Citation cards with hover actions
- [x] `SourcesGrid` - 5-column responsive grid layout
- [ ] `SearchQuickResults` - Main quick results view with:
  - Collapsible Chain of Thought
  - Streamed answer display (Raleway thin typography)
  - Source cards in rows of 5
  - "See Full Results" and "Try Again" buttons
- [ ] `SitePreviewModal` - iframe preview with fallback
- [ ] `index.ts` - Barrel exports

### 1.2 Search Store Integration
- [ ] Connect `searchStore` to API client
- [ ] Wire up phase transitions (thinking → reasoning → answering → complete)
- [ ] Handle streaming answer updates

---

## Phase 2: API Layer & TypeScript Client (The Lift: Not Bad)
**Target: Create TypeScript API client for Perplexity backend**

### 2.1 API Types (`/src/types/search.ts`)
```typescript
interface SearchRequest {
  query: string;
  mode: 'quick' | 'standard' | 'deep';
  filters?: SearchFilters;
}

interface SearchFilters {
  domains?: string[];
  recency?: 'day' | 'week' | 'month' | 'year';
  dateRange?: { after?: string; before?: string };
}

interface SearchResult {
  id: string;
  url: string;
  title: string;
  snippet: string;
  domain: string;
  type: 'web' | 'academic' | 'video' | 'code';
  images?: MediaAsset[];
  videos?: MediaAsset[];
}

interface ChainOfThoughtStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'complete';
  reasoning?: string;
  sources?: string[];
}

interface QuickSearchResponse {
  query: string;
  answer: string;
  reasoning: ChainOfThoughtStep[];
  sources: SearchResult[];
  relatedQueries: string[];
}
```

### 2.2 API Client (`/src/api/search.ts`)
- [ ] `startSearch(query, options)` - Initiates search
- [ ] `fetchSearchResults(requestId)` - Poll for results
- [ ] `cancelSearch(requestId)` - Cancel in-flight search
- [ ] SSE streaming support for real-time updates

---

## Phase 3: Perplexity Backend Integration (The Lift: A Bit Heavy)
**Target: Connect Python Perplexity tools to frontend via API**

### 3.1 FastAPI Endpoints (or Express if using Node)
```
POST /api/search/quick     → perplexity_sonar_pro
POST /api/search/reasoning → perplexity_reasoning_pro  
POST /api/search/deep      → perplexity_deep_research (async)
GET  /api/search/status/:id → Poll deep research status
```

### 3.2 Perplexity Tool Selection Logic
| Search Mode | Tool | Use Case |
|-------------|------|----------|
| Quick | `perplexity_sonar_pro` | Fast answers, simple queries |
| Standard | `perplexity_reasoning_pro` | Multi-step reasoning, comparisons |
| Deep Research | `perplexity_deep_research` | Comprehensive research, citations |

### 3.3 Streaming Architecture
- Frontend opens SSE connection
- Backend streams:
  1. Chain of thought steps (as they complete)
  2. Answer tokens (as received from Perplexity)
  3. Sources (batch when available)
  4. Completion signal

---

## Phase 4: Deep Research Integration (The Lift: Heavy)
**Target: Async deep research with background polling**

### 4.1 Deep Research Flow
```
User searches → 
  Show thinking overlay → 
  Start deep research job (request_id) →
  Show "Research in progress" with progress indicators →
  Poll for completion (background) →
  Stream results when ready
```

### 4.2 Progress Indicators
- Estimated time remaining
- Sources analyzed count
- Current research phase
- Partial results as available

### 4.3 State Persistence
- Store `request_id` in Zustand with persistence
- Resume polling on app restart
- Handle 7-day TTL from Perplexity

---

## Phase 5: Agent Integration (The Lift: Very Heavy)
**Target: Connect search to Ron agent for follow-up actions**

### 5.1 Source Actions
From `SourceCard` hover actions:
- **Send to Ron** → Opens agent panel with source context
- **Send to Coding** → Opens coding agent with code context
- **Attach to Task** → Adds source as task attachment
- **Start Task** → Creates new task from source

### 5.2 Search → Agent Pipeline
```typescript
// User clicks "Send to Ron" on a source
const handleSendToRon = (source: SourceData) => {
  agentStore.startConversation({
    context: {
      type: 'search_source',
      source,
      originalQuery: searchStore.query,
    },
    initialPrompt: `Based on this source: ${source.title}...`
  });
};
```

### 5.3 Agent-Initiated Research
- Agent can trigger deep research mid-conversation
- Results streamed back to agent context
- Agent synthesizes research into response

---

## Phase 6: Polish & Optimization (The Lift: Easy)
**Target: Performance, caching, error handling**

### 6.1 Caching Strategy
- Cache search results by query hash (5 min TTL)
- Cache source metadata (favicons, previews)
- IndexedDB for offline access to recent searches

### 6.2 Error Handling
- Graceful degradation when Perplexity unavailable
- Retry logic with exponential backoff
- User-friendly error messages

### 6.3 Analytics & Monitoring
- Track search latency
- Track result click-through rates
- Monitor API usage/costs

---

## GitHub Issues for Linear Import

### Phase 1 Issues
1. **[P1-1] Complete SearchQuickResults component**
   - Labels: `frontend`, `search`, `priority-high`
   - Description: Build main quick results view with collapsible CoT, streamed answer, sources grid

2. **[P1-2] Create SitePreviewModal component**
   - Labels: `frontend`, `search`, `priority-medium`
   - Description: Modal for iframe website previews with fallback handling

3. **[P1-3] Wire searchStore to search flow**
   - Labels: `frontend`, `state`, `priority-high`
   - Description: Connect store phase transitions to UI rendering

### Phase 2 Issues
4. **[P2-1] Define TypeScript types for search API**
   - Labels: `frontend`, `types`, `priority-high`
   - Description: Create comprehensive types in `/src/types/search.ts`

5. **[P2-2] Build search API client**
   - Labels: `frontend`, `api`, `priority-high`
   - Description: TypeScript client with SSE streaming support

### Phase 3 Issues
6. **[P3-1] Create backend search endpoints**
   - Labels: `backend`, `api`, `priority-high`
   - Description: FastAPI/Express endpoints for Perplexity tools

7. **[P3-2] Implement search mode selection logic**
   - Labels: `backend`, `search`, `priority-medium`
   - Description: Route queries to appropriate Perplexity model

8. **[P3-3] Add SSE streaming from backend**
   - Labels: `backend`, `streaming`, `priority-high`
   - Description: Stream CoT, answers, and sources to frontend

### Phase 4 Issues
9. **[P4-1] Integrate deep research async flow**
   - Labels: `backend`, `search`, `priority-high`
   - Description: Handle async job creation and polling for deep research

10. **[P4-2] Add research progress indicators**
    - Labels: `frontend`, `ux`, `priority-medium`
    - Description: Show progress while deep research runs

11. **[P4-3] Persist research jobs across sessions**
    - Labels: `frontend`, `state`, `priority-low`
    - Description: Store and resume pending research jobs

### Phase 5 Issues
12. **[P5-1] Implement source action handlers**
    - Labels: `frontend`, `agent`, `priority-high`
    - Description: Handle Send to Ron/Coding, Attach to Task, Start Task

13. **[P5-2] Build search-to-agent context pipeline**
    - Labels: `frontend`, `agent`, `priority-high`
    - Description: Pass search context to agent conversations

14. **[P5-3] Enable agent-initiated research**
    - Labels: `agent`, `search`, `priority-medium`
    - Description: Allow Ron to trigger deep research mid-conversation

### Phase 6 Issues
15. **[P6-1] Implement search result caching**
    - Labels: `frontend`, `performance`, `priority-medium`
    - Description: Cache results with appropriate TTL

16. **[P6-2] Add comprehensive error handling**
    - Labels: `frontend`, `backend`, `priority-medium`
    - Description: Graceful degradation and retry logic

17. **[P6-3] Add search analytics tracking**
    - Labels: `analytics`, `priority-low`
    - Description: Track latency, CTR, and usage metrics

---

## File Structure

```
src/
├── api/
│   ├── search.ts          # Search API client
│   └── streaming.ts       # SSE utilities
├── components/
│   └── search-results/
│       ├── LoadingOverlay.tsx        ✅ Created
│       ├── SearchThinkingOverlay.tsx ✅ Created
│       ├── SourceCard.tsx            ✅ Created
│       ├── SourcesGrid.tsx           ✅ Created
│       ├── SearchQuickResults.tsx    📝 TODO
│       ├── SitePreviewModal.tsx      📝 TODO
│       └── index.ts                  📝 TODO
├── stores/
│   └── searchStore.ts     ✅ Exists (needs API connection)
└── types/
    └── search.ts          📝 TODO (expand types)

agent/
└── perplexity/
    ├── perplexity_deep_research.py   ✅ Exists
    ├── perplexity_reasoning_pro.py   ✅ Exists
    ├── perplexity_search_api.py      ✅ Exists
    └── perplexity_sonar_pro.py       ✅ Exists
```

---

## Next Steps

1. **Immediate**: Complete Phase 1 (frontend components)
2. **This Week**: Phase 2 (API types and client)
3. **Next Week**: Phase 3 (backend integration)
4. **Following**: Phases 4-6 as capacity allows

---

## Dependencies

- `perplexityai` Python package (backend)
- `aiohttp` for async HTTP (backend)  
- `bs4` (BeautifulSoup) for media extraction
- Frontend: React, Zustand, TailwindCSS, Heroicons
