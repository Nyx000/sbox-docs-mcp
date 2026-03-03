import { describe, it, expect } from 'vitest'
import { SearchIndex } from '../lib/search-index.js'

describe('SearchIndex', () => {
  it('should instantiate without error', () => {
    const index = new SearchIndex()
    expect(index).toBeDefined()
  })

  it('should return empty results for any query', () => {
    const index = new SearchIndex()
    const results = index.search('test')
    expect(results).toEqual([])
  })

  it('should respect the limit parameter', () => {
    const index = new SearchIndex()
    const results = index.search('test', 5)
    expect(results.length).toBeLessThanOrEqual(5)
  })
})
