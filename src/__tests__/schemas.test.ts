import { describe, it, expect } from 'vitest'
import { SearchDocsInput, GetPageInput, GetApiTypeInput } from '../schemas/index.js'

describe('SearchDocsInput', () => {
  it('should accept valid search params', () => {
    const result = SearchDocsInput.safeParse({ query: 'component' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.query).toBe('component')
      expect(result.data.limit).toBe(10)
    }
  })

  it('should reject empty query', () => {
    const result = SearchDocsInput.safeParse({ query: '' })
    expect(result.success).toBe(false)
  })

  it('should apply default limit', () => {
    const result = SearchDocsInput.safeParse({ query: 'test' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(10)
    }
  })

  it('should reject limit above 25', () => {
    const result = SearchDocsInput.safeParse({ query: 'test', limit: 50 })
    expect(result.success).toBe(false)
  })

  it('should accept custom limit within range', () => {
    const result = SearchDocsInput.safeParse({ query: 'test', limit: 5 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(5)
    }
  })
})

describe('GetPageInput', () => {
  it('should accept valid docs.facepunch.com URL', () => {
    const result = GetPageInput.safeParse({
      url: 'https://docs.facepunch.com/s/sbox-dev/doc/first-steps-7IyiSplYmn',
    })
    expect(result.success).toBe(true)
  })

  it('should accept valid wiki.facepunch.com URL', () => {
    const result = GetPageInput.safeParse({
      url: 'https://wiki.facepunch.com/sbox/Coding-FileStructure',
    })
    expect(result.success).toBe(true)
  })

  it('should reject non-facepunch URLs', () => {
    const result = GetPageInput.safeParse({
      url: 'https://example.com/page',
    })
    expect(result.success).toBe(false)
  })

  it('should apply default start_index and max_length', () => {
    const result = GetPageInput.safeParse({
      url: 'https://docs.facepunch.com/s/sbox-dev/doc/test-abc123',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.start_index).toBe(0)
      expect(result.data.max_length).toBe(5000)
    }
  })

  it('should reject max_length below 100', () => {
    const result = GetPageInput.safeParse({
      url: 'https://docs.facepunch.com/s/sbox-dev/doc/test-abc123',
      max_length: 10,
    })
    expect(result.success).toBe(false)
  })

  it('should reject max_length above 20000', () => {
    const result = GetPageInput.safeParse({
      url: 'https://docs.facepunch.com/s/sbox-dev/doc/test-abc123',
      max_length: 50000,
    })
    expect(result.success).toBe(false)
  })
})

describe('GetApiTypeInput', () => {
  it('should accept valid type name', () => {
    const result = GetApiTypeInput.safeParse({ type_name: 'GameObject' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type_name).toBe('GameObject')
      expect(result.data.include_methods).toBe(true)
      expect(result.data.include_properties).toBe(true)
    }
  })

  it('should reject empty type name', () => {
    const result = GetApiTypeInput.safeParse({ type_name: '' })
    expect(result.success).toBe(false)
  })

  it('should allow disabling methods', () => {
    const result = GetApiTypeInput.safeParse({
      type_name: 'Component',
      include_methods: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.include_methods).toBe(false)
      expect(result.data.include_properties).toBe(true)
    }
  })

  it('should allow disabling properties', () => {
    const result = GetApiTypeInput.safeParse({
      type_name: 'Component',
      include_properties: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.include_properties).toBe(false)
    }
  })
})
