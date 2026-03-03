import { Cache } from './cache.js'
import { SearchIndex } from './search-index.js'
import { config } from './config.js'
import type { FetchResult } from './fetcher.js'

export const pageCache = new Cache<FetchResult>(config.cacheTtlMs, config.maxCacheEntries)
export const searchIndex = new SearchIndex(pageCache)
