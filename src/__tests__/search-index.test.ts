import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SearchIndex } from '../lib/search-index.js'
import { Cache } from '../lib/cache.js'
import type { FetchResult, OutlineDocument } from '../lib/fetcher.js'

vi.mock('../lib/fetcher.js', () => ({
  fetchAllOutlineDocs: vi.fn(),
  fetchPage: vi.fn(),
  crawlPage: vi.fn(),
  fetchApiType: vi.fn(),
}))

import { fetchAllOutlineDocs } from '../lib/fetcher.js'
const mockedFetchDocs = vi.mocked(fetchAllOutlineDocs)

function makeDoc(id: string, url: string, title: string, text: string): OutlineDocument {
  return { id, url, title, text }
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

  it('should initialize by fetching Outline documents', async () => {
    mockedFetchDocs.mockResolvedValueOnce([
      makeDoc('1', 'https://docs.facepunch.com/doc/home', 'S&box Docs', '# S&box Documentation\n\nWelcome to s&box.'),
      makeDoc('2', 'https://docs.facepunch.com/doc/components-abc', 'Components', '# Components\n\nComponents are the building blocks of game logic.'),
    ])

    await index.initialize()

    expect(index.isInitialized).toBe(true)
    expect(index.indexedCount).toBe(2)
  })

  it('should find pages by title', async () => {
    mockedFetchDocs.mockResolvedValueOnce([
      makeDoc('1', 'https://docs.facepunch.com/doc/home', 'S&box Docs', 'Welcome to s&box documentation.'),
      makeDoc('2', 'https://docs.facepunch.com/doc/networking-xyz', 'Networking & Multiplayer', 'The networking system syncs game state across clients.'),
    ])

    await index.initialize()

    const results = index.search('networking')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toBe('Networking & Multiplayer')
  })

  it('should find pages by content', async () => {
    mockedFetchDocs.mockResolvedValueOnce([
      makeDoc('1', 'https://docs.facepunch.com/doc/home', 'Home', 'Components are C# classes that attach to GameObjects and provide behavior.'),
    ])

    await index.initialize()

    const results = index.search('GameObjects behavior')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].snippet).toContain('GameObjects')
  })

  it('should respect the limit parameter', async () => {
    mockedFetchDocs.mockResolvedValueOnce([
      makeDoc('1', 'https://docs.facepunch.com/doc/a', 'Home', 'component guide reference'),
      makeDoc('2', 'https://docs.facepunch.com/doc/b', 'Component A', 'component a guide'),
      makeDoc('3', 'https://docs.facepunch.com/doc/c', 'Component B', 'component b reference'),
      makeDoc('4', 'https://docs.facepunch.com/doc/d', 'Component C', 'component c guide'),
    ])

    await index.initialize()

    const results = index.search('component', 2)
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('should cache fetched pages for getPage reuse', async () => {
    const pageUrl = 'https://docs.facepunch.com/doc/home'
    mockedFetchDocs.mockResolvedValueOnce([
      makeDoc('1', pageUrl, 'Home', 'Welcome content'),
    ])

    await index.initialize()

    expect(cache.has(pageUrl)).toBe(true)
    const cached = cache.get(pageUrl)
    expect(cached?.title).toBe('Home')
  })

  it('should handle API errors gracefully', async () => {
    mockedFetchDocs.mockRejectedValueOnce(new Error('API error'))

    await expect(index.initialize()).rejects.toThrow('API error')
  })

  it('should handle concurrent initialize calls', async () => {
    mockedFetchDocs.mockResolvedValue([
      makeDoc('1', 'https://docs.facepunch.com/doc/home', 'Home', 'Welcome'),
    ])

    await Promise.all([index.initialize(), index.initialize()])

    expect(mockedFetchDocs).toHaveBeenCalledTimes(1)
  })

  it('should use ensureInitialized for lazy init', async () => {
    mockedFetchDocs.mockResolvedValueOnce([
      makeDoc('1', 'https://docs.facepunch.com/doc/home', 'Home', 'Welcome'),
    ])

    expect(index.isInitialized).toBe(false)
    await index.ensureInitialized()
    expect(index.isInitialized).toBe(true)
  })

  it('should find PascalCase terms when searched by sub-word', async () => {
    mockedFetchDocs.mockResolvedValueOnce([
      makeDoc(
        '1',
        'https://docs.facepunch.com/doc/scene-meta',
        'Scene Metadata',
        'Use SceneFile to load scenes.',
      ),
      makeDoc(
        '2',
        'https://docs.facepunch.com/doc/other',
        'Other Page',
        'This page has nothing relevant.',
      ),
    ])

    await index.initialize()

    // "file" alone should match "SceneFile" via PascalCase decomposition
    const results = index.search('file')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toBe('Scene Metadata')
  })

  it('should find content inside code blocks', async () => {
    mockedFetchDocs.mockResolvedValueOnce([
      makeDoc(
        '1',
        'https://docs.facepunch.com/doc/comp',
        'Components',
        'Create components:\n```csharp\npublic class MyCustomComponent : Component { }\n```',
      ),
    ])

    await index.initialize()

    const results = index.search('MyCustomComponent')
    expect(results.length).toBeGreaterThan(0)
  })

  it('should ignore stop words and still find relevant results', async () => {
    mockedFetchDocs.mockResolvedValueOnce([
      makeDoc(
        '1',
        'https://docs.facepunch.com/doc/spawn',
        'Spawning Objects',
        'Learn to spawn objects at runtime in your game scene.',
      ),
    ])

    await index.initialize()

    const results = index.search('how to spawn objects at runtime')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toBe('Spawning Objects')
  })

  it('should find results despite typos via fuzzy matching', async () => {
    mockedFetchDocs.mockResolvedValueOnce([
      makeDoc(
        '1',
        'https://docs.facepunch.com/doc/physics',
        'Physics System',
        'The collision system handles physics interactions with rigidbody components.',
      ),
    ])

    await index.initialize()

    const results = index.search('colision')
    expect(results.length).toBeGreaterThan(0)
  })
})
