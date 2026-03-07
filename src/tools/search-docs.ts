import type { SearchDocsParams } from '../schemas/index.js'
import { searchIndex } from '../lib/instances.js'

export async function searchDocs(params: SearchDocsParams): Promise<string> {
  const { query, limit } = params

  await searchIndex.ensureInitialized()

  const results = searchIndex.search(query, limit)

  if (results.length === 0) {
    return `No results found for "${query}". Try different search terms or browse pages directly with sbox_docs_get_page.`
  }

  const lines = results.map((r, i) =>
    `${i + 1}. **${r.title}** — ${r.url}\n   > ${r.snippet}`,
  )

  return `## Results for "${query}"\n\n${lines.join('\n\n')}`
}
