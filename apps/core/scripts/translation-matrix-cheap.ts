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

interface Entry {
  label: string
  model: string
  endpoint?: string
}

const MATRIX: Entry[] = [
  { label: 'Claude Haiku 4.5', model: 'anthropic/claude-haiku-4.5' },
  { label: 'Cohere Command-A', model: 'cohere/command-a' },
  { label: 'GPT-5.1', model: 'openai/gpt-5.1' },
  { label: 'ByteDance Seed 1.6', model: 'bytedance-seed/seed-1.6' },
]

const SAMPLE = resolve(repoRoot, 'data/lexical/sample-1.json')
const TARGET = readArg('--target') ?? 'ja'
const OUT = resolve(
  repoRoot,
  readArg('--out') ?? `tmp/translation-matrix-${TARGET}-cheap`,
)

function readArg(name: string): string | undefined {
  const prefix = `${name}=`
  const inline = process.argv.find((a) => a.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const i = process.argv.indexOf(name)
  if (i >= 0) return process.argv[i + 1]
}

function ensureKey(): string {
  const key = process.env.OPENROUTER_TOKEN
  if (!key) throw new Error('Missing OPENROUTER_TOKEN')
  return key
}

function buildConfig(entry: Entry): AIProviderConfig {
  return {
    apiKey: ensureKey(),
    defaultModel: entry.model,
    enabled: true,
    endpoint: 'https://openrouter.ai/api/v1',
    id: 'openrouter',
    name: entry.label,
    type: AIProviderType.OpenRouter,
  }
}

function findFirstText(node: any): string | null {
  if (!node || typeof node !== 'object') return null
  if (node.type === 'text' && typeof node.text === 'string' && node.text.trim())
    return node.text
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
  if (Array.isArray(node.children))
    for (const c of node.children) collectTextLeaves(c, out)
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
      : Object.values(node as Record<string, unknown>))
      visit(child)
  }
  visit(value)
  return counts
}

interface Run {
  label: string
  model: string
  ok: boolean
  durationMs: number
  sourceLang: string | null
  translatedTitle: string | null
  translatedTextLength: number
  textLeaves: string
  nodeTypeDiff: string[]
  error: string | null
  translatedLexical: any
}

async function runOne(
  entry: Entry,
  article: ArticleContent,
  sourceLex: any,
): Promise<Run> {
  const lexicalService = new LexicalService()
  const reviewerService = new TranslationReviewerService()
  const strategy = new LexicalTranslationStrategy(
    lexicalService,
    reviewerService,
  )
  let runtime
  try {
    runtime = createModelRuntime(buildConfig(entry))
  } catch (err: any) {
    return {
      label: entry.label,
      model: entry.model,
      ok: false,
      durationMs: 0,
      sourceLang: null,
      translatedTitle: null,
      translatedTextLength: 0,
      textLeaves: '0/0',
      nodeTypeDiff: [],
      error: err.message,
      translatedLexical: null,
    }
  }
  const startedAt = Date.now()
  try {
    const result = await strategy.translate(
      article,
      TARGET,
      runtime,
      { model: entry.model, provider: runtime.providerInfo.type },
      {},
    )
    const durationMs = Date.now() - startedAt
    const transLex = result.content ? JSON.parse(result.content) : null
    const srcCounts = collectNodeTypeCounts(sourceLex)
    const trCounts = collectNodeTypeCounts(transLex)
    const nodeTypeDiff: string[] = []
    for (const [t, c] of srcCounts) {
      const n = trCounts.get(t) ?? 0
      if (n !== c) nodeTypeDiff.push(`${t}: ${c} -> ${n}`)
    }
    const sl: string[] = []
    const tl: string[] = []
    collectTextLeaves(sourceLex, sl)
    collectTextLeaves(transLex, tl)
    return {
      label: entry.label,
      model: entry.model,
      ok: true,
      durationMs,
      sourceLang: result.sourceLang,
      translatedTitle: result.title,
      translatedTextLength: result.text.length,
      textLeaves: `${tl.length}/${sl.length}`,
      nodeTypeDiff,
      error: null,
      translatedLexical: transLex,
    }
  } catch (err: any) {
    return {
      label: entry.label,
      model: entry.model,
      ok: false,
      durationMs: Date.now() - startedAt,
      sourceLang: null,
      translatedTitle: null,
      translatedTextLength: 0,
      textLeaves: '0/0',
      nodeTypeDiff: [],
      error: err.stack ?? err.message ?? String(err),
      translatedLexical: null,
    }
  }
}

async function main() {
  console.log(`Sample: ${relative(repoRoot, SAMPLE)}`)
  console.log(`Target: ${TARGET}`)
  console.log(`Out: ${relative(repoRoot, OUT)}`)

  const sourceLex = JSON.parse(await readFile(SAMPLE, 'utf8'))
  const article: ArticleContent = {
    title: (findFirstText(sourceLex) ?? SAMPLE).slice(0, 60),
    text: extractDocumentContext(sourceLex.root?.children ?? []),
    content: JSON.stringify(sourceLex),
    contentFormat: ContentFormat.Lexical,
  }
  console.log(`Article text: ${article.text.length} chars`)

  await mkdir(OUT, { recursive: true })

  const runs: Run[] = []
  for (const entry of MATRIX) {
    console.log(`\n=== ${entry.label} (${entry.model}) ===`)
    const r = await runOne(entry, article, sourceLex)
    if (r.ok)
      console.log(
        `ok=true ms=${r.durationMs} title=${JSON.stringify(r.translatedTitle)} leaves=${r.textLeaves} nodeDiff=${r.nodeTypeDiff.join(',') || 'none'}`,
      )
    else console.log(`ok=false ms=${r.durationMs} error=${r.error?.slice(0,400)}`)
    if (r.translatedLexical) {
      const safe = r.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      await writeFile(
        resolve(OUT, `lexical-${safe}.json`),
        `${JSON.stringify(r.translatedLexical, null, 2)}\n`,
      )
    }
    runs.push(r)
  }

  const summary = {
    sample: relative(repoRoot, SAMPLE),
    target: TARGET,
    runs: runs.map((r) => ({
      label: r.label,
      model: r.model,
      provider: 'openrouter',
      ok: r.ok,
      durationMs: r.durationMs,
      sourceLang: r.sourceLang,
      translatedTitle: r.translatedTitle,
      translatedTextLength: r.translatedTextLength,
      textLeaves: r.textLeaves,
      nodeTypeDiff: r.nodeTypeDiff,
      error: r.error,
    })),
  }
  await writeFile(
    resolve(OUT, 'matrix.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  )
  console.log(`\nWrote ${relative(repoRoot, resolve(OUT, 'matrix.json'))}`)
}

void AI_PROMPTS

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err)
  process.exitCode = 1
})
