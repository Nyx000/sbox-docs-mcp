import MiniSearch from 'minisearch'
import { fetchAllOutlineDocs } from './fetcher.js'
import { Cache } from './cache.js'
import type { FetchResult } from './fetcher.js'

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'be', 'been', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'as', 'how', 'what', 'which', 'who', 'when', 'where', 'why',
  'do', 'does', 'did', 'has', 'have', 'had', 'will', 'would', 'could',
  'should', 'can', 'it', 'its', 'this', 'that', 'not', 'no', 'so',
  'if', 'then', 'than', 'too', 'very', 'just',
])

const PASCAL_SPLIT = /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/

function splitCompoundTerm(term: string): string[] {
  const parts = term.split(PASCAL_SPLIT)
  if (parts.length <= 1) return [term.toLowerCase()]
  const lowerParts = parts.map((p) => p.toLowerCase()).filter((p) => p.length >= 2)
  return [term.toLowerCase(), ...lowerParts]
}

function processSearchTerm(term: string): string[] | null {
  const lower = term.toLowerCase()
  if (STOP_WORDS.has(lower)) return null
  if (lower.length < 2) return null
  return splitCompoundTerm(term)
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

interface IndexedPage {
  id: string
  title: string
  content: string
  url: string
}

const SNIPPET_LENGTH = 200

function extractSnippet(content: string, query: string): string {
  const lower = content.toLowerCase()
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .flatMap((t) => splitCompoundTerm(t))
    .filter((t) => !STOP_WORDS.has(t) && t.length >= 2)

  let bestPos = -1
  for (const term of terms) {
    const pos = lower.indexOf(term)
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos
    }
  }

  if (bestPos === -1) {
    return content.slice(0, SNIPPET_LENGTH).trim() + (content.length > SNIPPET_LENGTH ? '...' : '')
  }

  const start = Math.max(0, bestPos - 60)
  const end = Math.min(content.length, start + SNIPPET_LENGTH)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < content.length ? '...' : ''
  return prefix + content.slice(start, end).trim() + suffix
}

function stripMarkdownFormatting(md: string): string {
  return md
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export class SearchIndex {
  private index: MiniSearch<IndexedPage>
  private initialized = false
  private initializing: Promise<void> | null = null
  private pageCache: Cache<FetchResult> | null = null
  private documents = new Map<string, IndexedPage>()

  constructor(cache?: Cache<FetchResult>) {
    this.pageCache = cache ?? null
    this.index = new MiniSearch<IndexedPage>({
      fields: ['title', 'content'],
      storeFields: ['title', 'url'],
      idField: 'id',
      processTerm: processSearchTerm,
      searchOptions: {
        prefix: true,
        fuzzy: (term) => {
          if (term.length <= 3) return false
          if (term.length <= 5) return 1
          return 0.3
        },
        boost: { title: 3 },
        weights: { fuzzy: 0.3, prefix: 0.5 },
      },
    })
  }

  get isInitialized(): boolean {
    return this.initialized
  }

  get indexedCount(): number {
    return this.documents.size
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    if (this.initializing) {
      await this.initializing
      return
    }

    this.initializing = this._fetchAndIndex()
    await this.initializing
    this.initializing = null
  }

  private async _fetchAndIndex(): Promise<void> {
    const outlineDocs = await fetchAllOutlineDocs()

    for (const odoc of outlineDocs) {
      // Cache each page for getPage reuse
      if (this.pageCache) {
        this.pageCache.set(odoc.url, {
          markdown: odoc.text,
          title: odoc.title,
          url: odoc.url,
        })
      }

      const plainContent = stripMarkdownFormatting(odoc.text)

      const doc: IndexedPage = {
        id: odoc.url,
        title: odoc.title,
        content: plainContent,
        url: odoc.url,
      }

      this.index.add(doc)
      this.documents.set(odoc.url, doc)
    }

    this.initialized = true
  }

  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  search(query: string, limit = 10): SearchResult[] {
    if (!this.initialized) return []

    const results = this.index.search(query).slice(0, limit)

    return results.map((hit) => {
      const doc = this.documents.get(hit.id)
      const content = doc?.content ?? ''
      return {
        title: doc?.title ?? 'Untitled',
        url: doc?.url ?? hit.id,
        snippet: extractSnippet(content, query),
      }
    })
  }
}
