import type { AxiosResponse } from 'axios'
import { vi } from 'vitest'

import { axiosAdaptor } from '~/adaptors/axios'
import { createClient } from '~/core'
import { createLegacyApiClient, legacyResponseAdapter } from '~/legacy'

const { spyOn } = vi

const createTestClient = () =>
  createClient(axiosAdaptor)<AxiosResponse>('https://example.com', {
    responseAdapter: legacyResponseAdapter(),
  })

describe('legacy response adapter', () => {
  it('restores detail meta fields onto the entity', async () => {
    spyOn(axiosAdaptor, 'get').mockResolvedValue({
      data: {
        data: { id: '1', title: 'Code & Dopamine' },
        meta: {
          interaction: { is_liked: true, like_count: 2 },
          translation: {
            article: {
              is_translated: true,
              source_lang: 'zh',
              target_lang: 'en',
              translated_at: '2026-05-22T00:00:00.000Z',
              model: 'claude-haiku-4-5',
              available_translations: ['en', 'ko'],
            },
          },
          enrichments: {
            'https://example.com': { id: 'enrichment-1' },
          },
          related: [{ id: '2', title: 'related' }],
          insights: { has_in_locale: true },
        },
      },
      status: 200,
    } as any)

    const data = await createTestClient().proxy.posts('1').get()

    expect(data).toMatchObject({
      id: '1',
      title: 'Code & Dopamine',
      isLiked: true,
      likeCount: 2,
      isTranslated: true,
      sourceLang: 'zh',
      availableTranslations: ['en', 'ko'],
      translationMeta: {
        sourceLang: 'zh',
        targetLang: 'en',
        model: 'claude-haiku-4-5',
      },
      enrichments: {
        'https://example.com': { id: 'enrichment-1' },
      },
      related: [{ id: '2', title: 'related' }],
      hasInsightsInLocale: true,
    })
    expect((data as any).translationMeta).not.toHaveProperty('title')
    expect((data as any).translationMeta).not.toHaveProperty('text')
    expect((data as any).translationMeta).not.toHaveProperty('content')
    expect(data.$serialized).toMatchObject({
      id: '1',
      isLiked: true,
      isTranslated: true,
    })
    expect(data.$meta).toMatchObject({
      interaction: { isLiked: true, likeCount: 2 },
    })
  })

  it('restores list meta fields by item id', async () => {
    spyOn(axiosAdaptor, 'get').mockResolvedValue({
      data: {
        data: [
          { id: '1', title: 'Translated Title' },
          { id: '2', title: 'two' },
        ],
        meta: {
          pagination: { page: 2, size: 2, total: 6, total_pages: 3 },
          interaction: {
            '1': { is_liked: true },
            '2': { is_liked: false },
          },
          translation: {
            '1': {
              article: {
                is_translated: true,
                source_lang: 'zh',
                target_lang: 'en',
                model: 'claude-haiku-4-5',
                available_translations: ['en'],
              },
            },
          },
        },
      },
      status: 200,
    } as any)

    const data = await createTestClient().proxy.posts.get()

    expect(data).toMatchObject({
      data: [
        {
          id: '1',
          title: 'Translated Title',
          isLiked: true,
          isTranslated: true,
          sourceLang: 'zh',
          availableTranslations: ['en'],
          translationMeta: {
            sourceLang: 'zh',
            targetLang: 'en',
            model: 'claude-haiku-4-5',
          },
        },
        { id: '2', isLiked: false },
      ],
      pagination: {
        page: 2,
        currentPage: 2,
        size: 2,
        total: 6,
        totalPages: 3,
        totalPage: 3,
        hasNextPage: true,
        hasPrevPage: true,
      },
    })
    expect((data as any).data[0].translationMeta).not.toHaveProperty('title')
    expect((data as any).data[0].translationMeta).not.toHaveProperty('text')
    expect((data as any).data[0].translationMeta).not.toHaveProperty('content')
  })

  it('supports endpoint include and exclude matchers for gradual migration', async () => {
    spyOn(axiosAdaptor, 'get').mockResolvedValue({
      data: {
        data: { data: { title: 'wrapped' } },
      },
      status: 200,
    } as any)

    const client = createClient(axiosAdaptor)<AxiosResponse>(
      'https://example.com',
      {
        responseAdapter: legacyResponseAdapter({
          only: ['/legacy'],
          except: ['GET /legacy-disabled'],
        }),
      },
    )

    await expect(client.proxy.legacy.get()).resolves.toEqual({
      title: 'wrapped',
    })
    await expect(client.proxy.next.get()).resolves.toEqual({
      data: { title: 'wrapped' },
    })
    await expect(client.proxy('legacy-disabled').get()).resolves.toEqual({
      data: { title: 'wrapped' },
    })
  })

  it('strips body off aggregate/top items even when the envelope is passed through', async () => {
    spyOn(axiosAdaptor, 'get').mockResolvedValue({
      data: {
        data: {
          notes: [{ id: '1', title: 'Translated Note', text: 'body' }],
          posts: [{ id: '2', title: 'post', content: 'body' }],
          says: [{ id: '3', text: 'say' }],
          recently: [{ id: '4', content: 'recent' }],
        },
        meta: {
          translation: {
            '1': {
              article: {
                is_translated: true,
                source_lang: 'zh',
                target_lang: 'en',
                model: 'claude-haiku-4-5',
                available_translations: ['en'],
              },
            },
          },
        },
      },
      status: 200,
    } as any)

    const client = createClient(axiosAdaptor)<AxiosResponse>(
      'https://example.com',
      {
        responseAdapter: legacyResponseAdapter(),
        getDataFromResponse: (res: any) => res?.data,
      },
    )

    const data = await client.proxy.aggregate.top.get<any>()

    expect(data).toMatchObject({
      notes: [{ id: '1', title: 'Translated Note' }],
      posts: [{ id: '2', title: 'post' }],
      says: [{ id: '3', text: 'say' }],
      recently: [{ id: '4', content: 'recent' }],
    })
    expect(data.notes[0]).not.toHaveProperty('text')
    expect(data.posts[0]).not.toHaveProperty('content')
    expect(data.notes[0]).toMatchObject({
      isTranslated: true,
      sourceLang: 'zh',
      translationMeta: {
        sourceLang: 'zh',
        targetLang: 'en',
        model: 'claude-haiku-4-5',
      },
    })
    expect(data.notes[0].translationMeta).not.toHaveProperty('title')
  })

  it('creates a client with the legacy adapter preconfigured', async () => {
    spyOn(axiosAdaptor, 'get').mockResolvedValue({
      data: {
        data: { data: { title: 'wrapped' } },
      },
      status: 200,
    } as any)

    const client = createLegacyApiClient(axiosAdaptor)<AxiosResponse>(
      'https://example.com',
    )

    await expect(client.proxy.posts.latest.get()).resolves.toEqual({
      title: 'wrapped',
    })
  })

  it('flattens translation meta onto nested arrays in activity/rooms', async () => {
    spyOn(axiosAdaptor, 'get').mockResolvedValue({
      data: {
        data: {
          rooms: ['room-1'],
          roomCount: { 'room-1': 2 },
          objects: {
            post: [{ id: '10', title: 'Translated Post Title' }],
            note: [{ id: '20', title: 'Note Title' }],
          },
        },
        meta: {
          translation: {
            '10': {
              article: {
                is_translated: true,
                source_lang: 'zh',
                target_lang: 'en',
                model: 'claude-haiku-4-5',
                available_translations: ['en'],
              },
            },
          },
        },
      },
      status: 200,
    } as any)

    const client = createClient(axiosAdaptor)<AxiosResponse>(
      'https://example.com',
      {
        responseAdapter: legacyResponseAdapter(),
        getDataFromResponse: (res: any) => res?.data,
      },
    )

    const data = await client.proxy.activity.rooms.get<any>()

    expect(data.objects.post[0]).toMatchObject({
      id: '10',
      title: 'Translated Post Title',
      isTranslated: true,
      sourceLang: 'zh',
      translationMeta: {
        sourceLang: 'zh',
        targetLang: 'en',
        model: 'claude-haiku-4-5',
      },
    })
    expect(data.objects.post[0].translationMeta).not.toHaveProperty('title')
    expect(data.objects.note[0]).not.toHaveProperty('translationMeta')
    expect(data.objects.note[0]).not.toHaveProperty('isTranslated')
  })

  it('wraps bare list payloads into envelope shape when no pagination meta is present', async () => {
    spyOn(axiosAdaptor, 'get').mockResolvedValue({
      data: {
        data: [
          { id: '1', title: 'first' },
          { id: '2', title: 'second' },
        ],
      },
      status: 200,
    } as any)

    const client = createLegacyApiClient(axiosAdaptor)<AxiosResponse>(
      'https://example.com',
    )

    const data = await client.proxy.recently.get<any>()

    expect(data).toEqual({
      data: [
        { id: '1', title: 'first' },
        { id: '2', title: 'second' },
      ],
    })
  })

  it('rewraps aggregate/timeline payload into the envelope shape', async () => {
    spyOn(axiosAdaptor, 'get').mockResolvedValue({
      data: {
        data: {
          posts: [{ id: '1', title: 'Translated Post' }],
          notes: [{ id: '2', title: 'note' }],
        },
        meta: {
          translation: {
            '1': {
              article: {
                is_translated: true,
                source_lang: 'zh',
                target_lang: 'en',
                model: 'claude-haiku-4-5',
                available_translations: ['en'],
              },
            },
          },
        },
      },
      status: 200,
    } as any)

    const client = createLegacyApiClient(axiosAdaptor)<AxiosResponse>(
      'https://example.com',
    )

    const data = await client.proxy.aggregate.timeline.get<any>()

    expect(data).toMatchObject({
      data: {
        posts: [
          {
            id: '1',
            title: 'Translated Post',
            isTranslated: true,
            sourceLang: 'zh',
          },
        ],
        notes: [{ id: '2', title: 'note' }],
      },
    })
    expect(data.data.posts[0].translationMeta).toMatchObject({
      sourceLang: 'zh',
      targetLang: 'en',
      model: 'claude-haiku-4-5',
    })
  })

  it('rewraps aggregate/timeline even when envelope is passed through', async () => {
    spyOn(axiosAdaptor, 'get').mockResolvedValue({
      data: {
        data: {
          posts: [{ id: '1', title: 'post' }],
          notes: [{ id: '2', title: 'note' }],
        },
        meta: {},
      },
      status: 200,
    } as any)

    const client = createClient(axiosAdaptor)<AxiosResponse>(
      'https://example.com',
      {
        responseAdapter: legacyResponseAdapter(),
        getDataFromResponse: (res: any) => res?.data,
      },
    )

    const data = await client.proxy.aggregate.timeline.get<any>()

    expect(data).toMatchObject({
      data: {
        posts: [{ id: '1', title: 'post' }],
        notes: [{ id: '2', title: 'note' }],
      },
    })
  })

  it('synthesizes id from refId for reading rank/top items', async () => {
    spyOn(axiosAdaptor, 'get').mockResolvedValue({
      data: {
        data: {
          data: [
            { refId: '100', ref: { title: 'Translated Ref Title' }, count: 5 },
            { refId: '200', ref: { title: 'Other Ref' }, count: 3 },
          ],
        },
        meta: {
          translation: {
            '100': {
              article: {
                is_translated: true,
                source_lang: 'zh',
                target_lang: 'en',
                model: 'claude-haiku-4-5',
                available_translations: ['en'],
              },
            },
          },
        },
      },
      status: 200,
    } as any)

    const client = createClient(axiosAdaptor)<AxiosResponse>(
      'https://example.com',
      {
        responseAdapter: legacyResponseAdapter(),
        getDataFromResponse: (res: any) => res?.data,
      },
    )

    const data = await client.proxy.activity.reading.top.get<any>()

    expect(data.data[0]).toMatchObject({
      refId: '100',
      isTranslated: true,
      translationMeta: {
        sourceLang: 'zh',
        targetLang: 'en',
        model: 'claude-haiku-4-5',
      },
    })
    expect(data.data[0]).not.toHaveProperty('id')
    expect(data.data[1]).not.toHaveProperty('translationMeta')
    expect(data.data[1]).not.toHaveProperty('isTranslated')
  })
})
