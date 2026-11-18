import { z } from 'zod'

import type {
  OpenRouterObserver,
  WebToolActivity,
  WebToolProfile,
  WebToolSource,
} from './web-tools.types'

// OpenRouter server tools: https://openrouter.ai/docs/guides/features/server-tools/web-search
const PROVIDER_TOOLS: Record<string, unknown>[] = [
  {
    type: 'openrouter:web_search',
    parameters: { max_uses: 5, max_results: 5 },
  },
  { type: 'openrouter:web_fetch' },
]

// Chat Completions streams carry no per-search frames: only `url_citation`
// annotations ahead of the answer, plus executed counts in the final usage.
const chunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.string().nullish(),
            reasoning: z.string().nullish(),
            annotations: z
              .array(
                z.object({
                  type: z.string(),
                  url_citation: z
                    .object({ url: z.string(), title: z.string().nullish() })
                    .optional(),
                }),
              )
              .nullish(),
          })
          .optional(),
      }),
    )
    .optional(),
  usage: z
    .object({
      server_tool_use_details: z
        .object({ tool_calls_executed: z.number() })
        .optional(),
    })
    .nullish(),
})

function createObserver(): OpenRouterObserver {
  let pending = new Map<string, WebToolSource>()
  let executed = 0

  const flush = (): WebToolActivity[] => {
    if (!pending.size) return []
    const sources = [...pending.values()]
    pending = new Map()
    return [{ kind: 'web_search', sources }]
  }

  return {
    get executed() {
      return executed
    },
    flush,
    push(chunk) {
      const parsed = chunkSchema.safeParse(chunk)
      if (!parsed.success) return []
      const executedNow =
        parsed.data.usage?.server_tool_use_details?.tool_calls_executed
      if (executedNow !== undefined) executed = executedNow
      const delta = parsed.data.choices?.[0]?.delta
      if (!delta) return []
      for (const annotation of delta.annotations ?? []) {
        const citation = annotation.url_citation
        if (annotation.type !== 'url_citation' || !citation) continue
        if (pending.has(citation.url)) continue
        pending.set(citation.url, {
          url: citation.url,
          ...(citation.title ? { title: citation.title } : {}),
        })
      }
      return delta.content || delta.reasoning ? flush() : []
    },
  }
}

export const openRouterProfile: WebToolProfile = {
  id: 'openrouter',
  kind: 'inject',
  providerTools: PROVIDER_TOOLS,
  createObserver,
}
