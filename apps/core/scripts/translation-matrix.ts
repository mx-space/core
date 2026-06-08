#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config as loadEnv } from 'dotenv'

import { AI_PROMPTS } from '../src/modules/ai/ai.prompts'
import {
  type AIProviderConfig,
  AIProviderType,
} from '../src/modules/ai/ai.types'
import type { ArticleContent } from '../src/modules/ai/ai-translation/ai-translation.types'
import { TranslationReviewerService } from '../src/modules/ai/ai-translation/reviewer.service'
import { LexicalTranslationStrategy } from '../src/modules/ai/ai-translation/strategies/lexical-translation.strategy'
import { createModelRuntime } from '../src/modules/ai/runtime'
import { LexicalService } from '../src/processors/helper/helper.lexical.service'
import { ContentFormat } from '../src/shared/types/content-format.type'
import { extractDocumentContext } from '../src/utils/content.util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')

loadEnv({ path: resolve(repoRoot, '.env'), quiet: true })
loadEnv({ path: resolve(repoRoot, 'apps/core/.env'), quiet: true })

interface MatrixEntry {
  label: string
  providerId: string
  providerType: AIProviderType
  model: string
  apiKeyEnv: string
  endpoint?: string
  forceTextMode?: boolean
}

const MATRIX: MatrixEntry[] = [
  {
    label: 'MiniMax M3',
    providerId: 'openrouter',
    providerType: AIProviderType.OpenAICompatible,
    model: 'minimax/minimax-m3',
    apiKeyEnv: 'OPENROUTER_TOKEN',
    endpoint: 'https://openrouter.ai/api/v1',
    forceTextMode: true,
  },
  {
    label: 'DeepSeek V4 Pro',
    providerId: 'openrouter',
    providerType: AIProviderType.OpenAICompatible,
    model: 'deepseek/deepseek-v4-pro',
    apiKeyEnv: 'OPENROUTER_TOKEN',
    endpoint: 'https://openrouter.ai/api/v1',
  },
]

const SAMPLE_FILE = resolve(repoRoot, 'data/lexical/sample-1.json')
const TARGET_LANG = readArg('--target') ?? process.env.MX_AI_TARGET_LANG ?? 'en'
const OUT_DIR = resolve(
  repoRoot,
  readArg('--out') ?? 'tmp/translation-matrix',
)
const JUDGE_MODEL =
  readArg('--judge') ?? 'anthropic/claude-opus-4.6'
const JUDGE_API_KEY = process.env.OPENROUTER_TOKEN ?? ''
const JUDGE_ENDPOINT = 'https://openrouter.ai/api/v1'

function readArg(name: string): string | undefined {
  const prefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.indexOf(name)
  if (index >= 0) return process.argv[index + 1]
}

function ensureKey(entry: MatrixEntry): string {
  const key = process.env[entry.apiKeyEnv]
  if (!key) {
    throw new Error(`Missing env ${entry.apiKeyEnv} for ${entry.label}`)
  }
  return key
}

function buildProviderConfig(entry: MatrixEntry): AIProviderConfig {
  return {
    apiKey: ensureKey(entry),
    defaultModel: entry.model,
    enabled: true,
    endpoint: entry.endpoint,
    id: entry.providerId,
    name: entry.label,
    type: entry.providerType,
  }
}

function buildArticleFromRawLexical(file: string, lexical: any): ArticleContent {
  const content = JSON.stringify(lexical)
  const firstText = findFirstText(lexical) ?? file
  return {
    title: firstText.slice(0, 60),
    text: extractDocumentContext(lexical.root?.children ?? []),
    content,
    contentFormat: ContentFormat.Lexical,
  }
}

function findFirstText(node: any): string | null {
  if (!node || typeof node !== 'object') return null
  if (
    node.type === 'text' &&
    typeof node.text === 'string' &&
    node.text.trim()
  ) {
    return node.text
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      const t = findFirstText(c)
      if (t) return t
    }
  }
  if (node.root) return findFirstText(node.root)
  return null
}

function collectTextLeaves(node: any, out: string[]): void {
  if (!node || typeof node !== 'object') return
  if (node.type === 'text' && typeof node.text === 'string') {
    out.push(node.text)
    return
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) collectTextLeaves(c, out)
  }
  if (node.root) collectTextLeaves(node.root, out)
}

function collectNodeTypeCounts(value: unknown): Map<string, number> {
  const counts = new Map<string, number>()
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (!Array.isArray(node)) {
      const t = (node as Record<string, unknown>).type
      if (typeof t === 'string') counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    for (const child of Array.isArray(node)
      ? node
      : Object.values(node as Record<string, unknown>)) {
      visit(child)
    }
  }
  visit(value)
  return counts
}

interface RunOutcome {
  label: string
  model: string
  provider: string
  ok: boolean
  durationMs: number
  sourceLang: string | null
  translatedTitle: string | null
  translatedTextLength: number
  translatedTextExcerpt: string
  translatedTextFull: string
  nodeTypeDiff: string[]
  translatedLexical: unknown
  translatedTextLeaves: number
  sourceTextLeaves: number
  error: string | null
}

async function runOne(
  entry: MatrixEntry,
  article: ArticleContent,
  sourceLexical: any,
): Promise<RunOutcome> {
  const lexicalService = new LexicalService()
  const reviewerService = new TranslationReviewerService()
  const strategy = new LexicalTranslationStrategy(
    lexicalService,
    reviewerService,
  )

  let runtime
  try {
    runtime = createModelRuntime(buildProviderConfig(entry))
    if (entry.forceTextMode) {
      ;(runtime as any).streamStructured = undefined
      ;(runtime as any).generateStructured = undefined
    }
  } catch (err: any) {
    return {
      label: entry.label,
      model: entry.model,
      provider: entry.providerId,
      ok: false,
      durationMs: 0,
      sourceLang: null,
      translatedTitle: null,
      translatedTextLength: 0,
      translatedTextExcerpt: '',
      translatedTextFull: '',
      nodeTypeDiff: [],
      translatedLexical: null,
      translatedTextLeaves: 0,
      sourceTextLeaves: 0,
      error: err.message,
    }
  }

  const startedAt = Date.now()
  try {
    const result = await strategy.translate(
      article,
      TARGET_LANG,
      runtime,
      { model: entry.model, provider: runtime.providerInfo.type },
      {},
    )
    const durationMs = Date.now() - startedAt
    const translatedLexical = result.content
      ? JSON.parse(result.content)
      : null

    const sourceCounts = collectNodeTypeCounts(sourceLexical)
    const transCounts = collectNodeTypeCounts(translatedLexical)
    const nodeTypeDiff: string[] = []
    for (const [t, c] of sourceCounts) {
      const n = transCounts.get(t) ?? 0
      if (n !== c) nodeTypeDiff.push(`${t}: ${c} -> ${n}`)
    }

    const sourceLeaves: string[] = []
    const transLeaves: string[] = []
    collectTextLeaves(sourceLexical, sourceLeaves)
    collectTextLeaves(translatedLexical, transLeaves)

    return {
      label: entry.label,
      model: entry.model,
      provider: entry.providerId,
      ok: true,
      durationMs,
      sourceLang: result.sourceLang,
      translatedTitle: result.title,
      translatedTextLength: result.text.length,
      translatedTextExcerpt: result.text.slice(0, 1200),
      translatedTextFull: result.text,
      nodeTypeDiff,
      translatedLexical,
      translatedTextLeaves: transLeaves.length,
      sourceTextLeaves: sourceLeaves.length,
      error: null,
    }
  } catch (err: any) {
    return {
      label: entry.label,
      model: entry.model,
      provider: entry.providerId,
      ok: false,
      durationMs: Date.now() - startedAt,
      sourceLang: null,
      translatedTitle: null,
      translatedTextLength: 0,
      translatedTextExcerpt: '',
      translatedTextFull: '',
      nodeTypeDiff: [],
      translatedLexical: null,
      translatedTextLeaves: 0,
      sourceTextLeaves: 0,
      error: err.stack ?? err.message ?? String(err),
    }
  }
}

interface JudgeScore {
  adequacy: number
  fluency: number
  localization: number
  tone: number
  structure: number
  verdict: 'pass' | 'borderline' | 'fail'
  reasons: string[]
}

async function judgeOne(
  source: string,
  translated: string,
  label: string,
): Promise<JudgeScore | null> {
  if (!JUDGE_API_KEY) return null
  const messages = [
    {
      role: 'system' as const,
      content: `You are a strict bilingual translation reviewer.
Output valid JSON only. No markdown fences.

Judge whether the translation reads like native ${TARGET_LANG} prose while preserving meaning, tone, register, and structure.
Penalize literal calques, source-language word order, awkward collocations, omitted meaning, over-translation of technical names, changed URLs, changed emoji, changed HTML/JSX, and broken Mermaid syntax.

Return this exact JSON shape:
{"adequacy":1-5,"fluency":1-5,"localization":1-5,"tone":1-5,"structure":1-5,"verdict":"pass|borderline|fail","reasons":["..."]}`,
    },
    {
      role: 'user' as const,
      content: `TARGET_LANGUAGE: ${TARGET_LANG}
MODEL: ${label}

<<<SOURCE
${source.slice(0, 12000)}
SOURCE

<<<TRANSLATION
${translated.slice(0, 12000)}
TRANSLATION`,
    },
  ]
  const resp = await fetch(`${JUDGE_ENDPOINT}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${JUDGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      messages,
      temperature: 0,
      stream: false,
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    console.warn(`Judge failed for ${label}: HTTP ${resp.status}\n${text}`)
    return null
  }
  const json: any = await resp.json()
  const raw: string = json.choices?.[0]?.message?.content ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) {
    console.warn(`Judge returned non-JSON for ${label}: ${raw.slice(0, 200)}`)
    return null
  }
  try {
    return JSON.parse(m[0]) as JudgeScore
  } catch {
    return null
  }
}

function score(j: JudgeScore | null): number {
  if (!j) return 0
  return j.adequacy + j.fluency + j.localization + j.tone + j.structure
}

async function main() {
  console.log(`Sample: ${relative(repoRoot, SAMPLE_FILE)}`)
  console.log(`Target language: ${TARGET_LANG}`)
  console.log(`Judge model: ${JUDGE_MODEL}`)
  console.log(`Out dir: ${relative(repoRoot, OUT_DIR)}`)

  const sourceLexical = JSON.parse(await readFile(SAMPLE_FILE, 'utf8'))
  const article = buildArticleFromRawLexical(SAMPLE_FILE, sourceLexical)
  console.log(`Article text length: ${article.text.length} chars`)

  await mkdir(OUT_DIR, { recursive: true })

  // Make all writer requests use stream-text mode (skip structured tool calls)
  // to keep behavior uniform across providers. Force temperature 0.3 via prompts.
  // (Strategy already passes 0.3 to runtime.)
  // Verify pre-flight
  for (const entry of MATRIX) {
    try {
      ensureKey(entry)
    } catch (err: any) {
      console.error(err.message)
      process.exit(1)
    }
  }

  const runs: RunOutcome[] = []
  for (const entry of MATRIX) {
    console.log(`\n=== ${entry.label} (${entry.model}) ===`)
    const r = await runOne(entry, article, sourceLexical)
    if (r.ok) {
      console.log(
        `ok=true ms=${r.durationMs} title=${JSON.stringify(r.translatedTitle)} leaves=${r.translatedTextLeaves}/${r.sourceTextLeaves} nodeDiff=${r.nodeTypeDiff.join(',') || 'none'}`,
      )
    } else {
      console.log(`ok=false ms=${r.durationMs} error=${r.error?.slice(0, 240)}`)
    }
    runs.push(r)
  }

  // Judge round
  const judged: Array<RunOutcome & { judge: JudgeScore | null }> = []
  for (const r of runs) {
    if (!r.ok) {
      judged.push({ ...r, judge: null })
      continue
    }
    console.log(`\n-- judging ${r.label} --`)
    const j = await judgeOne(article.text, r.translatedTextFull, r.label)
    if (j) {
      console.log(
        `verdict=${j.verdict} score=${score(j)}/25 reasons=${j.reasons.slice(0, 2).join(' | ')}`,
      )
    }
    judged.push({ ...r, judge: j })
  }

  // Persist per-model lexical JSON
  for (const r of judged) {
    if (!r.translatedLexical) continue
    const safe = r.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    await writeFile(
      resolve(OUT_DIR, `lexical-${safe}.json`),
      `${JSON.stringify(r.translatedLexical, null, 2)}\n`,
    )
  }

  const summary = {
    sample: relative(repoRoot, SAMPLE_FILE),
    target: TARGET_LANG,
    judgeModel: JUDGE_MODEL,
    runs: judged.map((r) => ({
      label: r.label,
      model: r.model,
      provider: r.provider,
      ok: r.ok,
      durationMs: r.durationMs,
      sourceLang: r.sourceLang,
      translatedTitle: r.translatedTitle,
      translatedTextLength: r.translatedTextLength,
      textLeaves: `${r.translatedTextLeaves}/${r.sourceTextLeaves}`,
      nodeTypeDiff: r.nodeTypeDiff,
      judgeVerdict: r.judge?.verdict ?? null,
      judgeScore: score(r.judge),
      judgeBreakdown: r.judge
        ? {
            adequacy: r.judge.adequacy,
            fluency: r.judge.fluency,
            localization: r.judge.localization,
            tone: r.judge.tone,
            structure: r.judge.structure,
          }
        : null,
      judgeReasons: r.judge?.reasons ?? [],
      error: r.error,
    })),
  }

  await writeFile(
    resolve(OUT_DIR, 'matrix.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  )

  const mdLines: string[] = [
    '# Translation Matrix',
    '',
    `- Sample: \`${summary.sample}\``,
    `- Target language: \`${TARGET_LANG}\``,
    `- Judge model: \`${JUDGE_MODEL}\``,
    '',
    '## Scoreboard',
    '',
    '| Model | Provider | ok | ms | leaves | nodeDiff | verdict | score/25 |',
    '| --- | --- | :-: | ---: | :-: | --- | :-: | ---: |',
    ...summary.runs.map(
      (r) =>
        `| ${r.label} | ${r.provider} | ${r.ok ? 'y' : 'n'} | ${r.durationMs} | ${r.textLeaves} | ${r.nodeTypeDiff.join(', ') || 'none'} | ${r.judgeVerdict ?? '-'} | ${r.judgeScore || '-'} |`,
    ),
    '',
    '## Judge Breakdown',
    '',
    '| Model | adequacy | fluency | local. | tone | struct. |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...summary.runs.map((r) =>
      r.judgeBreakdown
        ? `| ${r.label} | ${r.judgeBreakdown.adequacy} | ${r.judgeBreakdown.fluency} | ${r.judgeBreakdown.localization} | ${r.judgeBreakdown.tone} | ${r.judgeBreakdown.structure} |`
        : `| ${r.label} | - | - | - | - | - |`,
    ),
    '',
    '## Judge Notes',
    '',
    ...summary.runs.flatMap((r) =>
      r.judgeReasons.length
        ? [`### ${r.label}`, '', ...r.judgeReasons.map((s) => `- ${s}`), '']
        : [],
    ),
    '## Translation Excerpts',
    '',
    ...judged.flatMap((r) => [
      `### ${r.label}`,
      '',
      `- Title: ${JSON.stringify(r.translatedTitle)}`,
      r.error ? `- Error: \`${r.error.slice(0, 200)}\`` : '',
      '',
      '```text',
      r.translatedTextExcerpt.slice(0, 2000),
      '```',
      '',
    ]),
  ]

  await writeFile(
    resolve(OUT_DIR, 'matrix.md'),
    mdLines.filter((l) => l !== '').join('\n'),
  )

  console.log(`\nWrote ${relative(repoRoot, resolve(OUT_DIR, 'matrix.json'))}`)
  console.log(`Wrote ${relative(repoRoot, resolve(OUT_DIR, 'matrix.md'))}`)
}

// AI_PROMPTS reference forces the module loader to keep the schema alive.
void AI_PROMPTS

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err)
  process.exitCode = 1
})
