import type { Pool } from 'pg'
import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'

import { posts } from '~/database/schema'
import { CategoryRepository } from '~/modules/category/category.repository'
import { PostRepository } from '~/modules/post/post.repository'
import { SnowflakeService } from '~/shared/id/snowflake.service'

describe('PostRepository public visibility filters', () => {
  let context: PgTestDatabase
  let pool: Pool
  let db: PgTestDatabase['db']
  let categoryRepository: CategoryRepository
  let postRepository: PostRepository
  let snowflake: SnowflakeService

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_post_public_visibility')
    pool = context.pool
    db = context.db
    snowflake = new SnowflakeService()
    categoryRepository = new CategoryRepository(db as any, snowflake)
    postRepository = new PostRepository(db as any, snowflake)
  }, 60_000)

  beforeEach(async () => {
    await pool.query('truncate table posts cascade')
    await pool.query('truncate table categories cascade')
  })

  afterAll(async () => {
    if (context) await context.close()
  })

  test('count and tag queries can exclude unpublished posts at the database boundary', async () => {
    const category = await categoryRepository.create({
      name: 'tech',
      slug: 'tech',
    })
    await db.insert(posts).values([
      {
        id: snowflake.nextId(),
        title: 'public',
        slug: 'public',
        contentFormat: 'markdown',
        categoryId: category.id,
        isPublished: true,
        tags: ['shared', 'public-only'],
      },
      {
        id: snowflake.nextId(),
        title: 'private',
        slug: 'private',
        contentFormat: 'markdown',
        categoryId: category.id,
        isPublished: false,
        tags: ['shared', 'private-only'],
      },
    ])

    expect(
      await postRepository.countByCategoryId(category.id, {
        publishedOnly: true,
      }),
    ).toBe(1)

    const allTags = await postRepository.aggregateAllTagCounts({
      publishedOnly: true,
    })
    const categoryTags = await postRepository.aggregateTagCountsByCategory(
      category.id,
      { publishedOnly: true },
    )
    for (const tags of [allTags, categoryTags]) {
      expect(tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'shared', count: 1 }),
          expect.objectContaining({ name: 'public-only', count: 1 }),
        ]),
      )
      expect(tags).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'private-only' }),
        ]),
      )
    }

    const sharedPosts = await postRepository.findByTag('shared', {
      includeCategory: false,
      metaOnly: true,
      publishedOnly: true,
    })
    expect(sharedPosts).toHaveLength(1)
    expect(sharedPosts[0].slug).toBe('public')
  })
})
