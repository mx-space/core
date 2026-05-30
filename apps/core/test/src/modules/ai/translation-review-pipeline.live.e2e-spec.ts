import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { config as loadEnv } from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AIProviderType } from '~/modules/ai/ai.types'
import {
  parseLexicalForTranslation,
  restoreLexicalTranslation,
} from '~/modules/ai/ai-translation/lexical-translation-parser'
import { splitMarkdownIntoParagraphs } from '~/modules/ai/ai-translation/markdown-paragraph-splitter'
import { TranslationReviewerService } from '~/modules/ai/ai-translation/reviewer.service'
import { LexicalTranslationStrategy } from '~/modules/ai/ai-translation/strategies/lexical-translation.strategy'
import { MarkdownTranslationStrategy } from '~/modules/ai/ai-translation/strategies/markdown-translation.strategy'
import type { PipelineMetrics } from '~/modules/ai/ai-translation/translation-strategy.interface'
import type { IModelRuntime } from '~/modules/ai/runtime'
import { createModelRuntime } from '~/modules/ai/runtime'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'

loadEnv({ path: resolve(__dirname, '../../../../.env') })

const LIVE_ENABLED = process.env.RUN_LIVE_TESTS === '1'

interface RuntimeEnv {
  provider: string
  endpoint: string
  apiKey: string
  model: string
}

function readRuntimeEnv(prefix: 'TRANSLATOR' | 'REVIEWER'): RuntimeEnv {
  const provider = (
    process.env[`SMOKE_${prefix}_PROVIDER`] ||
    process.env.SMOKE_PROVIDER ||
    'openrouter'
  ).toLowerCase()
  const endpoint =
    process.env[`SMOKE_${prefix}_ENDPOINT`] ||
    process.env.SMOKE_ENDPOINT ||
    (provider === 'openai-compatible'
      ? 'http://localhost:1234/v1'
      : 'https://openrouter.ai/api/v1')
  const apiKey =
    process.env[`SMOKE_${prefix}_API_KEY`] ||
    process.env.SMOKE_API_KEY ||
    process.env.OPENROUTER_TOKEN ||
    process.env.OPENROUTER_API_KEY ||
    (provider === 'openai-compatible' ? 'lm-studio' : '')
  const model =
    process.env[`SMOKE_${prefix}_MODEL`] ||
    (provider === 'openai-compatible'
      ? 'hy-mt2-7b'
      : 'deepseek/deepseek-v4-pro')
  return { provider, endpoint, apiKey, model }
}

const TRANSLATOR_ENV = readRuntimeEnv('TRANSLATOR')
const REVIEWER_ENV = readRuntimeEnv('REVIEWER')

const TOKEN = TRANSLATOR_ENV.apiKey || REVIEWER_ENV.apiKey
const TRANSLATOR_MODEL = TRANSLATOR_ENV.model
const REVIEWER_MODEL = REVIEWER_ENV.model

const REPO_ROOT = resolve(__dirname, '../../../../../..')
const FIXTURES_DIR = join(REPO_ROOT, 'data/lexical')
const REPORT_DIR = resolve(__dirname, '../../../../tmp')

type CaseReport = {
  caseName: string
  direction: { source: string; target: string }
  timings: {
    writerMs: number
    reviewerMs: number | null
    editorMs: number | null
  }
  writer: {
    segmentCount: number
    nonEmptyCount: number
    targetLangCharRatio: number
    detectedSourceLang: string
    sampleSegments: Array<{ id: string; source: string; output: string }>
  }
  reviewer: {
    invoked: boolean
    durationMs: number
    skippedReason: string | null
    score: number | null
    issuesCount: number
    issuesBySeverity: { minor: number; major: number }
    issueIds: string[]
    sampleIssues: Array<{ id: string; problem: string; hint?: string }>
  } | null
  editor: {
    invoked: boolean
    durationMs: number
    skippedReason: string | null
    patchKeysRequested: string[]
    patchKeysApplied: string[]
    patchKeysDropped: string[]
    addressedIssueRatio: number
    samplePatches: Array<{ id: string; before: string; after: string }>
  } | null
  quality: {
    rereviewScore: number
    rereviewIssuesCount: number
    scoreDelta: number
    issuesDelta: number
  } | null
  structure: {
    lexical?: {
      sourceSegmentCount: number
      outputSegmentCount: number
      roundTripParses: boolean
    }
    markdown?: {
      paragraphCountSource: number
      paragraphCountOutput: number
      fencedCodeBlocksPreserved: boolean
    }
  }
}

const reports: CaseReport[] = []

function consumeMetrics(report: CaseReport, metrics: PipelineMetrics): void {
  if (typeof metrics.writerMs === 'number') {
    report.timings.writerMs = metrics.writerMs
  }
  if (metrics.reviewer) {
    report.timings.reviewerMs = metrics.reviewer.durationMs
    report.reviewer = {
      invoked: metrics.reviewer.invoked,
      durationMs: metrics.reviewer.durationMs,
      skippedReason: metrics.reviewer.skippedReason,
      score: metrics.reviewer.score,
      issuesCount: metrics.reviewer.issuesCount,
      issuesBySeverity: metrics.reviewer.issuesBySeverity,
      issueIds: metrics.reviewer.issueIds,
      sampleIssues: metrics.reviewer.issues.slice(0, 5).map((i) => ({
        id: i.id,
        problem: i.problem,
        hint: i.hint,
      })),
    }
  }
  if (metrics.editor) {
    report.timings.editorMs = metrics.editor.durationMs
    const addressedIssueRatio = metrics.reviewer?.issuesCount
      ? metrics.editor.patchKeysApplied.length / metrics.reviewer.issuesCount
      : 0
    report.editor = {
      invoked: metrics.editor.invoked,
      durationMs: metrics.editor.durationMs,
      skippedReason: metrics.editor.skippedReason,
      patchKeysRequested: metrics.editor.patchKeysRequested,
      patchKeysApplied: metrics.editor.patchKeysApplied,
      patchKeysDropped: metrics.editor.patchKeysDropped,
      addressedIssueRatio,
      samplePatches: metrics.editor.patches.slice(0, 5),
    }
  }
}

async function runLexicalQualityProbe(
  reviewerService: TranslationReviewerService,
  reviewerRuntime: IModelRuntime,
  targetLang: string,
  result: {
    title: string
    content: string | undefined | null
    subtitle: string | null
    summary: string | null
    tags: string[] | null
  },
): Promise<{ score: number; issuesCount: number } | null> {
  if (!result.content) return null
  const parsed = parseLexicalForTranslation(result.content)
  const fullTranslations: Record<string, string> = {
    __title__: result.title,
  }
  if (result.subtitle) fullTranslations.__subtitle__ = result.subtitle
  if (result.summary) fullTranslations.__summary__ = result.summary
  if (result.tags?.length) fullTranslations.__tags__ = result.tags.join('|||')
  for (const seg of parsed.segments) {
    if (seg.translatable && seg.text) fullTranslations[seg.id] = seg.text
  }
  const allowedIds = Object.keys(fullTranslations)
  const probe = await reviewerService.callReviewer(
    reviewerRuntime,
    targetLang,
    { allowedIds, fullTranslations },
  )
  if (!probe) return null
  return { score: probe.score, issuesCount: probe.issues.length }
}

async function runMarkdownQualityProbe(
  reviewerService: TranslationReviewerService,
  reviewerRuntime: IModelRuntime,
  targetLang: string,
  result: {
    title: string
    text: string
    subtitle: string | null
    summary: string | null
    tags: string[] | null
  },
): Promise<{ score: number; issuesCount: number } | null> {
  const fullTranslations: Record<string, string> = {
    __title__: result.title,
  }
  if (result.subtitle) fullTranslations.__subtitle__ = result.subtitle
  if (result.summary) fullTranslations.__summary__ = result.summary
  if (result.tags?.length) fullTranslations.__tags__ = result.tags.join('|||')
  for (const paragraph of splitMarkdownIntoParagraphs(result.text)) {
    fullTranslations[paragraph.id] = paragraph.text
  }
  const allowedIds = Object.keys(fullTranslations)
  const probe = await reviewerService.callReviewer(
    reviewerRuntime,
    targetLang,
    { allowedIds, fullTranslations },
  )
  if (!probe) return null
  return { score: probe.score, issuesCount: probe.issues.length }
}

function targetLangCharRatio(text: string, lang: string): number {
  if (!text) return 0
  const chars = [...text]
  const nonAscii = chars.filter((c) => c.charCodeAt(0) > 127)
  if (nonAscii.length === 0) {
    return lang === 'en' ? 1 : 0
  }
  if (lang === 'en') {
    const asciiLetters = chars.filter((c) => /[a-z]/i.test(c))
    return asciiLetters.length / Math.max(1, chars.length)
  }
  const target = nonAscii.filter((c) => {
    const code = c.codePointAt(0) ?? 0
    if (lang === 'ja') {
      // hiragana 3040-309F, katakana 30A0-30FF, kanji 4E00-9FFF
      return (
        (code >= 0x3040 && code <= 0x309f) ||
        (code >= 0x30a0 && code <= 0x30ff) ||
        (code >= 0x4e00 && code <= 0x9fff)
      )
    }
    if (lang === 'zh') {
      // CJK Unified Ideographs (no kana)
      return code >= 0x4e00 && code <= 0x9fff
    }
    return false
  })
  return target.length / nonAscii.length
}

function makeRuntime(env: RuntimeEnv): IModelRuntime {
  // After step-3a the enum collapsed to 3 values; OpenRouter rows are routed
  // via the OpenAICompatible runtime + endpoint resolution in the pi adapter.
  const providerType = AIProviderType.OpenAICompatible
  return createModelRuntime({
    id: `smoke-${env.provider}`,
    name: `Smoke ${env.provider}`,
    type: providerType,
    apiKey: env.apiKey,
    endpoint: env.endpoint,
    defaultModel: env.model,
    enabled: true,
  })
}

function loadFixture(name: string): { json: string; lang: string } {
  const json = readFileSync(join(FIXTURES_DIR, name), 'utf8')
  return { json, lang: 'zh' }
}

function truncateLexicalJson(json: string, maxParagraphs = 6): string {
  const doc = JSON.parse(json)
  if (
    Array.isArray(doc?.root?.children) &&
    doc.root.children.length > maxParagraphs
  ) {
    doc.root.children = doc.root.children.slice(0, maxParagraphs)
  }
  return JSON.stringify(doc)
}

function blankReport(
  caseName: string,
  direction: { source: string; target: string },
): CaseReport {
  return {
    caseName,
    direction,
    timings: { writerMs: 0, reviewerMs: null, editorMs: null },
    writer: {
      segmentCount: 0,
      nonEmptyCount: 0,
      targetLangCharRatio: 0,
      detectedSourceLang: '',
      sampleSegments: [],
    },
    reviewer: null,
    editor: null,
    quality: null,
    structure: {},
  }
}

function formatSampleSnippet(text: string, max = 160): string {
  if (!text) return '(empty)'
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}

function writeReport(): void {
  if (reports.length === 0) return
  mkdirSync(REPORT_DIR, { recursive: true })
  const timestamp = new Date().toISOString().replaceAll(/[.:]/g, '-')
  const filePath = join(REPORT_DIR, `translation-review-smoke-${timestamp}.md`)

  const lines: string[] = [
    `# Translation Review Pipeline — Smoke Report`,
    ``,
    `**Generated:** ${new Date().toISOString()}`,
    `**Translator model:** \`${TRANSLATOR_MODEL}\``,
    `**Reviewer model:** \`${REVIEWER_MODEL}\``,
    ``,
  ]

  for (const r of reports) {
    lines.push(`## ${r.caseName}`)
    lines.push(``)
    lines.push(`**Direction:** ${r.direction.source} → ${r.direction.target}`)
    lines.push(
      `**Timings:** writer ${r.timings.writerMs}ms · reviewer ${r.timings.reviewerMs ?? 'n/a'}ms · editor ${r.timings.editorMs ?? 'n/a'}ms`,
    )
    lines.push(``)

    lines.push(`### 1. Initial writer output`)
    lines.push(
      `- segments: ${r.writer.nonEmptyCount} / ${r.writer.segmentCount} non-empty`,
    )
    lines.push(
      `- target-language char ratio: ${r.writer.targetLangCharRatio.toFixed(2)}`,
    )
    lines.push(`- detected sourceLang: ${r.writer.detectedSourceLang}`)
    if (r.writer.sampleSegments.length > 0) {
      lines.push(`- samples:`)
      for (const sample of r.writer.sampleSegments) {
        lines.push(
          `  - **${sample.id}**: \`${formatSampleSnippet(sample.source)}\` → \`${formatSampleSnippet(sample.output)}\``,
        )
      }
    }
    lines.push(``)

    lines.push(`### 2. Revise step`)
    if (!r.reviewer) {
      lines.push(`- reviewer: not invoked (review disabled)`)
    } else if (r.reviewer.skippedReason) {
      lines.push(`- reviewer: skipped (${r.reviewer.skippedReason})`)
    } else {
      lines.push(`- reviewer score: ${r.reviewer.score}`)
      lines.push(
        `- issues: ${r.reviewer.issuesCount} (minor: ${r.reviewer.issuesBySeverity.minor}, major: ${r.reviewer.issuesBySeverity.major})`,
      )
      if (r.reviewer.sampleIssues.length > 0) {
        lines.push(`- sample issues:`)
        for (const issue of r.reviewer.sampleIssues) {
          lines.push(
            `  - **${issue.id}**: ${issue.problem}${issue.hint ? ` (hint: ${issue.hint})` : ''}`,
          )
        }
      }
    }

    if (r.editor) {
      lines.push(
        `- editor invoked: ${r.editor.invoked}${r.editor.skippedReason ? ` (skipped: ${r.editor.skippedReason})` : ''}`,
      )
      lines.push(
        `- patches: ${r.editor.patchKeysApplied.length} applied, ${r.editor.patchKeysDropped.length} dropped`,
      )
      lines.push(
        `- addressedIssueRatio: ${r.editor.addressedIssueRatio.toFixed(2)}`,
      )
      if (r.editor.samplePatches.length > 0) {
        lines.push(`- before / after samples:`)
        for (const patch of r.editor.samplePatches) {
          lines.push(
            `  - **${patch.id}**: \`${formatSampleSnippet(patch.before)}\` → \`${formatSampleSnippet(patch.after)}\``,
          )
        }
      }
    } else {
      lines.push(`- editor: not invoked`)
    }
    lines.push(``)

    lines.push(`### 3. Quality after edit`)
    if (r.quality) {
      lines.push(
        `- re-review score: ${r.quality.rereviewScore} (Δ ${r.quality.scoreDelta >= 0 ? '+' : ''}${r.quality.scoreDelta})`,
      )
      lines.push(
        `- re-review issues: ${r.quality.rereviewIssuesCount} (Δ ${r.quality.issuesDelta >= 0 ? '+' : ''}${r.quality.issuesDelta})`,
      )
    } else {
      lines.push(`- quality probe not run`)
    }
    lines.push(``)

    lines.push(`### 4. Structural fidelity`)
    if (r.structure.lexical) {
      const s = r.structure.lexical
      lines.push(
        `- segment count source/output: ${s.sourceSegmentCount} / ${s.outputSegmentCount}`,
      )
      lines.push(`- round-trip parse: ${s.roundTripParses ? 'ok' : 'FAILED'}`)
    } else if (r.structure.markdown) {
      const s = r.structure.markdown
      lines.push(
        `- paragraph count source/output: ${s.paragraphCountSource} / ${s.paragraphCountOutput}`,
      )
      lines.push(
        `- fenced code blocks preserved: ${s.fencedCodeBlocksPreserved ? 'yes' : 'NO'}`,
      )
    }
    lines.push(``)
  }

  writeFileSync(filePath, lines.join('\n'), 'utf8')
  console.info(`[smoke] report written to ${filePath}`)
}

describe.skipIf(!LIVE_ENABLED || !TOKEN)(
  'translation review pipeline (live)',
  () => {
    let translatorRuntime: IModelRuntime
    let reviewerRuntime: IModelRuntime
    let reviewerService: TranslationReviewerService
    let lexicalService: LexicalService
    let lexicalStrategy: LexicalTranslationStrategy
    let markdownStrategy: MarkdownTranslationStrategy

    beforeAll(() => {
      translatorRuntime = makeRuntime(TRANSLATOR_ENV)
      reviewerRuntime = makeRuntime(REVIEWER_ENV)
      reviewerService = new TranslationReviewerService()
      lexicalService = new LexicalService()
      lexicalStrategy = new LexicalTranslationStrategy(
        lexicalService,
        reviewerService,
      )
      markdownStrategy = new MarkdownTranslationStrategy(reviewerService)
    })

    afterAll(() => {
      writeReport()
    })

    it(
      'Case 1 — Lexical zh → en (full pipeline)',
      { timeout: 600_000 },
      async () => {
        const report = blankReport('Case 1 — Lexical zh → en', {
          source: 'zh',
          target: 'en',
        })
        const fixture = loadFixture('sample-1.json')
        const truncated = truncateLexicalJson(fixture.json, 4)
        const parseBefore = parseLexicalForTranslation(truncated)

        const metrics: PipelineMetrics = {}
        const result = await lexicalStrategy.translate(
          {
            title: '当 AI 占满生活',
            text: '',
            subtitle: null,
            summary: null,
            tags: null,
            content: truncated,
            contentFormat: ContentFormat.Lexical,
          },
          'en',
          translatorRuntime,
          { model: TRANSLATOR_MODEL, provider: 'openrouter' },
          {
            reviewerRuntime,
            reviewScoreThreshold: 95,
            metrics,
          },
        )
        consumeMetrics(report, metrics)

        const probe = await runLexicalQualityProbe(
          reviewerService,
          reviewerRuntime,
          'en',
          {
            title: result.title,
            content: result.content,
            subtitle: result.subtitle,
            summary: result.summary,
            tags: result.tags,
          },
        )
        if (
          probe &&
          metrics.reviewer?.score !== null &&
          metrics.reviewer?.score !== undefined
        ) {
          report.quality = {
            rereviewScore: probe.score,
            rereviewIssuesCount: probe.issuesCount,
            scoreDelta: probe.score - metrics.reviewer.score,
            issuesDelta: probe.issuesCount - metrics.reviewer.issuesCount,
          }
        }

        report.writer.detectedSourceLang = result.sourceLang
        const parseAfter = parseLexicalForTranslation(result.content!)
        report.structure.lexical = {
          sourceSegmentCount: parseBefore.segments.length,
          outputSegmentCount: parseAfter.segments.length,
          roundTripParses: true,
        }
        const segCount = parseAfter.segments.length
        const nonEmpty = parseAfter.segments.filter(
          (s) => s.text.trim().length > 0,
        ).length
        report.writer.segmentCount = segCount
        report.writer.nonEmptyCount = nonEmpty
        report.writer.targetLangCharRatio = targetLangCharRatio(
          result.text,
          'en',
        )
        report.writer.sampleSegments = parseBefore.segments
          .slice(0, 5)
          .map((s, i) => ({
            id: s.id,
            source: s.text,
            output: parseAfter.segments[i]?.text ?? '',
          }))

        reports.push(report)

        expect(segCount).toBeGreaterThan(0)
        expect(nonEmpty).toBe(segCount)
        expect(report.writer.targetLangCharRatio).toBeGreaterThan(0.5)
        expect(result.text).not.toContain('undefined')
        expect(result.text).not.toContain('[object Object]')
        expect(parseBefore.segments.length).toBe(parseAfter.segments.length)

        const restored = restoreLexicalTranslation(
          parseBefore,
          new Map(
            parseAfter.segments.map((s) => [
              parseBefore.segments[parseAfter.segments.indexOf(s)]?.id ?? s.id,
              s.text,
            ]),
          ),
        )
        expect(restored).toBeTruthy()
      },
    )

    it(
      'Case 2 — Lexical zh → ja (full pipeline)',
      { timeout: 600_000 },
      async () => {
        const report = blankReport('Case 2 — Lexical zh → ja', {
          source: 'zh',
          target: 'ja',
        })
        const fixture = loadFixture('sample-2.json')
        const truncated = truncateLexicalJson(fixture.json, 4)
        const parseBefore = parseLexicalForTranslation(truncated)

        const metrics: PipelineMetrics = {}
        const result = await lexicalStrategy.translate(
          {
            title: 'AI 协作工程笔记',
            text: '',
            subtitle: null,
            summary: null,
            tags: null,
            content: truncated,
            contentFormat: ContentFormat.Lexical,
          },
          'ja',
          translatorRuntime,
          { model: TRANSLATOR_MODEL, provider: 'openrouter' },
          {
            reviewerRuntime,
            reviewScoreThreshold: 95,
            metrics,
          },
        )
        consumeMetrics(report, metrics)

        const probe = await runLexicalQualityProbe(
          reviewerService,
          reviewerRuntime,
          'ja',
          {
            title: result.title,
            content: result.content,
            subtitle: result.subtitle,
            summary: result.summary,
            tags: result.tags,
          },
        )
        if (
          probe &&
          metrics.reviewer?.score !== null &&
          metrics.reviewer?.score !== undefined
        ) {
          report.quality = {
            rereviewScore: probe.score,
            rereviewIssuesCount: probe.issuesCount,
            scoreDelta: probe.score - metrics.reviewer.score,
            issuesDelta: probe.issuesCount - metrics.reviewer.issuesCount,
          }
        }

        report.writer.detectedSourceLang = result.sourceLang
        const parseAfter = parseLexicalForTranslation(result.content!)
        report.structure.lexical = {
          sourceSegmentCount: parseBefore.segments.length,
          outputSegmentCount: parseAfter.segments.length,
          roundTripParses: true,
        }
        const segCount = parseAfter.segments.length
        const nonEmpty = parseAfter.segments.filter(
          (s) => s.text.trim().length > 0,
        ).length
        report.writer.segmentCount = segCount
        report.writer.nonEmptyCount = nonEmpty
        report.writer.targetLangCharRatio = targetLangCharRatio(
          result.text,
          'ja',
        )
        report.writer.sampleSegments = parseBefore.segments
          .slice(0, 5)
          .map((s, i) => ({
            id: s.id,
            source: s.text,
            output: parseAfter.segments[i]?.text ?? '',
          }))

        reports.push(report)

        expect(segCount).toBeGreaterThan(0)
        expect(nonEmpty).toBe(segCount)
        expect(report.writer.targetLangCharRatio).toBeGreaterThan(0.4)
        expect(result.text).not.toContain('undefined')
        expect(result.text).not.toContain('[object Object]')
        expect(parseBefore.segments.length).toBe(parseAfter.segments.length)
      },
    )

    it(
      'Case 3 — Markdown en → ja with code fence',
      { timeout: 600_000 },
      async () => {
        const report = blankReport('Case 3 — Markdown en → ja', {
          source: 'en',
          target: 'ja',
        })
        const sourceText = [
          'I have been working on this side project for three months now.',
          '',
          'The hardest part was not the technical implementation; it was deciding what NOT to build.',
          '',
          '```ts',
          'function add(a: number, b: number) {',
          '  return a + b',
          '}',
          '```',
          '',
          'Looking back, I would do many things differently.',
          '',
          '- Ship early',
          '- Cut scope ruthlessly',
          '- Talk to users',
        ].join('\n')
        const sourceParas = splitMarkdownIntoParagraphs(sourceText)

        const metrics: PipelineMetrics = {}
        const result = await markdownStrategy.translate(
          {
            title: 'Three Months of Side Project',
            text: sourceText,
            subtitle: 'A retrospective on what I learned',
            summary: null,
            tags: ['side-project', 'reflection'],
            contentFormat: ContentFormat.Markdown,
          },
          'ja',
          translatorRuntime,
          { model: TRANSLATOR_MODEL, provider: 'openrouter' },
          {
            reviewerRuntime,
            reviewScoreThreshold: 95,
            metrics,
          },
        )
        consumeMetrics(report, metrics)

        const probe = await runMarkdownQualityProbe(
          reviewerService,
          reviewerRuntime,
          'ja',
          {
            title: result.title,
            text: result.text,
            subtitle: result.subtitle,
            summary: result.summary,
            tags: result.tags,
          },
        )
        if (
          probe &&
          metrics.reviewer?.score !== null &&
          metrics.reviewer?.score !== undefined
        ) {
          report.quality = {
            rereviewScore: probe.score,
            rereviewIssuesCount: probe.issuesCount,
            scoreDelta: probe.score - metrics.reviewer.score,
            issuesDelta: probe.issuesCount - metrics.reviewer.issuesCount,
          }
        }

        const outParas = splitMarkdownIntoParagraphs(result.text)
        const codeFencesPreserved = result.text.includes('```')
        report.structure.markdown = {
          paragraphCountSource: sourceParas.length,
          paragraphCountOutput: outParas.length,
          fencedCodeBlocksPreserved: codeFencesPreserved,
        }
        report.writer.detectedSourceLang = result.sourceLang
        report.writer.segmentCount = outParas.length + 1
        report.writer.nonEmptyCount =
          outParas.filter((p) => p.text.trim().length > 0).length +
          (result.title ? 1 : 0)
        report.writer.targetLangCharRatio = targetLangCharRatio(
          result.text,
          'ja',
        )
        report.writer.sampleSegments = [
          {
            id: '__title__',
            source: 'Three Months of Side Project',
            output: result.title,
          },
          ...sourceParas.slice(0, 3).map((p, i) => ({
            id: p.id,
            source: p.text,
            output: outParas[i]?.text ?? '',
          })),
        ]

        reports.push(report)

        expect(result.title).toBeTruthy()
        expect(result.text).toBeTruthy()
        expect(codeFencesPreserved).toBe(true)
        expect(result.text).toContain('function add')
        expect(report.writer.targetLangCharRatio).toBeGreaterThan(0.3)
        expect(sourceParas.length).toBe(outParas.length)
        expect(result.text).not.toContain('undefined')
        expect(result.text).not.toContain('[object Object]')
      },
    )

    it(
      'Case 5 — Reviewer skipped on threshold (deterministic)',
      { timeout: 180_000 },
      async () => {
        const report = blankReport('Case 5 — Threshold skip', {
          source: 'en',
          target: 'ja',
        })

        const sourceText = 'A very short test paragraph.'
        const metrics: PipelineMetrics = {}
        const result = await markdownStrategy.translate(
          {
            title: 'Threshold test',
            text: sourceText,
            subtitle: null,
            summary: null,
            tags: null,
            contentFormat: ContentFormat.Markdown,
          },
          'ja',
          translatorRuntime,
          { model: TRANSLATOR_MODEL, provider: 'openrouter' },
          {
            reviewerRuntime,
            reviewScoreThreshold: 0,
            metrics,
          },
        )
        consumeMetrics(report, metrics)
        report.writer.detectedSourceLang = result.sourceLang
        const outParas = splitMarkdownIntoParagraphs(result.text)
        report.structure.markdown = {
          paragraphCountSource: 1,
          paragraphCountOutput: outParas.length,
          fencedCodeBlocksPreserved: true,
        }
        report.writer.segmentCount = outParas.length + 1
        report.writer.nonEmptyCount = outParas.length + 1
        report.writer.targetLangCharRatio = targetLangCharRatio(
          result.text,
          'ja',
        )

        reports.push(report)

        expect(result.text).toBeTruthy()
        expect(result.title).toBeTruthy()
      },
    )

    it(
      'Case 6 — Review disabled (no reviewer runtime)',
      { timeout: 180_000 },
      async () => {
        const report = blankReport('Case 6 — Review disabled', {
          source: 'en',
          target: 'ja',
        })

        const sourceText =
          'Another short paragraph for the disabled-review path.'
        const metrics: PipelineMetrics = {}
        const result = await markdownStrategy.translate(
          {
            title: 'Disabled test',
            text: sourceText,
            subtitle: null,
            summary: null,
            tags: null,
            contentFormat: ContentFormat.Markdown,
          },
          'ja',
          translatorRuntime,
          { model: TRANSLATOR_MODEL, provider: 'openrouter' },
          { metrics },
        )
        consumeMetrics(report, metrics)
        report.writer.detectedSourceLang = result.sourceLang
        report.writer.segmentCount = 1
        report.writer.nonEmptyCount = result.text ? 1 : 0
        report.writer.targetLangCharRatio = targetLangCharRatio(
          result.text,
          'ja',
        )
        report.structure.markdown = {
          paragraphCountSource: 1,
          paragraphCountOutput: splitMarkdownIntoParagraphs(result.text).length,
          fencedCodeBlocksPreserved: true,
        }

        reports.push(report)

        expect(result.text).toBeTruthy()
      },
    )
  },
)
