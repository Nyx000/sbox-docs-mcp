import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSearch, mockEnsureInitialized, mockFetchPage } = vi.hoisted(() => ({
  mockSearch: vi.fn(() => [
    {
      title: 'Components Guide',
      url: 'https://docs.facepunch.com/s/sbox-dev/doc/components-abc',
      snippet: 'Components are the building blocks...',
    },
  ]),
  mockEnsureInitialized: vi.fn(async () => {}),
  mockFetchPage: vi.fn(async () => ({
    markdown: '# Test Page\n\nThis is the page content with enough text to test chunking behavior across multiple reads and verify pagination works correctly.',
    title: 'Test Page',
    url: 'https://docs.facepunch.com/s/sbox-dev/doc/test-abc',
  })),
}))

vi.mock('../lib/instances.js', () => ({
  pageCache: {
    get: vi.fn(() => undefined),
    set: vi.fn(),
    has: vi.fn(() => false),
  },
  searchIndex: {
    isInitialized: false,
    ensureInitialized: mockEnsureInitialized,
    search: mockSearch,
  },
}))

vi.mock('../lib/fetcher.js', () => ({
  fetchPage: mockFetchPage,
  fetchApiType: vi.fn(async () => {
    throw new Error('sbox_api_get_type is not yet implemented (planned for Phase 2).')
  }),
}))

import { searchDocs } from '../tools/search-docs.js'
import { getPage } from '../tools/get-page.js'
import { getApiType } from '../tools/get-api-type.js'

describe('searchDocs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearch.mockReturnValue([
      {
        title: 'Components Guide',
        url: 'https://docs.facepunch.com/s/sbox-dev/doc/components-abc',
        snippet: 'Components are the building blocks...',
      },
    ])
  })

  it('should return formatted results', async () => {
    const result = await searchDocs({ query: 'components', limit: 10 })

    expect(result).toContain('Results for "components"')
    expect(result).toContain('Components Guide')
    expect(result).toContain('docs.facepunch.com')
    expect(result).toContain('building blocks')
  })

  it('should return no-results message for empty search', async () => {
    mockSearch.mockReturnValueOnce([])

    const result = await searchDocs({ query: 'nonexistent', limit: 10 })
    expect(result).toContain('No results found')
  })

  it('should call ensureInitialized before searching', async () => {
    await searchDocs({ query: 'test', limit: 5 })
    expect(mockEnsureInitialized).toHaveBeenCalled()
  })
})

describe('getPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return markdown with title', async () => {
    const result = await getPage({
      url: 'https://docs.facepunch.com/s/sbox-dev/doc/test-abc',
      start_index: 0,
      max_length: 5000,
    })

    expect(result).toContain('# Test Page')
    expect(result).toContain('page content')
  })

  it('should apply chunking with pagination info', async () => {
    const result = await getPage({
      url: 'https://docs.facepunch.com/s/sbox-dev/doc/test-abc',
      start_index: 0,
      max_length: 30,
    })

    expect(result).toContain('start_index=')
    expect(result).toContain('next chunk')
  })

  it('should not show pagination when content fits', async () => {
    const result = await getPage({
      url: 'https://docs.facepunch.com/s/sbox-dev/doc/test-abc',
      start_index: 0,
      max_length: 50000,
    })

    expect(result).not.toContain('start_index=')
  })
})

describe('getApiType', () => {
  it('should throw Phase 2 error', async () => {
    await expect(
      getApiType({
        type_name: 'GameObject',
        include_methods: true,
        include_properties: true,
      }),
    ).rejects.toThrow('Phase 2')
  })
})
