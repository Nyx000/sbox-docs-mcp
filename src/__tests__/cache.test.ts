import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Cache } from '../lib/cache.js'

describe('Cache', () => {
  let cache: Cache<string>

  beforeEach(() => {
    vi.useFakeTimers()
    cache = new Cache<string>(60000, 3)
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1')
    expect(cache.get('key1')).toBe('value1')
    expect(cache.size).toBe(1)
  })

  it('should report existing keys as present', () => {
    cache.set('key1', 'value1')
    expect(cache.has('key1')).toBe(true)
  })

  it('should overwrite existing keys', () => {
    cache.set('key1', 'value1')
    cache.set('key1', 'value2')
    expect(cache.get('key1')).toBe('value2')
    expect(cache.size).toBe(1)
  })

  it('should expire entries after TTL', () => {
    cache.set('key1', 'value1')
    expect(cache.get('key1')).toBe('value1')

    vi.advanceTimersByTime(60001)

    expect(cache.get('key1')).toBeUndefined()
    expect(cache.has('key1')).toBe(false)
  })

  it('should not expire entries before TTL', () => {
    cache.set('key1', 'value1')
    vi.advanceTimersByTime(59999)
    expect(cache.get('key1')).toBe('value1')
  })

  it('should evict oldest entry when at max capacity (LRU)', () => {
    cache.set('a', '1')
    cache.set('b', '2')
    cache.set('c', '3')
    // Cache is full (maxEntries=3), adding a 4th should evict 'a'
    cache.set('d', '4')

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe('2')
    expect(cache.get('c')).toBe('3')
    expect(cache.get('d')).toBe('4')
    expect(cache.size).toBe(3)
  })

  it('should update LRU order on access', () => {
    cache.set('a', '1')
    cache.set('b', '2')
    cache.set('c', '3')

    // Access 'a' to move it to the end (most recently used)
    cache.get('a')

    // Now 'b' is the oldest, so adding 'd' should evict 'b'
    cache.set('d', '4')

    expect(cache.get('a')).toBe('1')
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe('3')
    expect(cache.get('d')).toBe('4')
  })

  it('should clear all entries', () => {
    cache.set('a', '1')
    cache.set('b', '2')
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get('a')).toBeUndefined()
  })

  it('should clean up expired entries on size check', () => {
    cache.set('a', '1')
    vi.advanceTimersByTime(60001)
    // The expired entry is still in the Map but get() will remove it
    cache.get('a')
    expect(cache.size).toBe(0)
  })
})
