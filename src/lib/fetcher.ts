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

function extractDocLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links = new Set<string>()
  const base = new URL(baseUrl)

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    try {
      const resolved = new URL(href, base)
      if (
        resolved.hostname === 'docs.facepunch.com' &&
        resolved.pathname.includes('/s/sbox-dev')
      ) {
        resolved.hash = ''
        const clean = resolved.href.replace(/\/$/, '')
        links.add(clean)
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

export async function fetchApiType(_typeName: string): Promise<FetchResult> {
  throw new Error(
    'sbox_api_get_type is not yet implemented (planned for Phase 2). ' +
    'Use sbox_docs_search or sbox_docs_get_page to browse narrative documentation.',
  )
}
