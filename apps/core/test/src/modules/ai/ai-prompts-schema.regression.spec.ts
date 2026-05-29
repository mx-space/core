import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { Value } from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { AI_PROMPTS } from '~/modules/ai/ai.prompts'

const FIXTURE_DIR = resolve(__dirname, '../../../fixtures/ai-prompts')

type Fixture = {
  name: string
  value: unknown
  expected: boolean
}

type ChunkFixture = Fixture & {
  textEntries: Record<string, unknown>
}

function loadFixtures<T = Fixture>(file: string): T[] {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8')) as T[]
}

const zodSummary = z
  .object({
    summary: z.string(),
  })
  .strict()

const zodWriterTitleAndSlug = z
  .object({
    title: z.string(),
    slug: z.string(),
    lang: z.string(),
    keywords: z.array(z.string()),
  })
  .strict()

const zodWriterSlug = z
  .object({
    slug: z.string(),
  })
  .strict()

const zodCommentScore = z
  .object({
    score: z.number(),
    hasSensitiveContent: z.boolean(),
  })
  .strict()

const zodCommentSpam = z
  .object({
    isSpam: z.boolean(),
    hasSensitiveContent: z.boolean(),
  })
  .strict()

const zodTranslationReviewer = z
  .object({
    score: z.number().int().min(0).max(100),
    issues: z.array(
      z
        .object({
          id: z.string(),
          severity: z.enum(['minor', 'major']),
          problem: z.string(),
          hint: z.string().optional(),
        })
        .strict(),
    ),
  })
  .strict()

const zodTranslationEditor = z
  .object({
    patches: z.record(z.string(), z.string()),
  })
  .strict()

const zodFieldTranslation = z
  .object({
    translations: z.record(z.string(), z.string()),
  })
  .strict()

const buildZodTranslationChunkSchema = (
  textEntries: Record<string, unknown>,
) => {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, value] of Object.entries(textEntries)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as any).type === 'text.group' &&
      Array.isArray((value as any).segments)
    ) {
      const groupShape = Object.fromEntries(
        ((value as any).segments as Array<{ id: string }>).map((seg) => [
          seg.id,
          z.string(),
        ]),
      )
      shape[key] = z.object(groupShape).strict()
      continue
    }
    shape[key] = z.string()
  }
  return z
    .object({
      sourceLang: z.string(),
      translations: z.object(shape).strict(),
    })
    .strict()
}

describe('ai-prompts schema regression (zod -> typebox parity)', () => {
  describe('summary', () => {
    const fixtures = loadFixtures('summary.json')
    const tb = AI_PROMPTS.summary('en', 'sample').schema

    for (const fx of fixtures) {
      it(`${fx.name}: zod ⇔ typebox agree`, () => {
        const zOk = zodSummary.safeParse(fx.value).success
        const tOk = Value.Check(tb, fx.value)
        expect(zOk).toBe(fx.expected)
        expect(tOk).toBe(zOk)
      })
    }
  })

  describe('writer.titleAndSlug', () => {
    const fixtures = loadFixtures('writer-title-and-slug.json')
    const tb = AI_PROMPTS.writer.titleAndSlug('content').schema

    for (const fx of fixtures) {
      it(`${fx.name}: zod ⇔ typebox agree`, () => {
        const zOk = zodWriterTitleAndSlug.safeParse(fx.value).success
        const tOk = Value.Check(tb, fx.value)
        expect(zOk).toBe(fx.expected)
        expect(tOk).toBe(zOk)
      })
    }
  })

  describe('writer.slug', () => {
    const fixtures = loadFixtures('writer-slug.json')
    const tb = AI_PROMPTS.writer.slug('title').schema

    for (const fx of fixtures) {
      it(`${fx.name}: zod ⇔ typebox agree`, () => {
        const zOk = zodWriterSlug.safeParse(fx.value).success
        const tOk = Value.Check(tb, fx.value)
        expect(zOk).toBe(fx.expected)
        expect(tOk).toBe(zOk)
      })
    }
  })

  describe('comment.score', () => {
    const fixtures = loadFixtures('comment-score.json')
    const tb = AI_PROMPTS.comment.score('comment').schema

    for (const fx of fixtures) {
      it(`${fx.name}: zod ⇔ typebox agree`, () => {
        const zOk = zodCommentScore.safeParse(fx.value).success
        const tOk = Value.Check(tb, fx.value)
        expect(zOk).toBe(fx.expected)
        expect(tOk).toBe(zOk)
      })
    }
  })

  describe('comment.spam', () => {
    const fixtures = loadFixtures('comment-spam.json')
    const tb = AI_PROMPTS.comment.spam('comment').schema

    for (const fx of fixtures) {
      it(`${fx.name}: zod ⇔ typebox agree`, () => {
        const zOk = zodCommentSpam.safeParse(fx.value).success
        const tOk = Value.Check(tb, fx.value)
        expect(zOk).toBe(fx.expected)
        expect(tOk).toBe(zOk)
      })
    }
  })

  describe('translationReviewer', () => {
    const fixtures = loadFixtures('translation-reviewer.json')
    const tb = AI_PROMPTS.translationReviewer('zh', {
      allowedIds: ['x'],
      fullTranslations: { x: 'y' },
    }).schema

    for (const fx of fixtures) {
      it(`${fx.name}: zod ⇔ typebox agree`, () => {
        const zOk = zodTranslationReviewer.safeParse(fx.value).success
        const tOk = Value.Check(tb, fx.value)
        expect(zOk).toBe(fx.expected)
        expect(tOk).toBe(zOk)
      })
    }
  })

  describe('translationEditor', () => {
    const fixtures = loadFixtures('translation-editor.json')
    const tb = AI_PROMPTS.translationEditor('zh', {
      fullTranslations: { x: 'y' },
      issues: [],
    }).schema

    for (const fx of fixtures) {
      it(`${fx.name}: zod ⇔ typebox agree`, () => {
        const zOk = zodTranslationEditor.safeParse(fx.value).success
        const tOk = Value.Check(tb, fx.value)
        expect(zOk).toBe(fx.expected)
        expect(tOk).toBe(zOk)
      })
    }
  })

  describe('fieldTranslation', () => {
    const fixtures = loadFixtures('field-translation.json')
    const tb = AI_PROMPTS.fieldTranslation('zh', { x: 'y' }).schema

    for (const fx of fixtures) {
      it(`${fx.name}: zod ⇔ typebox agree`, () => {
        const zOk = zodFieldTranslation.safeParse(fx.value).success
        const tOk = Value.Check(tb, fx.value)
        expect(zOk).toBe(fx.expected)
        expect(tOk).toBe(zOk)
      })
    }
  })

  describe('translationChunk (dynamic shape)', () => {
    const fixtures = loadFixtures<ChunkFixture>('translation-chunk.json')

    for (const fx of fixtures) {
      it(`${fx.name}: zod ⇔ typebox agree`, () => {
        const tb = AI_PROMPTS.translationChunk('zh', {
          documentContext: 'ctx',
          textEntries: fx.textEntries,
        }).schema
        const zod = buildZodTranslationChunkSchema(fx.textEntries)
        const zOk = zod.safeParse(fx.value).success
        const tOk = Value.Check(tb, fx.value)
        expect(zOk).toBe(fx.expected)
        expect(tOk).toBe(zOk)
      })
    }
  })

  describe('dead-code removal', () => {
    it('AI_PROMPTS.translation factory is removed', () => {
      expect(
        (AI_PROMPTS as Record<string, unknown>).translation,
      ).toBeUndefined()
    })
  })
})
