interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class Cache<T> {
  private store = new Map<string, CacheEntry<T>>()
  private readonly ttlMs: number
  private readonly maxEntries: number

  constructor(ttlMs = 14400000, maxEntries = 500) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }

    // Move to end for LRU ordering (most recently accessed = last)
    this.store.delete(key)
    this.store.set(key, entry)

    return entry.value
  }

  set(key: string, value: T): void {
    // Remove existing entry to refresh position
    this.store.delete(key)

    // Evict oldest entry (first in Map) if at capacity
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value!
      this.store.delete(oldestKey)
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    })
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }
}
