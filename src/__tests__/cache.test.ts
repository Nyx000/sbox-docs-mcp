import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Cache } from '../lib/cache.js'

describe('Cache', () => {
  let cache: Cache<string>

  beforeEach(() => {
    cache = new Cache<string>(60000, 3)
  })

  it('should start empty', () => {
    expect(cache.size).toBe(0)
  })

  it('should return undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined()
  })

  it('should report missing keys as not present', () => {
    expect(cache.has('missing')).toBe(false)
  })

  it('should clear all entries', () => {
    cache.clear()
    expect(cache.size).toBe(0)
  })
})
