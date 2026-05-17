import { describe, expect, it, vi } from 'vitest'

import { AggregateController } from '~/modules/aggregate/aggregate.controller'

const createController = (overrides: {
  configsService?: Record<string, unknown>
  noteService?: Record<string, unknown>
  ownerService?: Record<string, unknown>
  snippetService?: Record<string, unknown>
} = {}) =>
  new AggregateController(
    {} as any,
    {
      get: vi.fn(async (key: string) => {
        if (key === 'url') return { webUrl: 'https://x.test', adminUrl: 'admin' }
        if (key === 'seo') return { title: 'site', description: 'd' }
        if (key === 'commentOptions')
          return { disableComment: false, allowGuestComment: true }
        if (key === 'ai') return { enableSummary: true }
        return {}
      }),
      ...overrides.configsService,
    } as any,
    {} as any,
    {
      getLatestNoteId: vi.fn(async () => 17),
      ...overrides.noteService,
    } as any,
    {
      getCachedSnippet: vi.fn(async () => null),
      getPublicSnippetByName: vi.fn(async () => null),
      ...overrides.snippetService,
    } as any,
    {
      getOwner: vi.fn(async () => ({
        id: '1',
        name: 'Owner',
        socialIds: {},
      })),
      ...overrides.ownerService,
    } as any,
    {} as any,
  )

describe('AggregateController', () => {
  it('does not downgrade root aggregate dependency failures into cacheable partial responses', async () => {
    const controller = createController({
      configsService: {
        get: vi.fn(async (key: string) => {
          if (key === 'url') throw new Error('url config unavailable')
          return {}
        }),
      },
    })

    await expect(controller.aggregate({} as any)).rejects.toThrow(
      'url config unavailable',
    )
  })
})
