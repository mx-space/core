import { Injectable } from '@nestjs/common'

import { getRng, pickOne, rangeInt } from '~/shared/sample/prng'
import type { SampleResponseContext } from '~/shared/sample/sample-response.interceptor'

import { Activity } from '../activity.constant'

const SAMPLE_POSTS = [
  {
    id: 'sample-post-1',
    slug: 'hello-world',
    title: 'Hello, world — a fresh start',
  },
  {
    id: 'sample-post-2',
    slug: 'typescript-tips',
    title: 'TypeScript tips I wish I knew earlier',
  },
  {
    id: 'sample-post-3',
    slug: 'react-19-features',
    title: 'React 19 features in production',
  },
  {
    id: 'sample-post-4',
    slug: 'system-design',
    title: 'System design notes — caching layers',
  },
  {
    id: 'sample-post-5',
    slug: 'monorepo-pnpm',
    title: 'pnpm monorepo conventions that actually scale',
  },
  {
    id: 'sample-post-6',
    slug: 'nestjs-patterns',
    title: 'NestJS patterns for medium-sized teams',
  },
  {
    id: 'sample-post-7',
    slug: 'vue-3-vs-react',
    title: 'Vue 3 vs React — what I learned switching back',
  },
  {
    id: 'sample-post-8',
    slug: 'mongo-aggregation',
    title: 'MongoDB aggregation pipelines, demystified',
  },
  {
    id: 'sample-post-9',
    slug: 'observability-101',
    title: 'Observability 101 for the busy backend',
  },
  {
    id: 'sample-post-10',
    slug: 'ai-coding-flow',
    title: 'My AI-assisted coding flow in 2026',
  },
] as const

const SAMPLE_NOTES = [
  { id: 'sample-note-1', nid: 101, title: 'Weekly debrief — quiet week' },
  {
    id: 'sample-note-2',
    nid: 102,
    title: 'Reading notes — Designing Data-Intensive Applications',
  },
  { id: 'sample-note-3', nid: 103, title: 'A small refactor I am proud of' },
] as const

const LIKE_IPS = [
  '203.0.113.42',
  '198.51.100.7',
  '192.0.2.15',
  '203.0.113.88',
  '198.51.100.193',
  '203.0.113.144',
  '198.51.100.65',
  '192.0.2.221',
]

function randomTimestamp(rng: () => number, withinDays: number): string {
  const offset = Math.floor(rng() * withinDays * 24 * 3600 * 1000)
  return new Date(Date.now() - offset).toISOString()
}

function buildPaginatedList<T>(
  ctx: SampleResponseContext,
  total: number,
  build: (index: number) => T,
) {
  const sizeRaw = Number(ctx.query['size'] ?? 10)
  const pageRaw = Number(ctx.query['page'] ?? 1)
  const size =
    Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.trunc(sizeRaw) : 10
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.trunc(pageRaw) : 1
  const totalPages = Math.max(1, Math.ceil(total / size))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * size
  const endIndex = Math.min(startIndex + size, total)
  const data = Array.from({ length: endIndex - startIndex }, (_, idx) =>
    build(startIndex + idx),
  )

  return {
    data,
    pagination: {
      page: safePage,
      size,
      total,
      totalPages,
      currentPage: safePage,
      totalPage: totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    },
  }
}

@Injectable()
export class ActivitySampleService {
  list(ctx: SampleResponseContext) {
    const type = Number(ctx.query['type'] ?? Activity.Like)
    if (type === Activity.ReadDuration) return this.readDurationActivities(ctx)
    return this.likeActivities(ctx)
  }

  private likeActivities(ctx: SampleResponseContext) {
    const rng = getRng('activity:like')
    const total = 124

    const result = buildPaginatedList(ctx, total, (idx) => {
      const ref = pickOne(SAMPLE_POSTS, rng)
      return {
        id: `sample-like-${idx}`,
        type: Activity.Like,
        createdAt: randomTimestamp(rng, 14),
        payload: {
          id: ref.id,
          type: 'post' as const,
          ip: pickOne(LIKE_IPS, rng),
        },
        ref: { id: ref.id, slug: ref.slug, title: ref.title },
        refId: ref.id,
      }
    })

    return {
      ...result,
      objects: {
        posts: SAMPLE_POSTS.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
        })),
        notes: SAMPLE_NOTES.map((n) => ({
          id: n.id,
          title: n.title,
          nid: n.nid,
        })),
      },
    }
  }

  private readDurationActivities(ctx: SampleResponseContext) {
    const rng = getRng('activity:read')
    const total = 280

    const result = buildPaginatedList(ctx, total, (idx) => {
      const ref = pickOne(SAMPLE_POSTS, rng)
      const duration = rangeInt(15_000, 540_000, rng)
      return {
        id: `sample-read-${idx}`,
        type: Activity.ReadDuration,
        createdAt: randomTimestamp(rng, 30),
        payload: {
          id: ref.id,
          roomName: `article-${ref.id}`,
          connectedAt: Date.now() - duration,
          operationTime: Date.now(),
          duration,
          position: rangeInt(0, 95, rng),
          displayName: pickOne(
            ['Reader A', 'Reader B', 'Reader C', 'Anonymous'],
            rng,
          ),
          ip: pickOne(LIKE_IPS, rng),
        },
        refId: ref.id,
      }
    })

    return {
      ...result,
      objects: {
        posts: SAMPLE_POSTS.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
        })),
        notes: SAMPLE_NOTES.map((n) => ({
          id: n.id,
          title: n.title,
          nid: n.nid,
        })),
      },
    }
  }

  readingRank(ctx: SampleResponseContext) {
    const rng = getRng('activity:reading-rank')
    const limitRaw = Number(ctx.query['limit'] ?? 10)
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.trunc(limitRaw) : 10

    const candidates = [...SAMPLE_POSTS]
    return Array.from(
      { length: Math.min(limit, candidates.length) },
      (_, idx) => {
        const ref = candidates[idx]!
        const base = rangeInt(80, 320, rng)
        const decay = Math.max(0.25, 1 - idx * 0.12)
        return {
          refId: ref.id,
          count: Math.max(3, Math.round(base * decay)),
          ref: {
            id: ref.id,
            slug: ref.slug,
            title: ref.title,
          },
        }
      },
    ).sort((a, b) => b.count - a.count)
  }

  topReadings(ctx: SampleResponseContext) {
    const rng = getRng('activity:top-readings')
    const topRaw = Number(ctx.query['top'] ?? 5)
    const limit = Number.isFinite(topRaw) && topRaw > 0 ? Math.trunc(topRaw) : 5

    return Array.from(
      { length: Math.min(limit, SAMPLE_POSTS.length) },
      (_, idx) => {
        const ref = SAMPLE_POSTS[idx]!
        const base = rangeInt(120, 460, rng)
        const decay = Math.max(0.3, 1 - idx * 0.15)
        return {
          refId: ref.id,
          count: Math.max(5, Math.round(base * decay)),
          ref: {
            id: ref.id,
            slug: ref.slug,
            title: ref.title,
          },
        }
      },
    ).sort((a, b) => b.count - a.count)
  }
}
