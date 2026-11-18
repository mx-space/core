import { z } from 'zod'

import type {
  AgentServerTool,
  AgentServerToolContext,
  AgentServerToolOutcome,
} from '../ai-agent-server-tools'
import type { WebToolBudget, WebToolProfile } from './web-tools.types'
import { WEB_TOOL_RUN_LIMIT } from './web-tools.types'

// DeepSeek Search & Fetch API: https://api-docs.deepseek.com/guides/search
const API_BASE = 'https://api.deepseek.com/v1/tools'
const SEARCH_TIMEOUT_MS = 15_000
const FETCH_TIMEOUT_MS = 30_000
const DEFAULT_SEARCH_COUNT = 5
const MAX_SEARCH_COUNT = 10
const PAGE_CHARS = 12_000

const searchArgs = z.object({
  query: z.string().trim().min(1).max(128),
  count: z.number().int().min(1).max(MAX_SEARCH_COUNT).optional(),
})

const fetchArgs = z.object({
  url: z
    .string()
    .trim()
    .url()
    .refine((value) => /^https?:\/\//i.test(value), 'must be http or https'),
  offset: z.number().int().min(0).optional(),
})

const searchResponse = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      summary: z.string(),
      site_name: z.string().nullish(),
      date: z.string().nullish(),
    }),
  ),
})

const fetchResponse = z.object({ title: z.string(), content: z.string() })

const errorResponse = z.object({
  error: z.object({ message: z.string() }),
})

type ApiResult<T> =
  { ok: true; data: T } | { ok: false; outcome: AgentServerToolOutcome }

function createTools(apiKey: string, budget: WebToolBudget): AgentServerTool[] {
  async function call<T>(
    op: 'search' | 'fetch',
    body: Record<string, unknown>,
    schema: z.ZodType<T>,
    context: AgentServerToolContext,
  ): Promise<ApiResult<T>> {
    if (!budget.take()) {
      return failure(
        `Web tool limit for this turn reached (${WEB_TOOL_RUN_LIMIT} calls). Answer with what you have.`,
      )
    }
    const timeout = AbortSignal.timeout(
      op === 'search' ? SEARCH_TIMEOUT_MS : FETCH_TIMEOUT_MS,
    )
    let response: Response
    try {
      response = await fetch(`${API_BASE}/${op}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: context.signal
          ? AbortSignal.any([context.signal, timeout])
          : timeout,
      })
    } catch (error) {
      if (timeout.aborted && !context.signal?.aborted) {
        return failure(`DeepSeek ${op} timed out.`)
      }
      throw error
    }
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok)
      return failure(describeHttpError(op, response.status, payload))
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      return failure(`DeepSeek ${op} returned an unexpected response.`)
    }
    return { ok: true, data: parsed.data }
  }

  return [
    {
      schema: {
        name: 'web_search',
        description:
          'Search the public web. Returns titles, URLs, dates and summaries; open a result with web_fetch when the summary is not enough. Supports site:, -site: and "quoted phrase" operators.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            query: {
              type: 'string',
              maxLength: 128,
              description: 'Search query, at most 128 characters',
            },
            count: {
              type: 'integer',
              minimum: 1,
              maximum: MAX_SEARCH_COUNT,
              description: `Number of results, default ${DEFAULT_SEARCH_COUNT}`,
            },
          },
          required: ['query'],
        },
      },
      execute: async (args, context) => {
        const parsed = searchArgs.safeParse(args)
        if (!parsed.success) return invalid(parsed.error)
        const result = await call(
          'search',
          {
            query: parsed.data.query,
            count: parsed.data.count ?? DEFAULT_SEARCH_COUNT,
          },
          searchResponse,
          context,
        )
        if (!result.ok) return result.outcome
        const { results } = result.data
        if (!results.length) return { content: 'No results.', isError: false }
        const body = results
          .map((hit, index) => {
            const meta = [
              hit.site_name ? `site: ${hit.site_name}` : '',
              hit.date ? `date: ${hit.date.slice(0, 10)}` : '',
            ]
              .filter(Boolean)
              .join(' · ')
            return [
              `${index + 1}. ${hit.title}`,
              `   url: ${hit.url}`,
              ...(meta ? [`   ${meta}`] : []),
              `   ${hit.summary}`,
            ].join('\n')
          })
          .join('\n\n')
        return { content: untrusted('web_search', body), isError: false }
      },
    },
    {
      schema: {
        name: 'web_fetch',
        description:
          'Read one web page as Markdown, e.g. a web_search result or a link the user gave. Long pages are paged by characters.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            url: { type: 'string', description: 'http(s) URL to read' },
            offset: {
              type: 'integer',
              minimum: 0,
              description: 'Character offset into the page, default 0',
            },
          },
          required: ['url'],
        },
      },
      execute: async (args, context) => {
        const parsed = fetchArgs.safeParse(args)
        if (!parsed.success) return invalid(parsed.error)
        const { url } = parsed.data
        const result = await call('fetch', { url }, fetchResponse, context)
        if (!result.ok) return result.outcome
        const { title, content } = result.data
        const offset = parsed.data.offset ?? 0
        const slice = content.slice(offset, offset + PAGE_CHARS)
        const end = offset + slice.length
        const header = [`title: ${title || '(none)'}`, `url: ${url}`]
        if (offset > 0 || end < content.length) {
          header.push(
            `range: characters ${offset}-${end} of total ${content.length} characters${end < content.length ? `; continue with offset ${end}` : ''}`,
          )
        }
        return {
          content: `${header.join('\n')}\n\n${untrusted('web_fetch', slice)}`,
          isError: false,
        }
      },
    },
  ]
}

function describeHttpError(
  op: string,
  status: number,
  payload: unknown,
): string {
  if (status === 402)
    return 'DeepSeek account balance is insufficient (HTTP 402).'
  if (status === 429)
    return `DeepSeek ${op} rate limit reached (HTTP 429); retry later.`
  if (op === 'fetch' && (status === 403 || status === 404)) {
    return `No readable content at this URL (HTTP ${status}).`
  }
  const parsed = errorResponse.safeParse(payload)
  return `DeepSeek ${op} failed (HTTP ${status})${parsed.success ? `: ${parsed.data.error.message}` : ''}.`
}

/** Fences web text as data; page content can never close the fence. */
function untrusted(source: string, text: string): string {
  const safe = text.replaceAll(
    /<\/untrusted_web_content/gi,
    '<\\/untrusted_web_content',
  )
  return `<untrusted_web_content source="${source}">\n${safe}\n</untrusted_web_content>`
}

function failure(content: string): {
  ok: false
  outcome: AgentServerToolOutcome
} {
  return { ok: false, outcome: { content, isError: true } }
}

function invalid(error: z.ZodError): AgentServerToolOutcome {
  return {
    content: `Invalid arguments: ${error.issues.map((issue) => `${issue.path.join('.') || 'args'} ${issue.message}`).join('; ')}`,
    isError: true,
  }
}

export function createDeepSeekProfile(apiKey: string): WebToolProfile {
  return {
    id: 'deepseek',
    kind: 'function',
    createTools: (budget) => createTools(apiKey, budget),
  }
}
