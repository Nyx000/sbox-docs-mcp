import type { GetPageParams } from '../schemas/index.js'
import { fetchPage } from '../lib/fetcher.js'
import { pageCache } from '../lib/instances.js'

export async function getPage(params: GetPageParams): Promise<string> {
  const { url, start_index, max_length } = params

  // Check cache first
  let result = pageCache.get(url)

  if (!result) {
    result = await fetchPage(url)
    pageCache.set(url, result)
  }

  const totalLength = result.markdown.length
  const chunk = result.markdown.slice(start_index, start_index + max_length)
  const endIndex = start_index + chunk.length
  const hasMore = endIndex < totalLength

  let output = `# ${result.title}\n\n${chunk}`

  if (hasMore) {
    output += `\n\n---\n_Showing characters ${start_index}–${endIndex} of ${totalLength}. Use start_index=${endIndex} for next chunk._`
  } else if (start_index > 0) {
    output += `\n\n---\n_End of page (${totalLength} total characters)._`
  }

  return output
}
