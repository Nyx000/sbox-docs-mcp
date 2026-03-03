import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPage, crawlPage, fetchApiType } from '../lib/fetcher.js'

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

describe('fetchApiType', () => {
  it('should throw Phase 2 message', async () => {
    await expect(fetchApiType('GameObject')).rejects.toThrow('Phase 2')
  })
})
