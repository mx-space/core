export type WebSearchVendor = 'openrouter' | 'deepseek'

const VENDOR_BY_HOST: Record<string, WebSearchVendor> = {
  'openrouter.ai': 'openrouter',
  'api.deepseek.com': 'deepseek',
}

/**
 * The built-in web search a provider can serve as the agent's search
 * provider, decided by its endpoint host. OpenRouter search rides on its
 * OpenAI-compatible Chat Completions requests, so other protocols get none.
 */
export function resolveWebSearchVendor(provider: {
  type: string
  endpoint?: string | null
}): WebSearchVendor | undefined {
  if (!provider.endpoint?.trim()) return undefined
  let hostname: string
  try {
    hostname = new URL(provider.endpoint).hostname.toLowerCase()
  } catch {
    return undefined
  }
  const vendor = VENDOR_BY_HOST[hostname]
  if (vendor === 'openrouter' && provider.type !== 'openai-compatible') {
    return undefined
  }
  return vendor
}
