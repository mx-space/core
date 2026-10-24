import { describe, expect, it, vi } from 'vitest'

import {
  type AgentArticleSource,
  createAgentServerTools,
} from '~/modules/ai/ai-agent/ai-agent-server-tools'

const lexicalState = JSON.stringify({
  root: {
    type: 'root',
    version: 1,
    direction: null,
    format: '',
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        children: [
          {
            type: 'text',
            version: 1,
            text: 'hello from an old post',
            format: 0,
            style: '',
            mode: 'normal',
            detail: 0,
          },
        ],
      },
    ],
  },
})

function setup(overrides: Partial<AgentArticleSource> = {}) {
  const source: AgentArticleSource = {
    search: vi.fn(async () => [
      {
        type: 'post' as const,
        id: 'p1',
        title: 'Old post',
        createdAt: '2024-01-02T00:00:00.000Z',
        snippet: 'about rust',
      },
      {
        type: 'post' as const,
        id: 'current',
        title: 'This draft',
        createdAt: '2026-10-25T00:00:00.000Z',
        snippet: 'rust again',
      },
    ]),
    load: vi.fn(async (type, id) =>
      id === 'p1'
        ? {
            type,
            id,
            title: 'Old post',
            createdAt: '2024-01-02T00:00:00.000Z',
            contentFormat: 'lexical',
            content: lexicalState,
            text: 'hello from an old post',
          }
        : null,
    ),
    ...overrides,
  }
  const tools = createAgentServerTools(source)
  const byName = (name: string) => tools.find((t) => t.schema.name === name)!
  return { source, byName }
}

const context = { excludeRefId: 'current' }

describe('search_articles', () => {
  it('lists hits and leaves out the article being edited', async () => {
    const { byName } = setup()
    const result = await byName('search_articles').execute(
      { keyword: 'rust' },
      context,
    )

    expect(result.isError).toBe(false)
    expect(result.content).toContain('p1')
    expect(result.content).toContain('Old post')
    expect(result.content).not.toContain('This draft')
  })

  it('caps the limit at 20', async () => {
    const { byName, source } = setup()
    await byName('search_articles').execute(
      { keyword: 'rust', limit: 500 },
      context,
    )

    expect(source.search).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 21 }),
    )
  })

  it('rejects a missing keyword as a tool error', async () => {
    const { byName } = setup()
    const result = await byName('search_articles').execute({}, context)

    expect(result.isError).toBe(true)
  })
})

describe('read_article', () => {
  it('returns a lexical article as litexml', async () => {
    const { byName } = setup()
    const result = await byName('read_article').execute(
      { type: 'post', id: 'p1' },
      context,
    )

    expect(result.isError).toBe(false)
    expect(result.content).toContain('format: litexml')
    expect(result.content).toMatch(/<p[\s>]/)
    expect(result.content).toContain('hello from an old post')
  })

  it('returns a markdown article as markdown', async () => {
    const { byName } = setup({
      load: vi.fn(async (type, id) => ({
        type,
        id,
        title: 'Legacy',
        createdAt: '2019-01-01T00:00:00.000Z',
        contentFormat: 'markdown',
        content: null,
        text: '# Legacy\n\nbody',
      })),
    })
    const result = await byName('read_article').execute(
      { type: 'note', id: 'n1' },
      context,
    )

    expect(result.content).toContain('format: markdown')
    expect(result.content).toContain('# Legacy')
  })

  it('pages a long body by characters and says where to continue', async () => {
    const long = 'x'.repeat(30)
    const { byName } = setup({
      load: vi.fn(async (type, id) => ({
        type,
        id,
        title: 'Long',
        createdAt: '2020-01-01T00:00:00.000Z',
        contentFormat: 'markdown',
        content: null,
        text: long,
      })),
    })
    const result = await byName('read_article').execute(
      { type: 'post', id: 'p9', offset: 10, limit: 5 },
      context,
    )

    expect(result.content).toContain('xxxxx')
    expect(result.content).not.toContain('xxxxxx')
    expect(result.content).toContain('total 30 characters')
    expect(result.content).toContain('offset 15')
  })

  it('reports an unknown article as a tool error', async () => {
    const { byName } = setup()
    const result = await byName('read_article').execute(
      { type: 'post', id: 'missing' },
      context,
    )

    expect(result.isError).toBe(true)
  })
})
