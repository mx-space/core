import { describe, expect, it, vi } from 'vitest'

import { ExemplarSelector } from '~/modules/ai/ai-persona/exemplar-selector'

type NoteRow = {
  id: string
  text: string | null
  createdAt: Date
  isPublished: boolean
}
type PageRow = {
  id: string
  text: string | null
  createdAt: Date
}

const makeSelector = ({
  notes,
  pages,
  redisStore,
}: {
  notes: NoteRow[]
  pages: PageRow[]
  redisStore?: Map<string, string>
}) => {
  const store = redisStore ?? new Map<string, string>()

  const buildQueryChain = (rows: any[]) => {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => Promise.resolve(rows),
    }
    return chain
  }

  let selectCallCount = 0
  const db: any = {
    select: vi.fn().mockImplementation(() => {
      selectCallCount += 1
      if (selectCallCount === 1) {
        return buildQueryChain(
          notes.map((n) => ({
            sourceId: n.id,
            content: n.text,
            createdAt: n.createdAt,
          })),
        )
      }
      return buildQueryChain(
        pages.map((p) => ({
          sourceId: p.id,
          content: p.text,
          createdAt: p.createdAt,
        })),
      )
    }),
  }

  const redisClient: any = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
      return 'OK'
    }),
  }
  const redisService: any = { getClient: () => redisClient }
  const configsService: any = {
    get: vi.fn(async () => ({
      aiPersona: {
        exemplarsLengthMin: 50,
        exemplarsLengthMax: 600,
        exemplarsCandidateCacheTtlSec: 60,
      },
    })),
  }

  const selector = new ExemplarSelector(db, redisService, configsService)
  return { selector, store, redisClient }
}

describe('ExemplarSelector', () => {
  it('returns empty array when no passages match the length window', async () => {
    const { selector } = makeSelector({
      notes: [
        {
          id: 'n1',
          text: 'short',
          createdAt: new Date('2025-01-01T00:00:00Z'),
          isPublished: true,
        },
      ],
      pages: [],
    })
    const out = await selector.pickExemplars('inner-self', { count: 3 })
    expect(out).toEqual([])
  })

  it('honors count and length window with a seeded RNG', async () => {
    const longBody = 'A'.repeat(120) + '\n\n' + 'B'.repeat(120)
    const { selector } = makeSelector({
      notes: [
        {
          id: 'n1',
          text: longBody,
          createdAt: new Date('2025-06-01T00:00:00Z'),
          isPublished: true,
        },
        {
          id: 'n2',
          text: 'C'.repeat(120) + '\n\n' + 'D'.repeat(120),
          createdAt: new Date('2025-07-01T00:00:00Z'),
          isPublished: true,
        },
      ],
      pages: [],
    })
    const seededRng = mulberry32(42)
    const out = await selector.pickExemplars('inner-self', {
      count: 2,
      lengthMin: 100,
      lengthMax: 200,
      rng: seededRng,
      bypassCache: true,
    })
    expect(out).toHaveLength(2)
    for (const passage of out) {
      expect(passage.content.length).toBeGreaterThanOrEqual(100)
      expect(passage.content.length).toBeLessThanOrEqual(200)
      expect(['note', 'page']).toContain(passage.sourceType)
    }
  })

  it('is deterministic given the same seeded RNG', async () => {
    const longText =
      'A'.repeat(150) +
      '\n\n' +
      'B'.repeat(150) +
      '\n\n' +
      'C'.repeat(150) +
      '\n\n' +
      'D'.repeat(150)
    const params = {
      notes: [
        {
          id: 'n1',
          text: longText,
          createdAt: new Date('2025-06-01T00:00:00Z'),
          isPublished: true,
        },
      ],
      pages: [],
    }
    const a = makeSelector(params)
    const b = makeSelector(params)
    const opts = {
      count: 3,
      lengthMin: 100,
      lengthMax: 200,
      rng: mulberry32(123),
      bypassCache: true,
    }
    const out1 = await a.selector.pickExemplars('inner-self', opts)
    const out2 = await b.selector.pickExemplars('inner-self', {
      ...opts,
      rng: mulberry32(123),
    })
    expect(out1.map((p) => p.content)).toEqual(out2.map((p) => p.content))
  })
})

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
