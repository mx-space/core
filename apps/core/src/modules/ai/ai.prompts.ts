import type { TSchema } from '@earendil-works/pi-ai'
import { Type } from '@earendil-works/pi-ai'

import {
  AI_SUMMARY_MAX_WORDS,
  DEFAULT_SUMMARY_LANG,
  LANGUAGE_CODE_TO_NAME,
} from './ai.constants'
import COMMENT_SCORE_SYSTEM from './prompts/comment-score.system.md?raw'
import COMMENT_SPAM_SYSTEM from './prompts/comment-spam.system.md?raw'
import COVER_SIGNAL_GEOMETRY_SYSTEM from './prompts/cover-signal-geometry.system.md?raw'
import COVER_SIGNAL_GEOMETRY_FALLBACK from './prompts/cover-signal-geometry-fallback.partial.md?raw'
import COVER_SIGNAL_GEOMETRY_HARD_CONSTRAINTS from './prompts/cover-signal-geometry-hard-constraints.partial.md?raw'
import FIELD_TRANSLATION_SYSTEM from './prompts/field-translation.system.md?raw'
import INSIGHTS_BASE_TEMPLATE from './prompts/insights-base.system.md?raw'
import INSIGHTS_STREAM_REMINDER from './prompts/insights-stream-reminder.partial.md?raw'
import INSIGHTS_TRANSLATION_BASE_TEMPLATE from './prompts/insights-translation-base.system.md?raw'
import INSIGHTS_TRANSLATION_JAPANESE_RUBY from './prompts/insights-translation-japanese-ruby.partial.md?raw'
import { renderPromptTemplate } from './prompts/render'
import SLUG_SYSTEM from './prompts/slug.system.md?raw'
import SUMMARY_TEMPLATE from './prompts/summary.system.md?raw'
import SUMMARY_STREAM_TEMPLATE from './prompts/summary-stream.system.md?raw'
import SUMMARY_TRANSLATION_TEMPLATE from './prompts/summary-translation.system.md?raw'
import TITLE_AND_SLUG_SYSTEM from './prompts/title-and-slug.system.md?raw'
import TRANSLATION_AGENT_LOOP from './prompts/translation-agent-loop.partial.md?raw'
import TRANSLATION_BASE from './prompts/translation-base.system.md?raw'
import TRANSLATION_CHUNK_BASE from './prompts/translation-chunk-base.system.md?raw'
import TRANSLATION_CHUNK_JAPANESE_RUBY from './prompts/translation-chunk-japanese-ruby.partial.md?raw'
import TRANSLATION_CHUNK_LANG_EN from './prompts/translation-chunk-lang-en.partial.md?raw'
import TRANSLATION_CHUNK_LANG_JA from './prompts/translation-chunk-lang-ja.partial.md?raw'
import TRANSLATION_CHUNK_LANG_ZH from './prompts/translation-chunk-lang-zh.partial.md?raw'
import TRANSLATION_EDITOR_SYSTEM from './prompts/translation-editor.system.md?raw'
import TRANSLATION_INPUT_FORMAT from './prompts/translation-input-format.partial.md?raw'
import TRANSLATION_JAPANESE_RUBY from './prompts/translation-japanese-ruby.partial.md?raw'
import TRANSLATION_LANG_EN from './prompts/translation-lang-en.partial.md?raw'
import TRANSLATION_LANG_JA from './prompts/translation-lang-ja.partial.md?raw'
import TRANSLATION_LANG_ZH from './prompts/translation-lang-zh.partial.md?raw'
import TRANSLATION_OUTPUT_FORMAT from './prompts/translation-output-format.partial.md?raw'
import TRANSLATION_REVIEWER_SYSTEM from './prompts/translation-reviewer.system.md?raw'
import TRANSLATION_STREAM_REMINDER from './prompts/translation-stream-reminder.partial.md?raw'
import type { ReasoningEffort } from './runtime/types'

const SUMMARY_SYSTEM = renderPromptTemplate(SUMMARY_TEMPLATE, {
  MAX_WORDS: AI_SUMMARY_MAX_WORDS,
})

const SUMMARY_STREAM_SYSTEM = renderPromptTemplate(SUMMARY_STREAM_TEMPLATE, {
  MAX_WORDS: AI_SUMMARY_MAX_WORDS,
})

const SUMMARY_TRANSLATION_SYSTEM = renderPromptTemplate(
  SUMMARY_TRANSLATION_TEMPLATE,
  {
    MAX_WORDS: AI_SUMMARY_MAX_WORDS,
  },
)

const INSIGHTS_GENRES = [
  'architecture',
  'tutorial',
  'post-mortem',
  'comparison',
  'mechanism',
  'diary',
  'travelogue',
  'essay',
  'review',
  'memorial',
  'retrospective',
] as const

const INSIGHTS_GENRE_LIST = INSIGHTS_GENRES.join(', ')

const INSIGHTS_BASE = renderPromptTemplate(INSIGHTS_BASE_TEMPLATE, {
  GENRE_LIST: INSIGHTS_GENRE_LIST,
})

const buildInsightsSystem = (isStream: boolean) =>
  isStream
    ? `${INSIGHTS_BASE.trimEnd()}${INSIGHTS_STREAM_REMINDER}`
    : INSIGHTS_BASE

const TRANSLATION_LANG_PARTIALS: Record<string, string> = {
  zh: TRANSLATION_LANG_ZH,
  ja: TRANSLATION_LANG_JA,
  en: TRANSLATION_LANG_EN,
}

const TRANSLATION_CHUNK_LANG_PARTIALS: Record<string, string> = {
  zh: TRANSLATION_CHUNK_LANG_ZH,
  ja: TRANSLATION_CHUNK_LANG_JA,
  en: TRANSLATION_CHUNK_LANG_EN,
}

const buildTranslationSystem = (targetLang: string, isStream: boolean) => {
  let system = TRANSLATION_BASE.trimEnd()

  const langPartial = TRANSLATION_LANG_PARTIALS[targetLang]
  if (langPartial) {
    system += langPartial.trimEnd()
  }

  if (targetLang === 'ja') {
    system += TRANSLATION_JAPANESE_RUBY.trimEnd()
  }

  system += TRANSLATION_INPUT_FORMAT.trimEnd()
  system += TRANSLATION_OUTPUT_FORMAT.trimEnd()

  if (isStream) {
    system += TRANSLATION_STREAM_REMINDER
  }

  return system
}

const buildTranslationPrompt = (
  targetLanguage: string,
  content: {
    title: string
    text: string
    subtitle?: string
    summary?: string
    tags?: string[]
    styleHints?: string
  },
) => {
  let prompt = `TARGET_LANGUAGE: ${targetLanguage}`

  if (content.styleHints) {
    prompt += `

<<<STYLE_CONTEXT
${content.styleHints}
STYLE_CONTEXT`
  }

  prompt += `

<<<TITLE
${content.title}
TITLE

<<<TEXT_MARKDOWN
${content.text}
TEXT_MARKDOWN`

  if (content.subtitle) {
    prompt += `

<<<SUBTITLE
${content.subtitle}
SUBTITLE`
  }

  if (content.summary) {
    prompt += `

<<<SUMMARY
${content.summary}
SUMMARY`
  }
  if (content.tags?.length) {
    prompt += `

<<<TAGS
${content.tags.join(', ')}
TAGS`
  }

  return prompt
}

const buildTranslationChunkSystem = (targetLang: string) => {
  let system = TRANSLATION_CHUNK_BASE.trimEnd()

  const langPartial = TRANSLATION_CHUNK_LANG_PARTIALS[targetLang]
  if (langPartial) {
    system += langPartial.trimEnd()
  }

  if (targetLang === 'ja') {
    system += TRANSLATION_CHUNK_JAPANESE_RUBY
  }

  return system
}

const buildTranslationChunkPrompt = (
  targetLanguage: string,
  chunk: {
    documentContext: string
    textEntries: Record<string, unknown>
    segmentMeta?: Record<string, string>
    styleHints?: string
  },
) => {
  let prompt = `TARGET_LANGUAGE: ${targetLanguage}

## Document context (for semantic reference, DO NOT output this)
${chunk.documentContext}`

  if (chunk.styleHints) {
    prompt += `

## Style context (DO NOT output this)
${chunk.styleHints}`
  }

  if (chunk.segmentMeta && Object.keys(chunk.segmentMeta).length > 0) {
    prompt += `

## Segment metadata (for translation guidance only, DO NOT output this)
${JSON.stringify(chunk.segmentMeta)}`
  }

  prompt += `

## Segments to translate
${JSON.stringify(chunk.textEntries)}`

  return prompt
}

const stripMarkedBlock = (text: string, marker: string) =>
  text.replace(
    new RegExp(`<!-- ${marker}-START -->[\\s\\S]*?<!-- ${marker}-END -->\\n?`),
    '',
  )

const stripMarkers = (text: string) =>
  text.replaceAll(/<!-- [A-Z-]+-(?:START|END) -->\n?/g, '')

const buildTranslationAgentSystem = (
  targetLang: string,
  opts: { reviewEnabled: boolean },
) => {
  const partial = stripMarkers(
    opts.reviewEnabled
      ? stripMarkedBlock(TRANSLATION_AGENT_LOOP, 'NO-REVIEW')
      : stripMarkedBlock(TRANSLATION_AGENT_LOOP, 'REVIEW-OBLIGATION'),
  )
  return buildTranslationChunkSystem(targetLang) + partial
}

export const buildTranslationChunkSchema = (
  textEntries: Record<string, unknown>,
) => {
  const translationShape: Record<string, TSchema> = {}

  for (const [key, value] of Object.entries(textEntries)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as any).type === 'text.group' &&
      Array.isArray((value as any).segments)
    ) {
      const groupShape = Object.fromEntries(
        ((value as any).segments as Array<{ id: string }>).map((segment) => [
          segment.id,
          Type.String(),
        ]),
      )

      translationShape[key] = Type.Object(groupShape, {
        additionalProperties: false,
        description: `Translated segment map for group ${key}`,
      })
      continue
    }

    translationShape[key] = Type.String()
  }

  return Type.Object(
    {
      sourceLang: Type.String({
        description: 'Detected source language as an ISO 639-1 code',
      }),
      translations: Type.Object(translationShape, {
        additionalProperties: false,
        description:
          'Exact map of segment key to translated text, or group key to a translated member-id map',
      }),
    },
    { additionalProperties: false },
  )
}

const REVIEWER_OUTPUT_SCHEMA = Type.Object(
  {
    issues: Type.Array(
      Type.Object(
        {
          id: Type.String({
            description:
              'Segment ID or field name to flag; MUST be in ALLOWED_IDS',
          }),
          severity: Type.Union([Type.Literal('minor'), Type.Literal('major')]),
          problem: Type.String({
            description: 'One short clause describing what is wrong',
          }),
          hint: Type.Optional(
            Type.String({
              description: 'Optional short cue; NOT a full rewrite',
            }),
          ),
        },
        { additionalProperties: false },
      ),
      {
        description:
          'List of flagged issues; empty means the translation is acceptable as-is',
      },
    ),
  },
  { additionalProperties: false },
)

const EDITOR_OUTPUT_SCHEMA = Type.Object(
  {
    patches: Type.Record(Type.String(), Type.String(), {
      description:
        'Map of segment ID to revised translation; omit keys not improved',
    }),
  },
  { additionalProperties: false },
)

// Quota inflation measurably hurts final quality: reviewers fill larger
// budgets with preference-level nitpicks and the editor churn degrades the
// writer's coherent output. Long documents get coverage via review windows,
// each with this same fixed budget.
const REVIEWER_MAX_ISSUES = 12

const buildTranslationReviewerPrompt = (
  targetLanguage: string,
  payload: {
    allowedIds: string[]
    segments: Record<string, { source?: string; target: string }>
    styleHints?: string
  },
) => {
  let prompt = `TARGET_LANGUAGE: ${targetLanguage}
MAX_ISSUES: ${REVIEWER_MAX_ISSUES}`

  if (payload.styleHints) {
    prompt += `

## Style guide
${payload.styleHints}`
  }

  return `${prompt}

## ALLOWED_IDS (issues outside this set MUST be dropped)
${JSON.stringify(payload.allowedIds)}

## Segments (id → { source?, target })
${JSON.stringify(payload.segments)}`
}

const buildTranslationEditorPrompt = (
  targetLanguage: string,
  payload: {
    fullTranslations: Record<string, string>
    issues: Array<{
      id: string
      severity: 'minor' | 'major'
      problem: string
      hint?: string
    }>
    styleHints?: string
  },
) => {
  let prompt = `TARGET_LANGUAGE: ${targetLanguage}`

  if (payload.styleHints) {
    prompt += `

## Style context
${payload.styleHints}`
  }

  return `${prompt}

## Current translations (id → text, for context)
${JSON.stringify(payload.fullTranslations)}

## Issues to address
${JSON.stringify(payload.issues)}`
}

const NO_REASONING: ReasoningEffort = 'none'

const buildInsightsPrompt = (
  targetLanguage: string,
  article: { title: string; text: string; subtitle?: string; tags?: string[] },
) => {
  let prompt = `TARGET_LANGUAGE: ${targetLanguage}

<<<TITLE
${article.title}
TITLE`

  if (article.subtitle) {
    prompt += `\n\n<<<SUBTITLE\n${article.subtitle}\nSUBTITLE`
  }
  if (article.tags?.length) {
    prompt += `\n\n<<<TAGS\n${article.tags.join(', ')}\nTAGS`
  }
  prompt += `\n\n<<<CONTENT\n${article.text}\nCONTENT`
  return prompt
}

const buildInsightsTranslationSystem = (
  targetLanguage: string,
  isJapanese: boolean,
) => {
  let system = renderPromptTemplate(INSIGHTS_TRANSLATION_BASE_TEMPLATE, {
    TARGET_LANGUAGE: targetLanguage,
  }).trimEnd()

  if (isJapanese) {
    system += INSIGHTS_TRANSLATION_JAPANESE_RUBY
  }

  return system
}

export interface CoverStylePreset {
  id: string
  label: string
  defaultAspectRatio: string
  compileSystemPrompt: string
  hardConstraints: string
  fallbackPrompt: string
}

const SIGNAL_GEOMETRY_ASPECT_RATIO = '16:9'

// Signal Geometry preset adapted from CaliCastle/skills, MIT
export const SIGNAL_GEOMETRY_PRESET: CoverStylePreset = {
  id: 'signal-geometry',
  label: 'Signal Geometry',
  defaultAspectRatio: SIGNAL_GEOMETRY_ASPECT_RATIO,
  compileSystemPrompt: renderPromptTemplate(COVER_SIGNAL_GEOMETRY_SYSTEM, {
    ASPECT_RATIO: SIGNAL_GEOMETRY_ASPECT_RATIO,
  }),
  hardConstraints: COVER_SIGNAL_GEOMETRY_HARD_CONSTRAINTS,
  fallbackPrompt: renderPromptTemplate(COVER_SIGNAL_GEOMETRY_FALLBACK, {
    ASPECT_RATIO: SIGNAL_GEOMETRY_ASPECT_RATIO,
  }),
}

export const COVER_STYLE_PRESETS: Record<string, CoverStylePreset> = {
  [SIGNAL_GEOMETRY_PRESET.id]: SIGNAL_GEOMETRY_PRESET,
}

const buildCoverCompileSystem = (preset: CoverStylePreset) =>
  `${preset.compileSystemPrompt.trimEnd()}\n${preset.hardConstraints}`

const buildCoverPrompt = (article: { title: string; summary: string }) =>
  `<<<TITLE
${article.title}
TITLE

<<<SUMMARY
${article.summary}
SUMMARY`

const buildCoverRecipeSchema = (preset: CoverStylePreset) =>
  Type.Object(
    {
      format: Type.Literal(preset.defaultAspectRatio),
      polarity: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
      family: Type.Union([
        Type.Literal('orbital'),
        Type.Literal('flow'),
        Type.Literal('signal'),
        Type.Literal('topology'),
        Type.Literal('layered'),
      ]),
      transformation: Type.String({
        description:
          'One concise active verb naming what moves, changes, or relates',
      }),
      geometry: Type.Union([
        Type.Literal('radial'),
        Type.Literal('bilateral'),
        Type.Literal('directional'),
        Type.Literal('paired'),
        Type.Literal('distributed'),
        Type.Literal('vertically staged'),
      ]),
      scaffold: Type.Union([
        Type.Literal('open field'),
        Type.Literal('faint grid'),
        Type.Literal('framed region'),
        Type.Literal('baseline'),
      ]),
      anchor: Type.Union([
        Type.Literal('off-white endpoint'),
        Type.Literal('central node'),
        Type.Literal('contrast line'),
        Type.Literal('structural void'),
        Type.Literal('none'),
      ]),
      accent: Type.Union([
        Type.Literal('none'),
        Type.Literal('coral'),
        Type.Literal('orange-red'),
        Type.Literal('cobalt'),
      ]),
      text: Type.Literal('none'),
    },
    { additionalProperties: false },
  )

const buildCoverCompileSchema = (preset: CoverStylePreset) =>
  Type.Object(
    {
      recipe: buildCoverRecipeSchema(preset),
      prompt: Type.String({
        description:
          'The compiled four-paragraph Signal Geometry image-generation prompt, in English',
      }),
    },
    { additionalProperties: false },
  )

export const AI_PROMPTS = {
  summary: (lang: string, text: string) => {
    const targetLanguage =
      LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]
    return {
      systemPrompt: SUMMARY_SYSTEM,
      prompt: `TARGET_LANGUAGE: ${targetLanguage}

<<<CONTENT
${text}
CONTENT`,
      schema: Type.Object(
        {
          summary: Type.String({
            description: `The summary of the input text in ${targetLanguage}, max ${AI_SUMMARY_MAX_WORDS} words.`,
          }),
        },
        { additionalProperties: false },
      ),
      reasoningEffort: NO_REASONING,
    }
  },
  summaryStream: (lang: string, text: string) => {
    const targetLanguage =
      LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]
    return {
      systemPrompt: SUMMARY_STREAM_SYSTEM,
      prompt: `TARGET_LANGUAGE: ${targetLanguage}

<<<CONTENT
${text}
CONTENT`,
      reasoningEffort: NO_REASONING,
    }
  },

  summaryTranslation: (targetLang: string, sourceSummary: string) => {
    const targetLanguage = LANGUAGE_CODE_TO_NAME[targetLang] || targetLang
    return {
      systemPrompt: SUMMARY_TRANSLATION_SYSTEM,
      prompt: `TARGET_LANGUAGE: ${targetLanguage}

<<<SOURCE_SUMMARY
${sourceSummary}
SOURCE_SUMMARY`,
      reasoningEffort: NO_REASONING,
    }
  },

  insights: (
    lang: string,
    article: {
      title: string
      text: string
      subtitle?: string
      tags?: string[]
    },
  ) => {
    const targetLanguage =
      LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]
    return {
      systemPrompt: buildInsightsSystem(false),
      prompt: buildInsightsPrompt(targetLanguage, article),
      reasoningEffort: NO_REASONING,
    }
  },
  insightsStream: (
    lang: string,
    article: {
      title: string
      text: string
      subtitle?: string
      tags?: string[]
    },
  ) => {
    const targetLanguage =
      LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]
    return {
      systemPrompt: buildInsightsSystem(true),
      prompt: buildInsightsPrompt(targetLanguage, article),
      reasoningEffort: NO_REASONING,
    }
  },

  insightsTranslation: (targetLang: string, sourceMarkdown: string) => {
    const targetLanguage = LANGUAGE_CODE_TO_NAME[targetLang] || targetLang
    const isJapanese = targetLang === 'ja'
    const systemPrompt = buildInsightsTranslationSystem(
      targetLanguage,
      isJapanese,
    )

    const prompt = `TARGET_LANGUAGE: ${targetLanguage}

<<<SOURCE_MARKDOWN
${sourceMarkdown}
SOURCE_MARKDOWN`

    return {
      systemPrompt,
      prompt,
      reasoningEffort: NO_REASONING,
    }
  },

  writer: {
    titleAndSlug: (text: string) => ({
      systemPrompt: TITLE_AND_SLUG_SYSTEM,
      prompt: `<<<CONTENT
${text}
CONTENT`,
      schema: Type.Object(
        {
          title: Type.String({
            description:
              'A concise, engaging title in the same language as the input text that captures the main topic.',
          }),
          slug: Type.String({
            description:
              'SEO-friendly slug in English. Lowercase, hyphens to separate words, alphanumeric only.',
          }),
          lang: Type.String({
            description:
              'ISO 639-1 language code of the input text (e.g., "en", "zh", "ja").',
          }),
          keywords: Type.Array(Type.String(), {
            description:
              '3-5 relevant keywords or key phrases representing the main topics.',
          }),
        },
        { additionalProperties: false },
      ),
      reasoningEffort: NO_REASONING,
    }),

    slug: (title: string) => ({
      systemPrompt: SLUG_SYSTEM,
      prompt: `<<<TITLE
${title}
TITLE`,
      schema: Type.Object(
        {
          slug: Type.String({
            description:
              'SEO-friendly slug in English. Lowercase, hyphens to separate words, alphanumeric only, concise with relevant keywords.',
          }),
        },
        { additionalProperties: false },
      ),
      reasoningEffort: NO_REASONING,
    }),
  },

  comment: {
    score: (text: string) => ({
      systemPrompt: COMMENT_SCORE_SYSTEM,
      prompt: `<<<COMMENT
${text}
COMMENT`,
      schema: Type.Object(
        {
          score: Type.Number({
            description: 'Risk score 1-10, higher means more dangerous',
          }),
          hasSensitiveContent: Type.Boolean({
            description:
              'Whether it contains politically sensitive, pornographic, violent, or threatening content',
          }),
        },
        { additionalProperties: false },
      ),
      reasoningEffort: NO_REASONING,
    }),

    spam: (text: string) => ({
      systemPrompt: COMMENT_SPAM_SYSTEM,
      prompt: `<<<COMMENT
${text}
COMMENT`,
      schema: Type.Object(
        {
          isSpam: Type.Boolean({
            description: 'Whether it is spam content',
          }),
          hasSensitiveContent: Type.Boolean({
            description:
              'Whether it contains politically sensitive, pornographic, violent, or threatening content',
          }),
        },
        { additionalProperties: false },
      ),
      reasoningEffort: NO_REASONING,
    }),
  },

  translationStream: (
    targetLang: string,
    content: {
      title: string
      text: string
      subtitle?: string
      summary?: string
      tags?: string[]
      styleHints?: string
    },
  ) => {
    const targetLanguage = LANGUAGE_CODE_TO_NAME[targetLang] || targetLang

    return {
      systemPrompt: buildTranslationSystem(targetLang, true),
      prompt: buildTranslationPrompt(targetLanguage, content),
      reasoningEffort: NO_REASONING,
    }
  },
  translationChunk: (
    targetLang: string,
    chunk: {
      documentContext: string
      textEntries: Record<string, unknown>
      segmentMeta?: Record<string, string>
      styleHints?: string
    },
  ) => {
    const targetLanguage = LANGUAGE_CODE_TO_NAME[targetLang] || targetLang
    return {
      systemPrompt: buildTranslationChunkSystem(targetLang),
      prompt: buildTranslationChunkPrompt(targetLanguage, chunk),
      schema: buildTranslationChunkSchema(chunk.textEntries),
      reasoningEffort: NO_REASONING,
    }
  },

  translationAgent: (targetLang: string, opts: { reviewEnabled: boolean }) => ({
    systemPrompt: buildTranslationAgentSystem(targetLang, opts),
    reasoningEffort: NO_REASONING,
  }),

  translationReviewer: (
    targetLang: string,
    payload: {
      allowedIds: string[]
      segments: Record<string, { source?: string; target: string }>
      styleHints?: string
    },
  ) => {
    const targetLanguage = LANGUAGE_CODE_TO_NAME[targetLang] || targetLang
    return {
      systemPrompt: TRANSLATION_REVIEWER_SYSTEM,
      prompt: buildTranslationReviewerPrompt(targetLanguage, payload),
      schema: REVIEWER_OUTPUT_SCHEMA,
      reasoningEffort: NO_REASONING,
    }
  },

  translationEditor: (
    targetLang: string,
    payload: {
      fullTranslations: Record<string, string>
      issues: Array<{
        id: string
        severity: 'minor' | 'major'
        problem: string
        hint?: string
      }>
      styleHints?: string
    },
  ) => {
    const targetLanguage = LANGUAGE_CODE_TO_NAME[targetLang] || targetLang
    return {
      systemPrompt: TRANSLATION_EDITOR_SYSTEM,
      prompt: buildTranslationEditorPrompt(targetLanguage, payload),
      schema: EDITOR_OUTPUT_SCHEMA,
      reasoningEffort: NO_REASONING,
    }
  },

  cover: {
    compile: (
      preset: CoverStylePreset,
      article: { title: string; summary: string },
    ) => ({
      systemPrompt: buildCoverCompileSystem(preset),
      prompt: buildCoverPrompt(article),
      schema: buildCoverCompileSchema(preset),
      reasoningEffort: NO_REASONING,
    }),
  },

  fieldTranslation: (targetLang: string, fields: Record<string, string>) => {
    const targetLanguage = LANGUAGE_CODE_TO_NAME[targetLang] || targetLang
    return {
      systemPrompt: FIELD_TRANSLATION_SYSTEM,
      prompt: `TARGET_LANGUAGE: ${targetLanguage}\n\n## Fields to translate\n${JSON.stringify(fields)}`,
      schema: Type.Object(
        {
          translations: Type.Record(Type.String(), Type.String(), {
            description: 'Map of key to translated text',
          }),
        },
        { additionalProperties: false },
      ),
      reasoningEffort: NO_REASONING,
    }
  },
}
