import * as cheerio from 'cheerio'
import TurndownService from 'turndown'
import { config } from './config.js'

export interface FetchResult {
  markdown: string
  title: string
  url: string
}

export interface CrawlResult extends FetchResult {
  links: string[]
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})

turndown.addRule('fencedCodeBlock', {
  filter: (node) => {
    return node.nodeName === 'PRE' && !!node.querySelector('code')
  },
  replacement: (_content, node) => {
    const code = (node as HTMLElement).querySelector('code')
    if (!code) return _content
    const lang = code.className?.match(/language-(\S+)/)?.[1] ?? ''
    const text = code.textContent ?? ''
    return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`
  },
})

function normalizeDocUrl(url: URL): string {
  // Normalize /doc/xxx to /s/sbox-dev/doc/xxx for consistency
  if (url.pathname.startsWith('/doc/')) {
    url.pathname = `/s/sbox-dev${url.pathname}`
  }
  url.hash = ''
  return url.href.replace(/\/$/, '')
}

function extractDocLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links = new Set<string>()
  const base = new URL(baseUrl)

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    try {
      const resolved = new URL(href, base)
      if (resolved.hostname !== 'docs.facepunch.com') return

      const isSboxDoc =
        resolved.pathname.includes('/s/sbox-dev') ||
        resolved.pathname.startsWith('/doc/')

      if (isSboxDoc) {
        links.add(normalizeDocUrl(resolved))
      }
    } catch {
      // Invalid URL, skip
    }
  })

  return [...links]
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(config.requestTimeoutMs),
    headers: {
      'User-Agent': config.userAgent,
      'Accept': 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

function parseHtml(html: string, url: string): { title: string; markdown: string; $: cheerio.CheerioAPI } {
  const $ = cheerio.load(html)

  const title =
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    'Untitled'

  // Remove non-content elements
  $('nav, header, footer, script, style, aside, noscript, svg').remove()
  $('[role="navigation"]').remove()
  $('[class*="sidebar"]').remove()
  $('[class*="header"]').remove()
  $('[class*="footer"]').remove()
  $('[class*="nav-"]').remove()

  const mainContent =
    $('article').html() ??
    $('main').html() ??
    $('.content').html() ??
    $('.page-content').html() ??
    $('[role="main"]').html() ??
    $('body').html() ??
    ''

  const markdown = turndown.turndown(mainContent).trim()

  return { title, markdown, $ }
}

export async function fetchPage(url: string): Promise<FetchResult> {
  const html = await fetchHtml(url)
  const { title, markdown } = parseHtml(html, url)
  return { markdown, title, url }
}

/**
 * Fetch a page and also extract internal documentation links.
 * Used by the crawler to discover new pages during indexing.
 */
export async function crawlPage(url: string): Promise<CrawlResult> {
  const html = await fetchHtml(url)
  // Extract links from raw HTML before stripping navigation
  const $raw = cheerio.load(html)
  const links = extractDocLinks($raw, url)
  // Parse content from cleaned HTML
  const { title, markdown } = parseHtml(html, url)
  return { markdown, title, url, links }
}

export interface OutlineDocument {
  id: string
  url: string
  title: string
  text: string
}

/**
 * Fetch all documents from the Outline share via the search API.
 * Returns documents with their Markdown text content already included.
 */
export async function fetchAllOutlineDocs(): Promise<OutlineDocument[]> {
  const allDocs: OutlineDocument[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const response = await fetch(`${config.docsApiUrl}/documents.search`, {
      method: 'POST',
      signal: AbortSignal.timeout(config.requestTimeoutMs),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': config.userAgent,
      },
      body: JSON.stringify({ shareId: config.docsShareId, query: '', limit, offset }),
    })

    if (!response.ok) {
      throw new Error(`Outline API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as {
      data: Array<{ document: { id: string; url: string; title: string; text: string } }>
      pagination: { total: number }
    }

    if (!data.data || data.data.length === 0) break

    for (const item of data.data) {
      const doc = item.document
      if (doc.text && doc.text.length > 0) {
        allDocs.push({
          id: doc.id,
          url: `${config.docsBaseUrl}${doc.url}`,
          title: doc.title,
          text: doc.text,
        })
      }
    }

    if (allDocs.length >= data.pagination.total) break
    offset += limit
  }

  return allDocs
}

export async function fetchApiType(_typeName: string): Promise<FetchResult> {
  throw new Error(
    'sbox_api_get_type is not yet implemented (planned for Phase 2). ' +
    'Use sbox_docs_search or sbox_docs_get_page to browse narrative documentation.',
  )
}
