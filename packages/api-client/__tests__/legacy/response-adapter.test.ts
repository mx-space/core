import type { AxiosResponse } from 'axios'
import { vi } from 'vitest'

import { axiosAdaptor } from '~/adaptors/axios'
import { createClient } from '~/core'
import {
  createLegacyApiClient,
  legacyResponseAdapter,
} from '~/legacy'

const { spyOn } = vi

const createTestClient = () =>
  createClient(axiosAdaptor)<AxiosResponse>('https://example.com', {
    responseAdapter: legacyResponseAdapter(),
  })

describe('legacy response adapter', () => {
  it('restores detail meta fields onto the entity', async () => {
    spyOn(axiosAdaptor, 'get').mockResolvedValue({
      data: {
        data: { id: '1', title: 'hello' },
        meta: {
          interaction: { is_liked: true, like_count: 2 },
          translation: {
            article: { is_translated: true, source_lang: 'zh' },
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
      title: 'hello',
      isLiked: true,
      likeCount: 2,
      isTranslated: true,
      translationMeta: { isTranslated: true, sourceLang: 'zh' },
      enrichments: {
        'https://example.com': { id: 'enrichment-1' },
      },
      related: [{ id: '2', title: 'related' }],
      hasInsightsInLocale: true,
    })
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
          { id: '1', title: 'one' },
          { id: '2', title: 'two' },
        ],
        meta: {
          pagination: { page: 1, size: 2, total: 2, total_pages: 1 },
          interaction: {
            '1': { is_liked: true },
            '2': { is_liked: false },
          },
          translation: {
            '1': { article: { is_translated: true, title: 'translated' } },
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
          isLiked: true,
          isTranslated: true,
          translationMeta: { isTranslated: true, title: 'translated' },
        },
        { id: '2', isLiked: false },
      ],
      pagination: { page: 1, size: 2, total: 2, totalPages: 1 },
    })
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
})
