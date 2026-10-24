import type { AgentToolSchema } from '@mx-space/ai'
import { serializeMxLexicalToLitexml } from '@mx-space/editor'
import { z } from 'zod'

export type ArticleType = 'post' | 'note' | 'page'

export interface ArticleSearchHit {
  type: ArticleType
  id: string
  title: string
  createdAt: string
  snippet: string
}

export interface ArticleBody {
  type: ArticleType
  id: string
  title: string
  createdAt: string
  contentFormat: string
  content: string | null
  text: string | null
}

export interface AgentArticleSource {
  search: (query: {
    keyword: string
    type?: ArticleType
    limit: number
  }) => Promise<ArticleSearchHit[]>
  load: (type: ArticleType, id: string) => Promise<ArticleBody | null>
}

export interface AgentServerToolContext {
  excludeRefId?: string
}

export interface AgentServerToolOutcome {
  content: string
  isError: boolean
}

export interface AgentServerTool {
  schema: AgentToolSchema
  execute: (
    args: unknown,
    context: AgentServerToolContext,
  ) => Promise<AgentServerToolOutcome>
}

const DEFAULT_SEARCH_LIMIT = 10
const MAX_SEARCH_LIMIT = 20
const DEFAULT_READ_LIMIT = 12_000

const articleType = z.enum(['post', 'note', 'page'])

const searchArgs = z.object({
  keyword: z.string().trim().min(1),
  type: articleType.optional(),
  limit: z.number().int().positive().optional(),
})

const readArgs = z.object({
  type: articleType,
  id: z.string().trim().min(1),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().positive().optional(),
})

export function createAgentServerTools(
  source: AgentArticleSource,
): AgentServerTool[] {
  return [
    {
      schema: {
        name: 'search_articles',
        description:
          "Search the author's published and draft articles (posts, notes, pages) by keyword. Returns ids to pass to read_article. The article currently being edited is excluded.",
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            keyword: { type: 'string', description: 'Search keywords' },
            type: {
              type: 'string',
              enum: ['post', 'note', 'page'],
              description: 'Limit to one article type',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: MAX_SEARCH_LIMIT,
              description: `Maximum hits, default ${DEFAULT_SEARCH_LIMIT}`,
            },
          },
          required: ['keyword'],
        },
      },
      execute: async (args, context) => {
        const parsed = searchArgs.safeParse(args)
        if (!parsed.success) return invalid(parsed.error)
        const limit = Math.min(
          parsed.data.limit ?? DEFAULT_SEARCH_LIMIT,
          MAX_SEARCH_LIMIT,
        )
        const hits = await source.search({
          keyword: parsed.data.keyword,
          type: parsed.data.type,
          limit: limit + 1,
        })
        const visible = hits
          .filter((hit) => hit.id !== context.excludeRefId)
          .slice(0, limit)
        if (!visible.length)
          return { content: 'No articles found.', isError: false }
        return {
          content: visible
            .map(
              (hit) =>
                `- type=${hit.type} id=${hit.id} date=${hit.createdAt.slice(0, 10)} title=${JSON.stringify(hit.title)}\n  ${hit.snippet}`,
            )
            .join('\n'),
          isError: false,
        }
      },
    },
    {
      schema: {
        name: 'read_article',
        description:
          'Read one article found by search_articles. Lexical articles come back as LiteXML (same format as /doc.xml), older ones as Markdown. Long bodies are paged by characters.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['post', 'note', 'page'] },
            id: { type: 'string' },
            offset: {
              type: 'integer',
              minimum: 0,
              description: 'Character offset into the body, default 0',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              description: `Characters to return, default ${DEFAULT_READ_LIMIT}`,
            },
          },
          required: ['type', 'id'],
        },
      },
      execute: async (args) => {
        const parsed = readArgs.safeParse(args)
        if (!parsed.success) return invalid(parsed.error)
        const { type, id } = parsed.data
        const article = await source.load(type, id)
        if (!article) {
          return { content: `No ${type} with id ${id}.`, isError: true }
        }
        const { format, body } = renderBody(article)
        const offset = parsed.data.offset ?? 0
        const limit = parsed.data.limit ?? DEFAULT_READ_LIMIT
        const slice = body.slice(offset, offset + limit)
        const end = offset + slice.length
        const header = [
          `title: ${article.title}`,
          `type: ${article.type}`,
          `id: ${article.id}`,
          `date: ${article.createdAt.slice(0, 10)}`,
          `format: ${format}`,
        ]
        if (offset > 0 || end < body.length) {
          header.push(
            `range: characters ${offset}-${end} of total ${body.length} characters${end < body.length ? `; continue with offset ${end}` : ''}`,
          )
        }
        return { content: `${header.join('\n')}\n\n${slice}`, isError: false }
      },
    },
  ]
}

function renderBody(article: ArticleBody): { format: string; body: string } {
  if (article.contentFormat === 'lexical' && article.content) {
    try {
      return {
        format: 'litexml',
        body: serializeMxLexicalToLitexml(JSON.parse(article.content), {
          compact: false,
        }),
      }
    } catch {
      return { format: 'text', body: article.text ?? '' }
    }
  }
  return { format: 'markdown', body: article.text ?? '' }
}

function invalid(error: z.ZodError): AgentServerToolOutcome {
  return {
    content: `Invalid arguments: ${error.issues.map((issue) => `${issue.path.join('.') || 'args'} ${issue.message}`).join('; ')}`,
    isError: true,
  }
}
