import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AIProviderType } from '~/modules/ai/ai.types'
import { runTranslationAgent } from '~/modules/ai/ai-translation/engine/translation-agent'
import { splitMarkdownIntoParagraphs } from '~/modules/ai/ai-translation/markdown-paragraph-splitter'
import type { PipelineMetrics } from '~/modules/ai/ai-translation/translation-strategy.interface'
import type { TranslationUnit } from '~/modules/ai/ai-translation/translation-unit.types'
import { PiRuntimeAdapter } from '~/modules/ai/runtime/pi-runtime.adapter'

const LIVE_ENABLED = process.env.RUN_LIVE_TESTS === '1'
const API_KEY = process.env.OPENROUTER_API_KEY
const ARTICLE_JSON = process.env.BENCH_ARTICLE_JSON
const OUT_DIR = process.env.BENCH_OUT_DIR
const TAG = process.env.BENCH_TAG || 'dev'
const MODEL = process.env.BENCH_TRANSLATOR_MODEL || 'deepseek/deepseek-v3.2'
const REVIEWER_MODEL = process.env.BENCH_REVIEWER_MODEL || MODEL

describe.skipIf(!LIVE_ENABLED || !API_KEY || !ARTICLE_JSON || !OUT_DIR)(
  'translation agent live bench',
  () => {
    it(
      `runs the agent path on ${TAG} article and records usage`,
      { timeout: 30 * 60_000 },
      async () => {
        const article = JSON.parse(readFileSync(ARTICLE_JSON!, 'utf8')) as {
          title: string
          text: string
        }
        const paragraphs = splitMarkdownIntoParagraphs(article.text)
        const units: TranslationUnit[] = [
          { id: '__title__', payload: article.title, meta: 'meta.title' },
          ...paragraphs.map((p) => ({
            id: p.id,
            payload: p.text,
            meta: 'text',
          })),
        ]

        const makeRuntime = (model: string) =>
          new PiRuntimeAdapter({
            apiKey: API_KEY!,
            endpoint: 'https://openrouter.ai/api/v1',
            model,
            providerType: AIProviderType.OpenAICompatible,
            providerId: 'openrouter',
          })
        const runtime = makeRuntime(MODEL)
        const reviewerRuntime = makeRuntime(REVIEWER_MODEL)

        const usageLog: Array<{
          input: number
          cacheRead: number
          output: number
          costUsd: number
        }> = []
        const reviewerLog: Array<{
          promptTokens?: number
          completionTokens?: number
          costUsd?: number
        }> = []
        const origStructured =
          reviewerRuntime.generateStructured.bind(reviewerRuntime)
        ;(reviewerRuntime as any).generateStructured = async (opts: any) => {
          const result = await origStructured(opts)
          reviewerLog.push({
            promptTokens: result.usage?.promptTokens,
            completionTokens: result.usage?.completionTokens,
            costUsd: result.usage?.cost,
          })
          return result
        }
        const orig = runtime.streamMessage!.bind(runtime)
        ;(runtime as any).streamMessage = (opts: any) => {
          const stream = orig(opts)
          return {
            async *[Symbol.asyncIterator]() {
              for await (const event of stream as any) {
                if (event.type === 'done' && event.message?.usage) {
                  const u = event.message.usage
                  usageLog.push({
                    input: u.input,
                    cacheRead: u.cacheRead,
                    output: u.output,
                    costUsd: u.cost?.total ?? 0,
                  })
                }
                yield event
              }
            },
            result: () => (stream as any).result(),
          }
        }

        const metrics: PipelineMetrics = {}
        const started = Date.now()
        const result = await runTranslationAgent({
          targetLang: 'ja',
          units,
          documentContext: `${article.title}\n\n${article.text.slice(0, 800)}`,
          styleHints: 'ARTICLE_TYPE: personal note (casual, diary-style)',
          runtime,
          reviewerRuntime,
          metrics,
        })
        const durationMs = Date.now() - started

        const title = result.translations.get('__title__') ?? article.title
        const body = paragraphs
          .map((p) => result.translations.get(p.id) ?? '')
          .join('\n\n')
        mkdirSync(OUT_DIR!, { recursive: true })
        writeFileSync(
          path.join(OUT_DIR!, `chunk_final_agent_${TAG}.md`),
          `# ${title}\n\n${body}`,
        )
        const totalInput = usageLog.reduce((sum, u) => sum + u.input, 0)
        const totalCached = usageLog.reduce((sum, u) => sum + u.cacheRead, 0)
        writeFileSync(
          path.join(OUT_DIR!, `agent_bench_meta_${TAG}.json`),
          JSON.stringify(
            {
              tag: TAG,
              model: MODEL,
              reviewerModel: REVIEWER_MODEL,
              durationMs,
              sourceLang: result.sourceLang,
              reviewerRounds: metrics.reviewer?.rounds,
              reviewerIssuesFinal: metrics.reviewer?.issuesCount,
              editorPatches: metrics.editor?.patches?.length ?? 0,
              turns: usageLog,
              reviewerCalls: reviewerLog,
              mainCostUsd: usageLog.reduce((sum, u) => sum + u.costUsd, 0),
              reviewerCostUsd: reviewerLog.reduce(
                (sum, u) => sum + (u.costUsd ?? 0),
                0,
              ),
              totalInput,
              totalCached,
              cacheHitRate:
                totalInput + totalCached > 0
                  ? totalCached / (totalInput + totalCached)
                  : 0,
            },
            null,
            2,
          ),
        )

        expect(result.translations.size).toBe(units.length)
        expect(body.length).toBeGreaterThan(0)
      },
    )
  },
)
