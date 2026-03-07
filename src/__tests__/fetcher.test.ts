import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPage, crawlPage, fetchApiType, fetchAllOutlineDocs } from '../lib/fetcher.js'

const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Test Page Title</title></head>
<body>
  <nav><a href="/nav-link">Nav</a></nav>
  <header><div class="header-bar">Header</div></header>
  <article>
    <h1>Component Guide</h1>
    <p>Components are the building blocks of game logic.</p>
    <pre><code class="language-csharp">public class MyComponent : Component {}</code></pre>
    <a href="/s/sbox-dev/doc/other-page-abc123">Other Page</a>
  </article>
  <footer>Footer content</footer>
  <script>console.log('strip me')</script>
</body>
</html>
`

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchPage', () => {
  it('should fetch and convert HTML to markdown', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_HTML,
    })

    const result = await fetchPage('https://docs.facepunch.com/s/sbox-dev/doc/test-abc')

    expect(result.title).toBe('Component Guide')
    expect(result.url).toBe('https://docs.facepunch.com/s/sbox-dev/doc/test-abc')
    expect(result.markdown).toContain('Component Guide')
    expect(result.markdown).toContain('building blocks')
    // Should not contain nav/footer/script content
    expect(result.markdown).not.toContain('Footer content')
    expect(result.markdown).not.toContain('strip me')
  })

  it('should throw on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    await expect(
      fetchPage('https://docs.facepunch.com/s/sbox-dev/doc/missing-page'),
    ).rejects.toThrow('Failed to fetch')
  })

  it('should extract title from h1 first, then fallback to title tag', async () => {
    const htmlNoH1 = `<html><head><title>Fallback Title</title></head><body><p>Content</p></body></html>`
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => htmlNoH1,
    })

    const result = await fetchPage('https://docs.facepunch.com/s/sbox-dev/doc/test')
    expect(result.title).toBe('Fallback Title')
  })

  it('should handle code blocks with language detection', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_HTML,
    })

    const result = await fetchPage('https://docs.facepunch.com/s/sbox-dev/doc/test')
    expect(result.markdown).toContain('```csharp')
    expect(result.markdown).toContain('MyComponent')
  })
})

describe('crawlPage', () => {
  it('should return page content plus discovered links', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_HTML,
    })

    const result = await crawlPage('https://docs.facepunch.com/s/sbox-dev/doc/test')

    expect(result.title).toBe('Component Guide')
    expect(result.markdown).toContain('building blocks')
    expect(result.links).toBeInstanceOf(Array)
    // Should find the internal link in the HTML
    expect(result.links.some(l => l.includes('other-page-abc123'))).toBe(true)
  })
})

describe('fetchAllOutlineDocs', () => {
  it('should fetch all documents via Outline search API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { document: { id: '1', url: '/doc/page-a', title: 'Page A', text: 'Content A' } },
          { document: { id: '2', url: '/doc/page-b', title: 'Page B', text: 'Content B' } },
        ],
        pagination: { total: 2 },
      }),
    })

    const docs = await fetchAllOutlineDocs()

    expect(docs).toHaveLength(2)
    expect(docs[0].title).toBe('Page A')
    expect(docs[0].text).toBe('Content A')
    expect(docs[0].url).toContain('/doc/page-a')
    expect(docs[1].title).toBe('Page B')
  })

  it('should paginate when there are more than 100 docs', async () => {
    mockFetch
      .mockReset()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { document: { id: '1', url: '/doc/a', title: 'A', text: 'text a' } },
            { document: { id: '2', url: '/doc/b', title: 'B', text: 'text b' } },
          ],
          pagination: { total: 3 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { document: { id: '3', url: '/doc/c', title: 'C', text: 'text c' } },
          ],
          pagination: { total: 3 },
        }),
      })

    const docs = await fetchAllOutlineDocs()

    expect(docs).toHaveLength(3)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should skip documents with empty text', async () => {
    mockFetch
      .mockReset()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { document: { id: '1', url: '/doc/a', title: 'Has Content', text: 'Some text' } },
            { document: { id: '2', url: '/doc/b', title: 'Empty', text: '' } },
          ],
          pagination: { total: 2 },
        }),
      })
      // Second call returns empty (no more pages)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], pagination: { total: 2 } }),
      })

    const docs = await fetchAllOutlineDocs()

    expect(docs).toHaveLength(1)
    expect(docs[0].title).toBe('Has Content')
  })

  it('should throw on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    await expect(fetchAllOutlineDocs()).rejects.toThrow('Outline API error')
  })
})

describe('fetchApiType', () => {
  it('should throw Phase 2 message', async () => {
    await expect(fetchApiType('GameObject')).rejects.toThrow('Phase 2')
  })
})
