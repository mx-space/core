import { createE2EApp } from 'test/helper/create-e2e-app'
import { authPassHeader } from 'test/mock/guard/auth.guard'
import { describe, expect, it, vi } from 'vitest'

import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { EnrichmentService } from '~/modules/enrichment/enrichment.service'
import { PostController } from '~/modules/post/post.controller'
import { PostService } from '~/modules/post/post.service'
import { SnippetService } from '~/modules/snippet/snippet.service'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { TranslationService } from '~/processors/helper/helper.translation.service'

const SERVER_URL = 'http://localhost:2333/api/v3'
const PUBLIC_SKILL_RAW_URL = `${SERVER_URL}/s/sk/public-skill/SKILL.md`
const PRIVATE_SKILL_RAW_URL = `${SERVER_URL}/s/sk/private-skill/SKILL.md`

const publicSkill = {
  id: 'pub-1',
  name: 'public-skill',
  description: 'A public skill',
  rawUrl: PUBLIC_SKILL_RAW_URL,
  assets: [],
}

const privateSkill = {
  id: 'priv-2',
  name: 'private-skill',
  description: 'A private skill',
  rawUrl: PRIVATE_SKILL_RAW_URL,
  assets: [],
}

let currentPost: Record<string, unknown> | null = null
let skillsOverride:
  | ((ids: string[], opts: { includePrivate?: boolean }) => Promise<unknown[]>)
  | null = null

const postService = {
  findById: vi.fn(async () => currentPost),
  getPostBySlug: vi.fn(async () => currentPost),
  listPaginated: vi.fn(async () => ({ data: [], pagination: {} })),
}

const snippetService = {
  findSkillBundlesByIds: vi.fn(
    async (ids: string[], opts: { includePrivate?: boolean } = {}) => {
      if (skillsOverride) return skillsOverride(ids, opts)
      const all = opts.includePrivate
        ? [publicSkill, privateSkill]
        : [publicSkill]
      return all.filter((s) => ids.includes(s.id))
    },
  ),
}

const proxy = createE2EApp({
  controllers: [PostController],
  providers: [
    { provide: PostService, useValue: postService },
    {
      provide: CountingService,
      useValue: { getThisRecordIsLiked: vi.fn(async () => false) },
    },
    {
      provide: TranslationService,
      useValue: {
        translateArticle: vi.fn(async () => ({
          isTranslated: false,
          title: '',
          text: '',
          summary: null,
          tags: [],
          sourceLang: 'zh',
          availableTranslations: [],
        })),
        getCachedTitles: vi.fn(async () => new Map()),
      },
    },
    {
      provide: AiInsightsService,
      useValue: { hasInsightsInLang: vi.fn(async () => false) },
    },
    {
      provide: AiSummaryService,
      useValue: { getSummaryForPublicMeta: vi.fn(async () => null) },
    },
    {
      provide: EnrichmentService,
      useValue: {
        attachEnrichments: vi.fn(async (doc: Record<string, unknown>) => ({
          enrichments: {},
          ...doc,
        })),
      },
    },
    {
      provide: TranslationEntryService,
      useValue: {
        getTranslationsBatch: vi.fn(async () => ({
          entityMaps: new Map(),
          dictMaps: new Map(),
        })),
      },
    },
    { provide: SnippetService, useValue: snippetService },
  ],
})

const makePost = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000060',
  title: 'Test Post',
  text: 'body',
  content: null,
  contentFormat: 'markdown',
  summary: null,
  tags: [],
  meta: null,
  modifiedAt: null,
  createdAt: new Date('2024-01-01'),
  category: { id: '9000000000000000001', name: 'Tech', slug: 'tech', type: 1 },
  isPublished: true,
  related: [],
  ...overrides,
})

describe('PostController — skill attachment (getByCateAndSlug)', () => {
  const CATEGORY = 'tech'
  const SLUG = 'test-post'

  describe('post with two skillIds (public + private)', () => {
    beforeEach(() => {
      currentPost = makePost({
        slug: SLUG,
        meta: { skillIds: ['pub-1', 'priv-2'] },
      })
      skillsOverride = null
    })

    it('anonymous: meta.skills contains only public skill', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${CATEGORY}/${SLUG}`,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data.skills).toBeUndefined()
      expect(body.meta.skills).toHaveLength(1)
      expect(body.meta.skills[0].id).toBe('pub-1')
    })

    it('admin: meta.skills contains both skills in input order [pub-1, priv-2]', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${CATEGORY}/${SLUG}`,
        headers: authPassHeader,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data.skills).toBeUndefined()
      expect(body.meta.skills).toHaveLength(2)
      expect(body.meta.skills[0].id).toBe('pub-1')
      expect(body.meta.skills[1].id).toBe('priv-2')
    })

    it('public skill raw_url matches expected URL', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${CATEGORY}/${SLUG}`,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.meta.skills[0].raw_url).toBe(PUBLIC_SKILL_RAW_URL)
    })
  })

  describe('post with no meta.skillIds', () => {
    beforeEach(() => {
      currentPost = makePost({ slug: SLUG, meta: null })
      skillsOverride = null
    })

    it('returns 200 with no skills field on data or meta', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${CATEGORY}/${SLUG}`,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data.skills).toBeUndefined()
      expect(body.meta?.skills).toBeUndefined()
    })
  })

  describe('meta.skillIds case transform bypass', () => {
    beforeEach(() => {
      currentPost = makePost({
        slug: SLUG,
        meta: { skillIds: ['pub-1', 'priv-2'] },
      })
      skillsOverride = null
    })

    it('meta.skillIds preserved as camelCase (not skill_ids) on wire', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${CATEGORY}/${SLUG}`,
        headers: authPassHeader,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data.meta.skillIds).toEqual(['pub-1', 'priv-2'])
      expect(body.data.meta.skill_ids).toBeUndefined()
    })
  })
})

describe('PostController — skill attachment (getById)', () => {
  describe('post with two skillIds (public + private)', () => {
    beforeEach(() => {
      currentPost = makePost({ meta: { skillIds: ['pub-1', 'priv-2'] } })
      skillsOverride = null
    })

    it('anonymous: meta.skills contains only public skill', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${(currentPost as any).id}`,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data.skills).toBeUndefined()
      expect(body.meta.skills).toHaveLength(1)
      expect(body.meta.skills[0].id).toBe('pub-1')
    })

    it('admin: meta.skills contains both skills in input order [pub-1, priv-2]', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${(currentPost as any).id}`,
        headers: authPassHeader,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data.skills).toBeUndefined()
      expect(body.meta.skills).toHaveLength(2)
      expect(body.meta.skills[0].id).toBe('pub-1')
      expect(body.meta.skills[1].id).toBe('priv-2')
    })

    it('public skill raw_url matches expected URL', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${(currentPost as any).id}`,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.meta.skills[0].raw_url).toBe(PUBLIC_SKILL_RAW_URL)
    })
  })

  describe('post with nonexistent skillIds', () => {
    beforeEach(() => {
      currentPost = makePost({ meta: { skillIds: ['nonexistent-id'] } })
      skillsOverride = async () => []
    })

    it('returns 200 with no skills field on data or meta', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${(currentPost as any).id}`,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data.skills).toBeUndefined()
      expect(body.meta?.skills).toBeUndefined()
    })
  })

  describe('post with no meta.skillIds', () => {
    beforeEach(() => {
      currentPost = makePost({ meta: null })
      skillsOverride = null
    })

    it('returns 200 with no skills field on data or meta', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${(currentPost as any).id}`,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data.skills).toBeUndefined()
      expect(body.meta?.skills).toBeUndefined()
    })
  })

  describe('meta.skillIds case transform bypass', () => {
    beforeEach(() => {
      currentPost = makePost({ meta: { skillIds: ['pub-1', 'priv-2'] } })
      skillsOverride = null
    })

    it('meta.skillIds preserved as camelCase (not skill_ids) on wire', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `/posts/${(currentPost as any).id}`,
        headers: authPassHeader,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data.meta.skillIds).toEqual(['pub-1', 'priv-2'])
      expect(body.data.meta.skill_ids).toBeUndefined()
    })
  })
})
