import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SearchIndex } from '../lib/search-index.js'
import { Cache } from '../lib/cache.js'
import type { FetchResult } from '../lib/fetcher.js'

// Mock the fetcher module
vi.mock('../lib/fetcher.js', () => ({
  crawlPage: vi.fn(),
  fetchPage: vi.fn(),
  fetchApiType: vi.fn(),
}))

import { crawlPage } from '../lib/fetcher.js'
const mockedCrawl = vi.mocked(crawlPage)

function makePage(url: string, title: string, content: string, links: string[] = []) {
  return { url, title, markdown: content, links }
}

describe('SearchIndex', () => {
  let index: SearchIndex
  let cache: Cache<FetchResult>

  beforeEach(() => {
    vi.clearAllMocks()
    cache = new Cache<FetchResult>(60000, 100)
    index = new SearchIndex(cache)
  })

  it('should instantiate without error', () => {
    expect(index).toBeDefined()
    expect(index.isInitialized).toBe(false)
  })

  it('should return empty results before initialization', () => {
    const results = index.search('test')
    expect(results).toEqual([])
  })

  it('should initialize by crawling pages', async () => {
    mockedCrawl
      .mockResolvedValueOnce(
        makePage(
          'https://docs.facepunch.com/s/sbox-dev',
          'S&box Docs',
          '# S&box Documentation\n\nWelcome to s&box.',
          ['https://docs.facepunch.com/s/sbox-dev/doc/components-abc'],
        ),
      )
      .mockResolvedValueOnce(
        makePage(
          'https://docs.facepunch.com/s/sbox-dev/doc/components-abc',
          'Components',
          '# Components\n\nComponents are the building blocks of game logic.',
          [],
        ),
      )

    await index.initialize()

    expect(index.isInitialized).toBe(true)
    expect(index.indexedCount).toBe(2)
  })

  it('should find pages by title', async () => {
    mockedCrawl
      .mockResolvedValueOnce(
        makePage(
          'https://docs.facepunch.com/s/sbox-dev',
          'S&box Docs',
          'Welcome to s&box documentation.',
          ['https://docs.facepunch.com/s/sbox-dev/doc/networking-xyz'],
        ),
      )
      .mockResolvedValueOnce(
        makePage(
          'https://docs.facepunch.com/s/sbox-dev/doc/networking-xyz',
          'Networking & Multiplayer',
          'The networking system syncs game state across clients.',
          [],
        ),
      )

    await index.initialize()

    const results = index.search('networking')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toBe('Networking & Multiplayer')
  })

  it('should find pages by content', async () => {
    mockedCrawl.mockResolvedValueOnce(
      makePage(
        'https://docs.facepunch.com/s/sbox-dev',
        'Home',
        'Components are C# classes that attach to GameObjects and provide behavior.',
        [],
      ),
    )

    await index.initialize()

    const results = index.search('GameObjects behavior')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].snippet).toContain('GameObjects')
  })

  it('should respect the limit parameter', async () => {
    mockedCrawl
      .mockResolvedValueOnce(
        makePage('https://docs.facepunch.com/s/sbox-dev', 'Home', 'component guide reference', [
          'https://docs.facepunch.com/s/sbox-dev/doc/a-1',
          'https://docs.facepunch.com/s/sbox-dev/doc/b-2',
          'https://docs.facepunch.com/s/sbox-dev/doc/c-3',
        ]),
      )
      .mockResolvedValueOnce(makePage('https://docs.facepunch.com/s/sbox-dev/doc/a-1', 'Component A', 'component a guide', []))
      .mockResolvedValueOnce(makePage('https://docs.facepunch.com/s/sbox-dev/doc/b-2', 'Component B', 'component b reference', []))
      .mockResolvedValueOnce(makePage('https://docs.facepunch.com/s/sbox-dev/doc/c-3', 'Component C', 'component c guide', []))

    await index.initialize()

    const results = index.search('component', 2)
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('should cache fetched pages for getPage reuse', async () => {
    const pageUrl = 'https://docs.facepunch.com/s/sbox-dev'
    mockedCrawl.mockResolvedValueOnce(
      makePage(pageUrl, 'Home', 'Welcome content', []),
    )

    await index.initialize()

    expect(cache.has(pageUrl)).toBe(true)
    const cached = cache.get(pageUrl)
    expect(cached?.title).toBe('Home')
  })

  it('should skip pages that fail to fetch', async () => {
    mockedCrawl
      .mockResolvedValueOnce(
        makePage('https://docs.facepunch.com/s/sbox-dev', 'Home', 'Welcome', [
          'https://docs.facepunch.com/s/sbox-dev/doc/broken-page',
        ]),
      )
      .mockRejectedValueOnce(new Error('404 Not Found'))

    await index.initialize()

    expect(index.isInitialized).toBe(true)
    expect(index.indexedCount).toBe(1)
  })

  it('should handle concurrent initialize calls', async () => {
    mockedCrawl.mockResolvedValue(
      makePage('https://docs.facepunch.com/s/sbox-dev', 'Home', 'Welcome', []),
    )

    // Call initialize twice concurrently
    await Promise.all([index.initialize(), index.initialize()])

    // crawlPage should only be called once (not twice)
    expect(mockedCrawl).toHaveBeenCalledTimes(1)
  })

  it('should use ensureInitialized for lazy init', async () => {
    mockedCrawl.mockResolvedValueOnce(
      makePage('https://docs.facepunch.com/s/sbox-dev', 'Home', 'Welcome', []),
    )

    expect(index.isInitialized).toBe(false)
    await index.ensureInitialized()
    expect(index.isInitialized).toBe(true)
  })
})
