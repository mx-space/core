#!/usr/bin/env node

import process from 'node:process'

// Reset argv so app.config's commander does not consume script flags.
process.argv = [process.argv[0], process.argv[1]]

const CONTENT_FORMAT = 'markdown'
const BASE_NOW = Date.UTC(2026, 4, 17, 0, 0, 0)
const DAY_MS = 24 * 60 * 60 * 1000

class Lcg {
  private state = 42

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0
    return this.state / 0x1_0000_0000
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  pick<T>(items: T[]): T {
    return items[this.int(items.length)]
  }

  bool(probability: number): boolean {
    return this.next() < probability
  }
}

function randomDate(rng: Lcg, daysBack = 365 * 3): Date {
  return new Date(BASE_NOW - rng.int(daysBack) * DAY_MS - rng.int(DAY_MS))
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
}

async function main() {
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { Pool } = await import('pg')
  const schema = await import('../src/database/schema')
  const { POSTGRES } = await import('../src/app.config')
  const { SnowflakeGenerator } = await import('@mx-space/db-schema/id')

  const pool = new Pool({
    connectionString: POSTGRES.connectionString,
    database: POSTGRES.database,
    host: POSTGRES.host,
    password: POSTGRES.password,
    port: POSTGRES.port,
    ssl: POSTGRES.ssl,
    user: POSTGRES.user,
    max: 4,
  })
  const db = drizzle(pool, { schema, casing: 'snake_case' })
  const ids = new SnowflakeGenerator({ workerId: 42 })
  const rng = new Lcg()

  try {
    console.log('[seed-bench] truncating target tables')
    await pool.query(`
      TRUNCATE TABLE
        comments,
        recentlies,
        posts,
        notes,
        pages,
        topics,
        categories
      RESTART IDENTITY CASCADE
    `)

    const categories = Array.from({ length: 20 }, (_, i) => ({
      id: ids.nextId(),
      name: `Bench Category ${i + 1}`,
      slug: `bench-category-${i + 1}`,
      type: i % 3,
    }))
    const topics = Array.from({ length: 40 }, (_, i) => ({
      id: ids.nextId(),
      name: `Bench Topic ${i + 1}`,
      slug: `bench-topic-${i + 1}`,
      description: `Topic ${i + 1}`,
    }))
    const tagPool = Array.from({ length: 50 }, (_, i) => `tag-${i + 1}`)

    console.log('[seed-bench] inserting categories and topics')
    await db.insert(schema.categories).values(categories)
    await db.insert(schema.topics).values(topics)

    const posts = Array.from({ length: 2000 }, (_, i) => {
      const createdAt = randomDate(rng)
      const tagCount = rng.int(6)
      const tags = [
        ...new Set(Array.from({ length: tagCount }, () => rng.pick(tagPool))),
      ]
      return {
        id: ids.nextId(),
        categoryId: rng.pick(categories).id,
        content: `# Bench post ${i + 1}\n\nBody ${i + 1}`,
        contentFormat: CONTENT_FORMAT,
        createdAt,
        isPublished: rng.bool(0.9),
        modifiedAt: new Date(createdAt.getTime() + rng.int(30) * DAY_MS),
        pinAt: rng.bool(0.05)
          ? new Date(BASE_NOW - rng.int(30) * DAY_MS)
          : null,
        slug: `bench-post-${i + 1}`,
        tags,
        text: `Bench post text ${i + 1}`,
        title: `Bench Post ${i + 1}`,
      }
    })

    const notes = Array.from({ length: 1500 }, (_, i) => {
      const createdAt = randomDate(rng)
      const publicRoll = rng.next()
      const publicAt =
        publicRoll < 0.6
          ? null
          : publicRoll < 0.9
            ? new Date(BASE_NOW - rng.int(120) * DAY_MS)
            : new Date(BASE_NOW + rng.int(120) * DAY_MS)
      return {
        id: ids.nextId(),
        content: `Bench note content ${i + 1}`,
        contentFormat: CONTENT_FORMAT,
        createdAt,
        isPublished: rng.bool(0.95),
        modifiedAt: new Date(createdAt.getTime() + rng.int(30) * DAY_MS),
        nid: i + 1,
        publicAt,
        slug: `bench-note-${i + 1}`,
        text: `Bench note text ${i + 1}`,
        title: `Bench Note ${i + 1}`,
        topicId: rng.bool(0.5) ? null : rng.pick(topics).id,
      }
    })

    const pages = Array.from({ length: 30 }, (_, i) => ({
      id: ids.nextId(),
      content: `Bench page content ${i + 1}`,
      contentFormat: CONTENT_FORMAT,
      order: i,
      slug: `bench-page-${i + 1}`,
      text: `Bench page text ${i + 1}`,
      title: `Bench Page ${i + 1}`,
    }))

    console.log('[seed-bench] inserting posts, notes, and pages')
    for (const part of chunk(posts, 250))
      await db.insert(schema.posts).values(part)
    for (const part of chunk(notes, 250))
      await db.insert(schema.notes).values(part)
    await pool.query(`
      SELECT setval(
        pg_get_serial_sequence('notes', 'nid'),
        (SELECT coalesce(max(nid), 0) + 1 FROM notes),
        false
      )
    `)
    await db.insert(schema.pages).values(pages)

    const refs = [
      ...posts.map((post) => ({ refId: post.id, refType: 'post' })),
      ...notes.map((note) => ({ refId: note.id, refType: 'note' })),
    ]
    const comments = Array.from({ length: 5000 }, (_, i) => {
      const ref = rng.pick(refs)
      return {
        id: ids.nextId(),
        author: `Bench User ${i % 200}`,
        createdAt: randomDate(rng),
        mail: `bench-${i}@example.com`,
        refId: ref.refId,
        refType: ref.refType,
        state: 1,
        text: `Bench comment ${i + 1}`,
      }
    })
    const recentlyRefs = [
      ...posts
        .slice(0, 200)
        .map((post) => ({ refId: post.id, refType: 'post' })),
      ...notes
        .slice(0, 200)
        .map((note) => ({ refId: note.id, refType: 'note' })),
      ...pages
        .slice(0, 30)
        .map((page) => ({ refId: page.id, refType: 'page' })),
      ...Array.from({ length: 70 }, () => ({ refId: null, refType: null })),
    ]
    const recentlies = Array.from({ length: 500 }, (_, i) => {
      const ref = rng.pick(recentlyRefs)
      return {
        id: ids.nextId(),
        content: `Bench recently ${i + 1}`,
        createdAt: randomDate(rng, 365),
        refId: ref.refId,
        refType: ref.refType,
        type: ref.refType ? 'reference' : 'text',
      }
    })

    console.log('[seed-bench] inserting comments and recentlies')
    for (const part of chunk(comments, 500))
      await db.insert(schema.comments).values(part)
    for (const part of chunk(recentlies, 250))
      await db.insert(schema.recentlies).values(part)

    console.log('[seed-bench] analyzing target tables')
    await pool.query(
      'ANALYZE categories, topics, posts, notes, pages, comments, recentlies',
    )
    console.log('[seed-bench] done')
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[seed-bench] failed:', error)
  process.exit(1)
})
