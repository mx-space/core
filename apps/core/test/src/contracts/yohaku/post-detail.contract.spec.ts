/**
 * Yohaku consumer contract: post detail.
 *
 * Mirrors the field set Yohaku reads from `apiClient.post.getPost(category, slug)`
 * (see /Users/innei/git/innei-repo/Yohaku/apps/web/src/app/[locale]/posts/(post-detail)).
 *
 * Required keys reflect what the frontend dereferences in:
 *   - `pageExtra.tsx`        — `data.created`, `data.modified`, `data.tags`,
 *                              `data.category`, `data.summary`, `data.related`,
 *                              `data.meta?.banner`, `data.images`,
 *                              `data.contentFormat`, `data.translationMeta`,
 *                              `data.allowComment`
 *   - `PostMetaBar.tsx`      — `meta.count.{read,like}` (legacy)
 *
 * Server now emits PG-shape (`created_at`, `modified_at`, `read_count`,
 * `like_count`). Yohaku v3.8.0 still reads legacy names. Yohaku-side stale
 * reads are reported separately; this spec asserts the SERVER's PG-shape
 * surface is complete (Yohaku migration must port to these names).
 */
import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { PostController } from '~/modules/post/post.controller'
import { PostService } from '~/modules/post/post.service'

import {
  assertHasKeys,
  assertHasKeysDeep,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { countingServiceProvider } from '../../../mock/processors/counting.mock'
import { translationProvider } from '../../../mock/processors/translation.mock'

const fixturePost = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000050',
  title: 'Yohaku Post',
  slug: 'yohaku-post',
  text: '# body',
  content: null,
  contentFormat: 'markdown',
  summary: 'short summary',
  tags: ['ts', 'pg'],
  meta: { cover: 'https://x.test/c.png', banner: null, keywords: ['k1'] },
  isPublished: true,
  copyright: true,
  pinAt: null,
  pinOrder: null,
  readCount: 12,
  likeCount: 3,
  images: [{ src: 'https://x.test/i.png', accent: '#fff' }],
  category: {
    id: '7000000000000000900',
    slug: 'tech',
    name: 'Tech',
    type: 0,
  },
  categoryId: '7000000000000000900',
  related: [
    {
      id: '7000000000000000051',
      title: 'Related One',
      slug: 'related-one',
      summary: null,
      categoryId: '7000000000000000900',
      category: {
        id: '7000000000000000900',
        slug: 'tech',
        name: 'Tech',
        type: 0,
      },
      createdAt: new Date('2024-01-03T00:00:00.000Z'),
      modifiedAt: null,
    },
  ],
  createdAt: new Date('2024-01-02T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const postServiceProvider = {
  provide: PostService,
  useValue: {
    async getPostBySlug(_category: string, slug: string) {
      return fixturePost({ slug })
    },
    async findById(id: string) {
      return fixturePost({ id })
    },
    async findRecent() {
      return [fixturePost()]
    },
    async findBySlug(slug: string) {
      return fixturePost({ slug })
    },
  },
}

const aiInsightsProvider = {
  provide: AiInsightsService,
  useValue: {
    async hasInsightsInLang() {
      return true
    },
  },
}

describe('Yohaku contract — post detail (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [PostController],
    providers: [
      postServiceProvider,
      countingServiceProvider,
      translationProvider,
      aiInsightsProvider,
    ],
  })

  test('GET /posts/:category/:slug — exposes every field Yohaku reads', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/posts/tech/yohaku-post`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    assertNoLegacyKeys(body)
    assertPgTimestamps(body)

    // Top-level required by Yohaku post-detail page.
    assertHasKeys(body, [
      'id',
      'title',
      'slug',
      'text',
      'content_format',
      'summary',
      'tags',
      'meta',
      'images',
      'category',
      'category_id',
      'related',
      'read_count',
      'like_count',
      'created_at',
      'modified_at',
      'is_translated',
      'has_insights_in_locale',
    ])

    // Deep paths Yohaku dereferences without optional chaining or with
    // direct destructuring.
    assertHasKeysDeep(body, [
      'category.slug',
      'category.name',
      'related.0.title',
      'related.0.slug',
      'related.0.category.slug',
    ])
  })
})
