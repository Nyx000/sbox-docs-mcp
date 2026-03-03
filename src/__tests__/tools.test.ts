import { describe, it, expect } from 'vitest'
import { searchDocs } from '../tools/search-docs.js'
import { getPage } from '../tools/get-page.js'
import { getApiType } from '../tools/get-api-type.js'

describe('searchDocs', () => {
  it('should throw "Not implemented"', async () => {
    await expect(
      searchDocs({ query: 'test', limit: 10 }),
    ).rejects.toThrow('Not implemented')
  })
})

describe('getPage', () => {
  it('should throw "Not implemented"', async () => {
    await expect(
      getPage({
        url: 'https://docs.facepunch.com/s/sbox-dev/doc/test-abc',
        start_index: 0,
        max_length: 5000,
      }),
    ).rejects.toThrow('Not implemented')
  })
})

describe('getApiType', () => {
  it('should throw "Not implemented"', async () => {
    await expect(
      getApiType({
        type_name: 'GameObject',
        include_methods: true,
        include_properties: true,
      }),
    ).rejects.toThrow('Not implemented')
  })
})
