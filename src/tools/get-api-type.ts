import type { GetApiTypeParams } from '../schemas/index.js'
import { fetchApiType } from '../lib/fetcher.js'

export async function getApiType(params: GetApiTypeParams): Promise<string> {
  // Delegates to fetcher which throws a clear Phase 2 message
  const result = await fetchApiType(params.type_name)
  return `# ${result.title}\n\n${result.markdown}`
}
