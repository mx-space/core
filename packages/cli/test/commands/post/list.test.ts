import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OutputOptions } from '../../../src/core/output'

const mocks = vi.hoisted(() => ({
  buildApiClient: vi.fn(),
  request: vi.fn(),
  resolveContext: vi.fn(),
}))

vi.mock('../../../src/commands/internal/shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/commands/internal/shared')>()
  return {
    ...actual,
    buildApiClient: mocks.buildApiClient,
    resolveContext: mocks.resolveContext,
  }
})

const { run } = await import('../../../src/commands/post/list')

const out: OutputOptions = {
  json: false,
  output: 'llm',
  quiet: true,
  verbose: false,
}

describe('post list command', () => {
  let writes: string[]
  let writeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    writes = []
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        writes.push(String(chunk))
        return true
      })
    mocks.resolveContext.mockResolvedValue({
      apiUrl: 'https://blog.example.com',
      apiBase: 'https://blog.example.com/api/v2',
      authBase: 'https://blog.example.com/api/v2/auth',
      apiVersion: 2,
      clientId: 'mxs-cli',
      token: 'access-token',
      configPath: '/tmp/config.json',
      credentialsPath: '/tmp/credentials.json',
    })
    mocks.buildApiClient.mockReturnValue({ request: mocks.request })
    mocks.request.mockReset()
  })

  afterEach(() => {
    writeSpy.mockRestore()
    vi.clearAllMocks()
  })

  it('requests translated data and renders llm list output', async () => {
    mocks.request.mockResolvedValue({
      data: {
        data: [
          {
            id: '1',
            title: 'Japanese Title',
            slug: 'jp-title',
            isPublished: true,
            isTranslated: true,
            sourceLang: 'zh-CN',
            category: { name: 'Tech' },
            tags: ['cli'],
          },
        ],
        pagination: { page: 2, size: 5, total: 11 },
      },
    })

    await run(
      { page: 2, size: 5, state: 'publish', sort: 'created' },
      { lang: 'ja' },
      out,
    )

    expect(mocks.request).toHaveBeenCalledWith('/posts', {
      query: {
        page: 2,
        size: 5,
        state: 'publish',
        sortBy: 'created',
        lang: 'ja',
      },
    })
    const output = writes.join('')
    expect(output).toContain('posts')
    expect(output).toContain('page: 2')
    expect(output).toContain('title: Japanese Title')
    expect(output).toContain('translated: true')
  })
})
