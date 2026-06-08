#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config as loadEnv } from 'dotenv'

import { LexicalService } from '../src/processors/helper/helper.lexical.service'
import { extractDocumentContext } from '../src/utils/content.util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
loadEnv({ path: resolve(repoRoot, '.env'), quiet: true })

const SAMPLE = resolve(repoRoot, 'data/lexical/sample-1.json')
const OUT = resolve(repoRoot, 'tmp/translation-matrix')
const TARGET = 'en'
const JUDGE_MODEL = 'anthropic/claude-opus-4.6'
const JUDGE_KEY = process.env.OPENROUTER_TOKEN ?? ''
const JUDGE_ENDPOINT = 'https://openrouter.ai/api/v1'

interface JudgeScore {
  adequacy: number
  fluency: number
  localization: number
  tone: number
  structure: number
  verdict: 'pass' | 'borderline' | 'fail'
  reasons: string[]
}

async function judge(
  source: string,
  translated: string,
  label: string,
): Promise<JudgeScore | null> {
  const body = {
    model: JUDGE_MODEL,
    temperature: 0,
    stream: false,
    messages: [
      {
        role: 'system',
        content: `You are a strict bilingual translation reviewer.
Output valid JSON only. No markdown fences.

Judge whether the translation reads like native ${TARGET} prose while preserving meaning, tone, register, and structure.
Penalize literal calques, source-language word order, awkward collocations, omitted meaning, over-translation of technical names, changed URLs, changed emoji, changed HTML/JSX, and broken Mermaid syntax.

Return this exact JSON shape:
{"adequacy":1-5,"fluency":1-5,"localization":1-5,"tone":1-5,"structure":1-5,"verdict":"pass|borderline|fail","reasons":["..."]}`,
      },
      {
        role: 'user',
        content: `TARGET_LANGUAGE: ${TARGET}
MODEL: ${label}

<<<SOURCE
${source}
SOURCE

<<<TRANSLATION
${translated}
TRANSLATION`,
      },
    ],
  }
  const resp = await fetch(`${JUDGE_ENDPOINT}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${JUDGE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    console.warn(`judge HTTP ${resp.status}: ${await resp.text()}`)
    return null
  }
  const json: any = await resp.json()
  const raw: string = json.choices?.[0]?.message?.content ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0]) as JudgeScore
  } catch {
    return null
  }
}

const TARGETS = [
  { label: 'Gemini 3.1 Pro', file: 'lexical-gemini-3-1-pro.json' },
  { label: 'DeepSeek V4 Pro', file: 'lexical-deepseek-v4-pro.json' },
  { label: 'Claude Opus 4.6', file: 'lexical-claude-opus-4-6.json' },
]

async function main() {
  const lexicalSvc = new LexicalService()
  const sourceLex = JSON.parse(await readFile(SAMPLE, 'utf8'))
  const sourceText = extractDocumentContext(sourceLex.root?.children ?? [])
  console.log(`Source full text: ${sourceText.length} chars`)

  const existing = JSON.parse(
    await readFile(resolve(OUT, 'matrix.json'), 'utf8'),
  )

  for (const target of TARGETS) {
    const translatedLex = JSON.parse(
      await readFile(resolve(OUT, target.file), 'utf8'),
    )
    const translatedMd = lexicalSvc.lexicalToMarkdown(JSON.stringify(translatedLex))
    console.log(
      `\n[${target.label}] translated markdown: ${translatedMd.length} chars`,
    )
    const j = await judge(sourceText, translatedMd, target.label)
    if (!j) {
      console.log(`  judge failed`)
      continue
    }
    const total =
      j.adequacy + j.fluency + j.localization + j.tone + j.structure
    console.log(
      `  verdict=${j.verdict} score=${total}/25  A${j.adequacy} F${j.fluency} L${j.localization} T${j.tone} S${j.structure}`,
    )
    for (const r of j.reasons.slice(0, 3)) {
      console.log(`    - ${r}`)
    }

    const row = existing.runs.find((x: any) => x.label === target.label)
    if (row) {
      row.judgeVerdict = j.verdict
      row.judgeScore = total
      row.judgeBreakdown = {
        adequacy: j.adequacy,
        fluency: j.fluency,
        localization: j.localization,
        tone: j.tone,
        structure: j.structure,
      }
      row.judgeReasons = j.reasons
      row.fullTranslatedMarkdownLength = translatedMd.length
    }
  }

  await writeFile(
    resolve(OUT, 'matrix.json'),
    `${JSON.stringify(existing, null, 2)}\n`,
  )

  const mdLines: string[] = [
    '# Translation Matrix (re-judged with full text)',
    '',
    `- Sample: \`${existing.sample}\``,
    `- Target language: \`${TARGET}\``,
    `- Judge model: \`${JUDGE_MODEL}\``,
    `- Source full text: ${sourceText.length} chars`,
    '',
    '## Scoreboard',
    '',
    '| Model | Provider | ms | leaves | nodeDiff | verdict | score/25 |',
    '| --- | --- | ---: | :-: | --- | :-: | ---: |',
    ...existing.runs.map(
      (r: any) =>
        `| ${r.label} | ${r.provider} | ${r.durationMs} | ${r.textLeaves} | ${r.nodeTypeDiff.join(', ') || 'none'} | ${r.judgeVerdict ?? '-'} | ${r.judgeScore || '-'} |`,
    ),
    '',
    '## Judge Breakdown',
    '',
    '| Model | adequacy | fluency | local. | tone | struct. |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...existing.runs.map((r: any) =>
      r.judgeBreakdown
        ? `| ${r.label} | ${r.judgeBreakdown.adequacy} | ${r.judgeBreakdown.fluency} | ${r.judgeBreakdown.localization} | ${r.judgeBreakdown.tone} | ${r.judgeBreakdown.structure} |`
        : `| ${r.label} | - | - | - | - | - |`,
    ),
    '',
    '## Titles',
    '',
    ...existing.runs.map(
      (r: any) =>
        `- **${r.label}** → ${JSON.stringify(r.translatedTitle)}`,
    ),
    '',
    '## Judge Notes',
    '',
    ...existing.runs.flatMap((r: any) =>
      r.judgeReasons.length
        ? [`### ${r.label}`, '', ...r.judgeReasons.map((s: string) => `- ${s}`), '']
        : [],
    ),
  ]

  await writeFile(
    resolve(OUT, 'matrix.md'),
    mdLines.filter((l) => l !== '').join('\n'),
  )
  console.log(`\nWrote ${relative(repoRoot, resolve(OUT, 'matrix.json'))}`)
  console.log(`Wrote ${relative(repoRoot, resolve(OUT, 'matrix.md'))}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e)
  process.exitCode = 1
})
