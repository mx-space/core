import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { and, desc, eq, isNotNull } from 'drizzle-orm'

import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents } from '~/constants/business-event.constant'
import { PG_DB_TOKEN } from '~/constants/system.constant'
import { notes, pages, posts } from '~/database/schema'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
  TaskStatus,
} from '~/processors/task-queue'

import { ConfigsService } from '../../../configs/configs.service'
import { AiService } from '../../ai.service'
import {
  AITaskType,
  type PersonaDistillTaskPayload,
} from '../../ai-task/ai-task.types'
import {
  PERSONA_DEFAULTS,
  PERSONA_DISTILL_LOCK_KEY_PREFIX,
  PERSONA_DISTILL_LOCK_TTL_SEC,
} from '../ai-persona.constants'
import { PersonaProfileRepository } from '../ai-persona.repository'
import {
  type DistillOutputInput,
  DistillOutputSchema,
} from '../ai-persona.schema'
import type { CorpusSample, ParsedDistillOutput } from '../ai-persona.types'
import { getPersonaDefinition, isKnownPersonaKey } from '../persona-registry'

const STRIP_FENCE_RE = /^```(?:json)?\n?(.*?)\n?```$/s

@Injectable()
export class PersonaDistillProcessor implements OnModuleInit {
  private readonly logger = new Logger(PersonaDistillProcessor.name)

  constructor(
    @Inject(PG_DB_TOKEN) private readonly db: AppDatabase,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly aiService: AiService,
    private readonly configsService: ConfigsService,
    private readonly profileRepo: PersonaProfileRepository,
    private readonly redisService: RedisService,
    private readonly eventManager: EventManagerService,
  ) {}

  onModuleInit() {
    this.taskProcessor.registerHandler<PersonaDistillTaskPayload>({
      type: AITaskType.PersonaDistill,
      execute: async (payload, context) => this.handle(payload, context),
    })
  }

  private async handle(
    payload: PersonaDistillTaskPayload,
    context: TaskExecuteContext,
  ): Promise<void> {
    const { personaKey } = payload
    if (!isKnownPersonaKey(personaKey)) {
      throw createAppException(AppErrorCode.AI_PERSONA_NOT_FOUND, {
        key: personaKey,
      })
    }
    const definition = getPersonaDefinition(personaKey)
    if (!definition.needsProfile) {
      throw createAppException(AppErrorCode.AI_PERSONA_NOT_DISTILLABLE, {
        key: personaKey,
      })
    }

    const redis = this.redisService.getClient()
    const lockKey = `${PERSONA_DISTILL_LOCK_KEY_PREFIX}${personaKey}`
    const acquired = await redis.set(
      lockKey,
      '1',
      'EX',
      PERSONA_DISTILL_LOCK_TTL_SEC,
      'NX',
    )

    if (!acquired) {
      await context.appendLog(
        'warn',
        `Persona "${personaKey}" distill lock held; skipping`,
      )
      context.setStatus(TaskStatus.Cancelled)
      return
    }

    try {
      await context.appendLog('info', `Persona distill started: ${personaKey}`)
      await context.updateProgress(5, 'Sampling corpus')

      const aiConfig = await this.configsService.get('ai')
      const maxTokens =
        aiConfig?.aiPersona?.distillSampleMaxTokens ??
        PERSONA_DEFAULTS.distillSampleMaxTokens

      const corpus = await this.sampleCorpus({ maxTokens })
      const corpusVersion = corpus.length
      if (!corpus.length) {
        await context.appendLog(
          'warn',
          'Corpus is empty; aborting persona distill',
        )
        context.setStatus(TaskStatus.Failed)
        return
      }

      await context.updateProgress(30, 'Calling distill model')

      const runtime = await this.aiService.getPersonaDistillModel()
      const messages = this.buildDistillPrompt(corpus)
      const result = await runtime.generateText({
        messages,
        temperature: 0.4,
        maxRetries: 2,
      })
      await context.incrementTokens(result.usage?.totalTokens ?? 0)

      await context.updateProgress(80, 'Persisting profile')
      const parsed = this.parseDistillOutput(result.text)

      const row = await this.profileRepo.upsert({
        personaKey,
        profile: parsed.profile,
        profileSummary: parsed.profileSummary,
        corpusVersion,
        distillModel: runtime.providerInfo.model,
        refreshedAt: new Date(),
        metadata: {
          toneTags: parsed.metadata.toneTags,
          recurringThemes: parsed.metadata.recurringThemes,
          signaturePhrases: parsed.metadata.signaturePhrases,
        },
      })

      await context.setResult({
        personaKey,
        profileId: row.id,
        corpusVersion,
        refreshedAt: row.refreshedAt.toISOString(),
      })

      await this.eventManager.emit(BusinessEvents.PERSONA_PROFILE_REFRESHED, {
        personaKey,
        profileId: row.id,
        refreshedAt: row.refreshedAt.toISOString(),
        corpusVersion,
      })
    } catch (error) {
      this.logger.error(
        `Persona distill failed: ${(error as Error).message}`,
        (error as Error).stack,
      )
      throw error
    } finally {
      try {
        await redis.del(lockKey)
      } catch (error) {
        this.logger.warn(
          `Failed to release persona distill lock: ${(error as Error).message}`,
        )
      }
    }
  }

  async sampleCorpus(opts: {
    maxTokens: number
    rng?: () => number
  }): Promise<CorpusSample[]> {
    const rng = opts.rng ?? Math.random
    const charBudget = opts.maxTokens * PERSONA_DEFAULTS.charsPerToken
    const overshoot = charBudget * 1.1

    const quota = PERSONA_DEFAULTS.perTypeQuota
    const perType: Record<'post' | 'note' | 'page', number> = {
      post: Math.floor(overshoot * quota.post),
      note: Math.floor(overshoot * quota.note),
      page: Math.floor(overshoot * quota.page),
    }

    const [postRows, noteRows, pageRows] = await Promise.all([
      this.db
        .select({
          id: posts.id,
          title: posts.title,
          createdAt: posts.createdAt,
          text: posts.text,
        })
        .from(posts)
        .where(and(eq(posts.isPublished, true), isNotNull(posts.text))!)
        .orderBy(desc(posts.createdAt))
        .limit(500),
      this.db
        .select({
          id: notes.id,
          title: notes.title,
          createdAt: notes.createdAt,
          text: notes.text,
        })
        .from(notes)
        .where(and(eq(notes.isPublished, true), isNotNull(notes.text))!)
        .orderBy(desc(notes.createdAt))
        .limit(500),
      this.db
        .select({
          id: pages.id,
          title: pages.title,
          createdAt: pages.createdAt,
          text: pages.text,
        })
        .from(pages)
        .where(isNotNull(pages.text))
        .orderBy(desc(pages.createdAt))
        .limit(200),
    ])

    const samples: CorpusSample[] = []
    const collectType = (
      type: 'post' | 'note' | 'page',
      rows: Array<{
        id: string
        title: string | null
        createdAt: Date
        text: string | null
      }>,
    ) => {
      const budget = perType[type]
      const pool = rows.slice()
      const weighted = this.recencyWeighted(pool, rng)
      let used = 0
      for (const row of weighted) {
        if (!row.text) continue
        const len = row.text.length
        if (used + len > budget && used > 0) break
        samples.push({
          sourceType: type,
          sourceId: String(row.id),
          title: row.title ?? null,
          createdAt: row.createdAt,
          body: row.text,
        })
        used += len
      }
    }

    collectType('post', postRows)
    collectType('note', noteRows)
    collectType('page', pageRows)

    samples.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    return samples
  }

  private recencyWeighted<T extends { createdAt: Date }>(
    items: T[],
    rng: () => number,
  ): T[] {
    if (!items.length) return items
    const now = Date.now()
    const halfLifeMs =
      PERSONA_DEFAULTS.recencyHalfLifeDays * 24 * 60 * 60 * 1000
    const pool = items.slice()
    const out: T[] = []
    while (pool.length) {
      const weights = pool.map((item) => {
        const age = Math.max(0, now - item.createdAt.getTime())
        return Math.pow(0.5, age / halfLifeMs)
      })
      const total = weights.reduce((a, b) => a + b, 0)
      if (total <= 0) {
        out.push(...pool)
        break
      }
      let target = rng() * total
      let idx = 0
      for (; idx < weights.length; idx++) {
        target -= weights[idx]
        if (target <= 0) break
      }
      if (idx >= pool.length) idx = pool.length - 1
      out.push(pool.splice(idx, 1)[0])
    }
    return out
  }

  buildDistillPrompt(corpus: CorpusSample[]): Array<{
    role: 'system' | 'user'
    content: string
  }> {
    const system = [
      'You are profiling a single author from their own writing.',
      'Read the passages below and produce a JSON object with three fields:',
      '',
      '- "profile": a description (200–600 words) covering the author\'s voice,',
      '  cadence, vocabulary, recurring themes, value tendencies, signature',
      '  phrases. Write in second person ("the author tends to…"). Be specific',
      '  and citable, not generic.',
      '',
      '- "profile_summary": a 60–120 word condensation suitable for embedding',
      '  into another prompt.',
      '',
      '- "metadata": {',
      '    "tone_tags": [string],',
      '    "recurring_themes": [string],',
      '    "signature_phrases": [string]',
      '  }',
      '',
      'Reply with raw JSON, no markdown fences.',
    ].join('\n')

    const userBody: string[] = ['Passages (oldest first):', '']
    for (const sample of corpus) {
      const dateStr = sample.createdAt.toISOString().slice(0, 10)
      const head = sample.title
        ? `[${sample.sourceType}:${sample.sourceId} — ${dateStr} — ${sample.title}]`
        : `[${sample.sourceType}:${sample.sourceId} — ${dateStr}]`
      userBody.push(head, sample.body, '')
    }

    return [
      { role: 'system', content: system },
      { role: 'user', content: userBody.join('\n') },
    ]
  }

  parseDistillOutput(raw: string): ParsedDistillOutput {
    const trimmed = (raw ?? '').trim()
    if (!trimmed) {
      throw new Error('Empty distill output')
    }

    const candidate = this.stripFences(trimmed)
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(candidate)
    } catch {
      this.logger.warn('Distill output is not valid JSON; using text fallback')
      return this.textFallback(trimmed)
    }

    const validated = DistillOutputSchema.safeParse(parsedJson)
    if (!validated.success) {
      this.logger.warn(
        `Distill output JSON failed validation: ${validated.error.message}`,
      )
      return this.textFallback(trimmed)
    }
    return this.toParsed(validated.data)
  }

  private stripFences(text: string): string {
    const match = STRIP_FENCE_RE.exec(text)
    return match ? match[1].trim() : text
  }

  private toParsed(input: DistillOutputInput): ParsedDistillOutput {
    const md = input.metadata ?? {}
    return {
      profile: input.profile.trim(),
      profileSummary: input.profile_summary?.trim() ?? null,
      metadata: {
        toneTags: md.tone_tags ?? [],
        recurringThemes: md.recurring_themes ?? [],
        signaturePhrases: md.signature_phrases ?? [],
      },
    }
  }

  private textFallback(raw: string): ParsedDistillOutput {
    return {
      profile: raw.slice(0, 4000),
      profileSummary: null,
      metadata: {
        toneTags: [],
        recurringThemes: [],
        signaturePhrases: [],
      },
    }
  }
}
