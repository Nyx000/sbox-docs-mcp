import MiniSearch from 'minisearch'
import { config } from './config.js'
import { crawlPage } from './fetcher.js'
import { Cache } from './cache.js'
import type { FetchResult } from './fetcher.js'

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
  const terms = query.toLowerCase().split(/\s+/)

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
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
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
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { title: 2 },
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

    this.initializing = this._crawlAndIndex()
    await this.initializing
    this.initializing = null
  }

  private async _crawlAndIndex(): Promise<void> {
    const visited = new Set<string>()
    const queue: string[] = [config.docsBaseUrl]
    let indexed = 0

    while (queue.length > 0 && indexed < config.maxCrawlPages) {
      const url = queue.shift()!
      if (visited.has(url)) continue
      visited.add(url)

      try {
        const result = await crawlPage(url)

        // Cache the fetched page for getPage reuse
        if (this.pageCache) {
          this.pageCache.set(url, {
            markdown: result.markdown,
            title: result.title,
            url: result.url,
          })
        }

        const plainContent = stripMarkdownFormatting(result.markdown)

        const doc: IndexedPage = {
          id: url,
          title: result.title,
          content: plainContent,
          url,
        }

        this.index.add(doc)
        this.documents.set(url, doc)
        indexed++

        // Enqueue discovered links
        for (const link of result.links) {
          if (!visited.has(link)) {
            queue.push(link)
          }
        }
      } catch {
        // Skip pages that fail to fetch
        continue
      }
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
