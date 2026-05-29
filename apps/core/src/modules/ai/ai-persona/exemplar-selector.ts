import { Inject, Injectable, Logger } from '@nestjs/common'
import { and, desc, eq, isNotNull } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { notes, pages } from '~/database/schema'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { RedisService } from '~/processors/redis/redis.service'

import { ConfigsService } from '../../configs/configs.service'
import {
  PERSONA_DEFAULTS,
  PERSONA_EXEMPLAR_CANDIDATES_CACHE_KEY_PREFIX,
} from './ai-persona.constants'
import type { ExemplarPassage } from './ai-persona.types'

interface CandidatePassage extends ExemplarPassage {
  recencyWeight: number
}

interface RawCandidate {
  sourceType: 'note' | 'page'
  sourceId: string
  content: string
  createdAt: Date
}

const PARAGRAPH_SPLIT_RE = /\n{2,}/

@Injectable()
export class ExemplarSelector {
  private readonly logger = new Logger(ExemplarSelector.name)

  constructor(
    @Inject(PG_DB_TOKEN) private readonly db: AppDatabase,
    private readonly redisService: RedisService,
    private readonly configsService: ConfigsService,
  ) {}

  async pickExemplars(
    personaKey: string,
    opts: {
      count: number
      lengthMin?: number
      lengthMax?: number
      rng?: () => number
      bypassCache?: boolean
    },
  ): Promise<ExemplarPassage[]> {
    if (opts.count <= 0) return []

    const personaCfg = await this.getPersonaConfig()
    const lengthMin = opts.lengthMin ?? personaCfg.lengthMin
    const lengthMax = opts.lengthMax ?? personaCfg.lengthMax
    const cacheTtl = personaCfg.cacheTtl

    const candidates = await this.loadCandidates({
      personaKey,
      lengthMin,
      lengthMax,
      cacheTtl,
      bypassCache: opts.bypassCache ?? false,
    })

    if (!candidates.length) return []

    const rng = opts.rng ?? Math.random
    return this.weightedRandomPick(candidates, opts.count, rng)
  }

  private async getPersonaConfig(): Promise<{
    lengthMin: number
    lengthMax: number
    cacheTtl: number
  }> {
    try {
      const aiCfg = await this.configsService.get('ai')
      const personaCfg = aiCfg?.aiPersona
      return {
        lengthMin:
          personaCfg?.exemplarsLengthMin ?? PERSONA_DEFAULTS.exemplarsLengthMin,
        lengthMax:
          personaCfg?.exemplarsLengthMax ?? PERSONA_DEFAULTS.exemplarsLengthMax,
        cacheTtl:
          personaCfg?.exemplarsCandidateCacheTtlSec ??
          PERSONA_DEFAULTS.exemplarsCandidateCacheTtlSec,
      }
    } catch {
      return {
        lengthMin: PERSONA_DEFAULTS.exemplarsLengthMin,
        lengthMax: PERSONA_DEFAULTS.exemplarsLengthMax,
        cacheTtl: PERSONA_DEFAULTS.exemplarsCandidateCacheTtlSec,
      }
    }
  }

  private async loadCandidates(input: {
    personaKey: string
    lengthMin: number
    lengthMax: number
    cacheTtl: number
    bypassCache: boolean
  }): Promise<CandidatePassage[]> {
    const cacheKey = `${PERSONA_EXEMPLAR_CANDIDATES_CACHE_KEY_PREFIX}${input.personaKey}:${input.lengthMin}:${input.lengthMax}`
    const redis = this.redisService.getClient()

    if (!input.bypassCache) {
      try {
        const cached = await redis.get(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached) as Array<
            Omit<CandidatePassage, 'createdAt'> & { createdAt: string }
          >
          return parsed.map((p) => ({
            ...p,
            createdAt: new Date(p.createdAt),
          }))
        }
      } catch (error) {
        this.logger.warn(
          `Exemplar cache read failed: ${(error as Error).message}`,
        )
      }
    }

    const raws = await this.loadRawPassages()
    const candidates = this.toCandidates(raws, input.lengthMin, input.lengthMax)

    if (candidates.length) {
      try {
        await redis.set(
          cacheKey,
          JSON.stringify(
            candidates.map((c) => ({
              ...c,
              createdAt: c.createdAt.toISOString(),
            })),
          ),
          'EX',
          input.cacheTtl,
        )
      } catch (error) {
        this.logger.warn(
          `Exemplar cache write failed: ${(error as Error).message}`,
        )
      }
    }

    return candidates
  }

  private async loadRawPassages(): Promise<RawCandidate[]> {
    const noteRows = await this.db
      .select({
        sourceId: notes.id,
        content: notes.text,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(and(eq(notes.isPublished, true), isNotNull(notes.text))!)
      .orderBy(desc(notes.createdAt))
      .limit(500)

    const pageRows = await this.db
      .select({
        sourceId: pages.id,
        content: pages.text,
        createdAt: pages.createdAt,
      })
      .from(pages)
      .where(isNotNull(pages.text))
      .orderBy(desc(pages.createdAt))
      .limit(200)

    const out: RawCandidate[] = []
    for (const row of noteRows) {
      if (!row.content) continue
      out.push({
        sourceType: 'note',
        sourceId: String(row.sourceId),
        content: row.content,
        createdAt: row.createdAt,
      })
    }
    for (const row of pageRows) {
      if (!row.content) continue
      out.push({
        sourceType: 'page',
        sourceId: String(row.sourceId),
        content: row.content,
        createdAt: row.createdAt,
      })
    }
    return out
  }

  private toCandidates(
    raws: RawCandidate[],
    lengthMin: number,
    lengthMax: number,
  ): CandidatePassage[] {
    const now = Date.now()
    const halfLifeMs =
      PERSONA_DEFAULTS.recencyHalfLifeDays * 24 * 60 * 60 * 1000
    const out: CandidatePassage[] = []
    for (const raw of raws) {
      const paragraphs = raw.content
        .split(PARAGRAPH_SPLIT_RE)
        .map((p) => p.trim())
        .filter((p) => p.length >= lengthMin && p.length <= lengthMax)
      const ageMs = Math.max(0, now - raw.createdAt.getTime())
      const recencyWeight = Math.pow(0.5, ageMs / halfLifeMs)
      for (const paragraph of paragraphs) {
        out.push({
          sourceType: raw.sourceType,
          sourceId: raw.sourceId,
          content: paragraph,
          createdAt: raw.createdAt,
          recencyWeight,
        })
        if (out.length >= PERSONA_DEFAULTS.exemplarsCandidatesMax) {
          return out
        }
      }
    }
    return out
  }

  private weightedRandomPick(
    candidates: CandidatePassage[],
    count: number,
    rng: () => number,
  ): ExemplarPassage[] {
    const pool = candidates.slice()
    const picked: ExemplarPassage[] = []
    const want = Math.min(count, pool.length)
    for (let i = 0; i < want; i++) {
      const totalWeight = pool.reduce((acc, c) => acc + c.recencyWeight, 0)
      if (totalWeight <= 0) break
      let target = rng() * totalWeight
      let idx = 0
      for (; idx < pool.length; idx++) {
        target -= pool[idx].recencyWeight
        if (target <= 0) break
      }
      if (idx >= pool.length) idx = pool.length - 1
      const chosen = pool.splice(idx, 1)[0]
      picked.push({
        sourceType: chosen.sourceType,
        sourceId: chosen.sourceId,
        content: chosen.content,
        createdAt: chosen.createdAt,
      })
    }
    return picked
  }
}
