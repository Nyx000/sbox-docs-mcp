export const config = {
  cacheTtlMs: (parseInt(process.env.SBOX_DOCS_CACHE_TTL ?? '14400')) * 1000,
  maxCacheEntries: parseInt(process.env.SBOX_DOCS_MAX_CACHE_ENTRIES ?? '500'),
  requestTimeoutMs: parseInt(process.env.SBOX_DOCS_REQUEST_TIMEOUT ?? '10000'),
  userAgent: process.env.SBOX_DOCS_USER_AGENT ?? 'sbox-docs-mcp/0.2.0',
  docsBaseUrl: 'https://docs.facepunch.com',
  docsShareId: 'sbox-dev',
  docsApiUrl: 'https://docs.facepunch.com/api',
  maxCrawlPages: 150,
}
