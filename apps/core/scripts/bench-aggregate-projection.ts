#!/usr/bin/env node

import path from 'node:path'

import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { desc, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pkg from 'pg'

import { transformResponseCase } from '../src/common/response/case-transform'
import * as schema from '../src/database/schema'
import { categories, notes, posts, topics } from '../src/database/schema'
import { NoteRepository } from '../src/modules/note/note.repository'
import { PostRepository } from '../src/modules/post/post.repository'
import { runSchemaMigrationFiles } from '../src/processors/database/schema-migrator'
import { ContentFormat } from '../src/shared/types/content-format.type'

const { Pool } = pkg

const POST_COUNT = 600
const NOTE_COUNT = 400
const BODY_TEXT_BYTES = 12 * 1024
const BODY_CONTENT_BYTES = 20 * 1024
const WARMUP = 3
const ITERATIONS = 15

const makeBody = (bytes: number, seed: number) => {
  const chunk = `paragraph-${seed} lorem ipsum dolor sit amet consectetur adipiscing elit `
  return chunk.repeat(Math.ceil(bytes / chunk.length)).slice(0, bytes)
}

const stats = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  return { median: at(0.5), p95: at(0.95) }
}

async function bench<T>(name: string, fn: () => Promise<T>) {
  for (let i = 0; i < WARMUP; i++) await fn()
  const samples: number[] = []
  let lastResult: T | undefined
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now()
    lastResult = await fn()
    samples.push(performance.now() - start)
  }
  const { median, p95 } = stats(samples)
  const bytes = Buffer.byteLength(JSON.stringify(lastResult))
  return { name, median, p95, bytes }
}

type BenchRow = Awaited<ReturnType<typeof bench>>

const printPair = (label: string, before: BenchRow, after: BenchRow) => {
  const speedup = before.median / after.median
  const payloadRatio = before.bytes / after.bytes
  console.log(`\n## ${label}`)
  console.log(
    `  before: median ${before.median.toFixed(1)}ms  p95 ${before.p95.toFixed(1)}ms  payload ${(before.bytes / 1024).toFixed(0)}KB`,
  )
  console.log(
    `  after:  median ${after.median.toFixed(1)}ms  p95 ${after.p95.toFixed(1)}ms  payload ${(after.bytes / 1024).toFixed(0)}KB`,
  )
  console.log(
    `  => ${speedup.toFixed(1)}x faster, ${payloadRatio.toFixed(1)}x smaller`,
  )
}

async function main() {
  console.log('starting postgres testcontainer...')
  const container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('mx_bench')
    .withUsername('mx')
    .withPassword('mx')
    .start()

  const pool = new Pool({ connectionString: container.getConnectionUri(), max: 4 })
  try {
    await runSchemaMigrationFiles(
      pool,
      path.resolve(__dirname, '../src/database/migrations'),
    )
    const db = drizzle(pool, { schema, casing: 'snake_case' })

    console.log(`seeding ${POST_COUNT} posts + ${NOTE_COUNT} notes (~${((BODY_TEXT_BYTES + BODY_CONTENT_BYTES) / 1024).toFixed(0)}KB body each)...`)
    await db.insert(categories).values({
      id: '1',
      name: 'Bench',
      slug: 'bench',
      type: 0,
    })
    await db.insert(topics).values({
      id: '2',
      name: 'Bench Topic',
      slug: 'bench-topic',
      description: '',
    })

    const batch = 50
    for (let offset = 0; offset < POST_COUNT; offset += batch) {
      await db.insert(posts).values(
        Array.from({ length: Math.min(batch, POST_COUNT - offset) }, (_, i) => {
          const n = offset + i
          return {
            id: String(10_000_000 + n),
            title: `Post ${n}`,
            slug: `post-${n}`,
            text: makeBody(BODY_TEXT_BYTES, n),
            content: makeBody(BODY_CONTENT_BYTES, n),
            contentFormat: ContentFormat.Markdown,
            categoryId: '1',
            isPublished: true,
            createdAt: new Date(Date.UTC(2024, 0, 1) + n * 3_600_000),
          }
        }),
      )
    }
    for (let offset = 0; offset < NOTE_COUNT; offset += batch) {
      await db.insert(notes).values(
        Array.from({ length: Math.min(batch, NOTE_COUNT - offset) }, (_, i) => {
          const n = offset + i
          return {
            id: String(20_000_000 + n),
            title: `Note ${n}`,
            text: makeBody(BODY_TEXT_BYTES, n),
            content: makeBody(BODY_CONTENT_BYTES, n),
            contentFormat: ContentFormat.Markdown,
            isPublished: true,
            topicId: n % 3 === 0 ? '2' : null,
            createdAt: new Date(Date.UTC(2024, 0, 1) + n * 3_600_000),
          }
        }),
      )
    }

    const postRepo = new PostRepository(db, {} as never)
    const noteRepo = new NoteRepository(db, {} as never)

    const timelineBefore = await bench('timeline full-row', async () => {
      const [p, n] = await Promise.all([
        db
          .select()
          .from(posts)
          .where(eq(posts.isPublished, true))
          .orderBy(desc(posts.createdAt)),
        db
          .select({ note: notes, topic: topics })
          .from(notes)
          .leftJoin(topics, eq(notes.topicId, topics.id))
          .orderBy(desc(notes.createdAt)),
      ])
      return { posts: p, notes: n }
    })
    const timelineAfter = await bench('timeline projected', async () => {
      const [p, n] = await Promise.all([
        postRepo.findByYearForTimeline({ sort: 'desc', publishedOnly: true }),
        noteRepo.findByYearForTimeline({ sort: 'desc' }),
      ])
      return { posts: p, notes: n }
    })
    printPair(
      `/timeline (cache miss, ${POST_COUNT} posts + ${NOTE_COUNT} notes)`,
      timelineBefore,
      timelineAfter,
    )

    const timelineE2eBefore = await bench('timeline e2e full-row', async () => {
      const [p, n] = await Promise.all([
        db
          .select()
          .from(posts)
          .where(eq(posts.isPublished, true))
          .orderBy(desc(posts.createdAt)),
        db
          .select({ note: notes, topic: topics })
          .from(notes)
          .leftJoin(topics, eq(notes.topicId, topics.id))
          .orderBy(desc(notes.createdAt)),
      ])
      return JSON.stringify(transformResponseCase({ posts: p, notes: n }))
    })
    const timelineE2eAfter = await bench('timeline e2e projected', async () => {
      const [p, n] = await Promise.all([
        postRepo.findByYearForTimeline({ sort: 'desc', publishedOnly: true }),
        noteRepo.findByYearForTimeline({ sort: 'desc' }),
      ])
      return JSON.stringify(transformResponseCase({ posts: p, notes: n }))
    })
    printPair(
      '/timeline query + case transform + JSON serialize',
      timelineE2eBefore,
      timelineE2eAfter,
    )

    const topBefore = await bench('top full-row', async () => {
      const [p, n] = await Promise.all([
        postRepo.findRecent(6, { publishedOnly: true }),
        noteRepo.findRecent(6, { visibleOnly: true }),
      ])
      return { posts: p, notes: n }
    })
    const topAfter = await bench('top metaOnly', async () => {
      const [p, n] = await Promise.all([
        postRepo.findRecent(6, { publishedOnly: true, metaOnly: true }),
        noteRepo.findRecent(6, { visibleOnly: true, metaOnly: true }),
      ])
      return { posts: p, notes: n }
    })
    printPair('/top (cache miss, size=6)', topBefore, topAfter)

    const sitemapBefore = await bench('sitemap full-row', async () => {
      const [p, n] = await Promise.all([
        db
          .select()
          .from(posts)
          .where(eq(posts.isPublished, true))
          .orderBy(desc(posts.createdAt)),
        db.select().from(notes).orderBy(desc(notes.createdAt)),
      ])
      return { posts: p, notes: n }
    })
    const sitemapAfter = await bench('sitemap projected', async () => {
      const [p, n] = await Promise.all([
        postRepo.findPublishedForSitemap(),
        noteRepo.findVisibleForSitemap(),
      ])
      return { posts: p, notes: n }
    })
    printPair('/sitemap (cold)', sitemapBefore, sitemapAfter)

    const postListBefore = await bench('post list full', () =>
      postRepo.list({ page: 1, size: 10, publishedOnly: true }),
    )
    const postListAfter = await bench('post list truncated', () =>
      postRepo.list({
        page: 1,
        size: 10,
        publishedOnly: true,
        truncateText: 150,
      }),
    )
    printPair('/posts list (size=10, truncate=150)', postListBefore, postListAfter)

    const noteListBefore = await bench('note list full', () =>
      noteRepo.listVisible(1, 10, {}),
    )
    const noteListAfter = await bench('note list metaOnly', () =>
      noteRepo.listVisible(1, 10, { metaOnly: true }),
    )
    printPair('/notes list (size=10, withSummary)', noteListBefore, noteListAfter)

    const categoryBefore = await bench('category children full', () =>
      postRepo.listByCategory('1', { includeCategory: false }),
    )
    const categoryAfter = await bench('category children metaOnly', () =>
      postRepo.listByCategory('1', { includeCategory: false, metaOnly: true }),
    )
    printPair(
      `/categories/:slug children (${POST_COUNT} posts in category)`,
      categoryBefore,
      categoryAfter,
    )

    console.log(
      '\nNote: localhost socket — production adds network transfer per byte, so payload-driven gains are larger in practice.',
    )
  } finally {
    await pool.end()
    await container.stop()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
