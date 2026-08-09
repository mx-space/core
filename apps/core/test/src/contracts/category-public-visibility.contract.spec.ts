import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { CategoryController } from '~/modules/category/category.controller'
import { CategoryService } from '~/modules/category/category.service'

import { createE2EApp } from '../../helper/create-e2e-app'
import {
  translationEntryProvider,
  translationProvider,
} from '../../mock/processors/translation.mock'

const CATEGORY_ID = '7000000000000000900'

const fixtureCategory = {
  id: CATEGORY_ID,
  name: 'Tech',
  slug: 'tech',
  type: 0,
  createdAt: new Date('2023-12-01T00:00:00.000Z'),
  modifiedAt: null,
}

const publicPost = {
  id: '7000000000000000910',
  title: 'Public post',
  slug: 'public-post',
  summary: 'Public summary',
  images: ['https://example.com/public.png'],
  tags: ['shared-tag', 'public-tag'],
  isPublished: true,
  copyright: true,
  pinAt: null,
  readCount: 1,
  likeCount: 0,
  category: fixtureCategory,
  categoryId: CATEGORY_ID,
  createdAt: new Date('2024-01-15T00:00:00.000Z'),
  modifiedAt: null,
}

const privateMetadata = {
  id: '7000000000000000999',
  title: 'PRIVATE_TITLE_SENTINEL',
  slug: 'private-slug-sentinel',
  summary: 'PRIVATE_SUMMARY_SENTINEL',
  image: 'https://example.com/private-image-sentinel.png',
  tag: 'private-tag-sentinel',
} as const

const privatePost = {
  id: privateMetadata.id,
  title: privateMetadata.title,
  slug: privateMetadata.slug,
  summary: privateMetadata.summary,
  images: [privateMetadata.image],
  tags: ['shared-tag', privateMetadata.tag],
  isPublished: false,
  copyright: true,
  pinAt: null,
  readCount: 0,
  likeCount: 0,
  category: fixtureCategory,
  categoryId: CATEGORY_ID,
  createdAt: new Date('2024-01-16T00:00:00.000Z'),
  modifiedAt: null,
}

const allPosts = [publicPost, privatePost]

const filterPublished = (publishedOnly?: boolean) =>
  publishedOnly ? allPosts.filter((post) => post.isPublished) : allPosts

const filterPublicationState = (isPublished?: boolean) =>
  isPublished === undefined
    ? allPosts
    : allPosts.filter((post) => post.isPublished === isPublished)

const aggregateTags = (posts: typeof allPosts) => {
  const counts = new Map<string, number>()
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count }))
}

const categoryServiceProvider = {
  provide: CategoryService,
  useValue: {
    repository: {
      async findByIds(_ids: string[], options: { publishedOnly?: boolean }) {
        return [
          {
            ...fixtureCategory,
            count: filterPublished(options?.publishedOnly).length,
          },
        ]
      },
    },
    async findAllCategory(options: { publishedOnly?: boolean }) {
      return [
        {
          ...fixtureCategory,
          count: filterPublished(options?.publishedOnly).length,
        },
      ]
    },
    async findById(id: string) {
      return { ...fixtureCategory, id }
    },
    async findBySlug(slug: string) {
      return { ...fixtureCategory, slug }
    },
    async findCategoryPost(
      _categoryId: string,
      condition: { isPublished?: boolean },
    ) {
      return filterPublicationState(condition?.isPublished)
    },
    async getCategoryTagsSum(
      _categoryId: string,
      options: { publishedOnly?: boolean },
    ) {
      return aggregateTags(filterPublished(options?.publishedOnly))
    },
    async getPostTagsSum(options: { publishedOnly?: boolean }) {
      return aggregateTags(filterPublished(options?.publishedOnly))
    },
    async findArticleWithTag(
      tag: string,
      condition: { isPublished?: boolean },
    ) {
      return filterPublicationState(condition?.isPublished).filter((post) =>
        post.tags.includes(tag),
      )
    },
  },
}

const postServiceProvider = {
  provide: POST_SERVICE_TOKEN,
  useValue: {
    async countByCategoryId(
      _categoryId: string,
      options: { publishedOnly?: boolean },
    ) {
      return filterPublished(options?.publishedOnly).length
    },
    async listByCategoryIds(
      ids: string[],
      options: { publishedOnly?: boolean },
    ) {
      return new Map(
        ids.map((id) => [id, filterPublished(options?.publishedOnly)]),
      )
    },
  },
}

const assertPrivateMetadataAbsent = (body: unknown) => {
  const serialized = JSON.stringify(body)
  for (const value of Object.values(privateMetadata)) {
    expect(serialized).not.toContain(value)
  }
}

describe('CategoryController public visibility contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [CategoryController],
    providers: [
      categoryServiceProvider,
      postServiceProvider,
      translationProvider,
      translationEntryProvider,
    ],
  })

  test.each([
    '/categories',
    `/categories/${fixtureCategory.slug}`,
    `/categories?ids=${CATEGORY_ID}`,
    `/categories?ids=${CATEGORY_ID}&joint=true`,
    '/categories/shared-tag?tag=true',
    '/categories?type=1',
  ])('anonymous GET %s never exposes private post metadata', async (path) => {
    const response = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}${path}`,
    })

    expect(response.statusCode).toBe(200)
    assertPrivateMetadataAbsent(response.json())
  })

  test('anonymous detail count, children and tags share one public scope', async () => {
    const response = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/categories/${fixtureCategory.slug}`,
    })
    const body = response.json()

    expect(body.data.count).toBe(1)
    expect(body.data.children).toHaveLength(1)
    expect(body.data.children[0].id).toBe(publicPost.id)
    expect(body.data.tags_sum).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'public-tag', count: 1 }),
      ]),
    )
    expect(body.data.tags_sum).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: privateMetadata.tag }),
      ]),
    )
  })

  test('authenticated owner retains full category management visibility', async () => {
    const response = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/categories/${fixtureCategory.slug}`,
      headers: { 'test-token': '1' },
    })
    const body = response.json()
    const serialized = JSON.stringify(body)

    expect(response.statusCode).toBe(200)
    expect(body.data.count).toBe(2)
    expect(body.data.children).toHaveLength(2)
    for (const value of Object.values(privateMetadata)) {
      expect(serialized).toContain(value)
    }
  })
})
