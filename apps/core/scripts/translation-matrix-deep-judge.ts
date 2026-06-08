#!/usr/bin/env node

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config as loadEnv } from 'dotenv'

import { LexicalService } from '../src/processors/helper/helper.lexical.service'
import { extractDocumentContext } from '../src/utils/content.util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
loadEnv({ path: resolve(repoRoot, '.env'), quiet: true })

const SAMPLE = resolve(repoRoot, 'data/lexical/sample-1.json')
const TARGET = readArg('--target') ?? 'ja'
const OUT = resolve(repoRoot, readArg('--out') ?? 'tmp/translation-matrix-ja')
const JUDGE_MODEL = readArg('--judge') ?? 'anthropic/claude-opus-4.6'
const JUDGE_KEY = process.env.OPENROUTER_TOKEN ?? ''
const JUDGE_ENDPOINT = 'https://openrouter.ai/api/v1'

function readArg(name: string): string | undefined {
  const prefix = `${name}=`
  const inline = process.argv.find((a) => a.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const i = process.argv.indexOf(name)
  if (i >= 0) return process.argv[i + 1]
}

const TARGET_NAME: Record<string, string> = {
  en: 'English',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
}

interface DeepJudge {
  scores: {
    adequacy: number
    fluency: number
    localization: number
    tone: number
    structure: number
    machineTranslationTracesFreeness: number
    sourceOnlyIdiomHandling: number
  }
  verdict: 'pass' | 'borderline' | 'fail'
  machineTranslationTraces: Array<{
    sourceSnippet: string
    translatedSnippet: string
    problem: string
    suggestion: string
  }>
  sourceOnlyIdioms: Array<{
    sourceExpression: string
    translatedRendering: string
    nativeAlternative: string
    quality: 'good' | 'awkward' | 'literal' | 'lost'
    note: string
  }>
  overallReasons: string[]
}

async function deepJudge(
  source: string,
  translated: string,
  label: string,
): Promise<DeepJudge | null> {
  const lang = TARGET_NAME[TARGET] ?? TARGET
  const body = {
    model: JUDGE_MODEL,
    temperature: 0,
    stream: false,
    messages: [
      {
        role: 'system',
        content: `You are a strict bilingual translation reviewer for Chinese -> ${lang}.
Output valid JSON only. No markdown fences. No commentary outside JSON.

You will judge a translation along two PRIMARY axes and five SECONDARY axes.

PRIMARY AXES (the user cares MOST about these):
1. machineTranslationTracesFreeness (1-5, 5 = no MT smell at all):
   - Detect literal calques, source-language word order leaking through, awkward "translation-ese"
   - Detect overly literal kanji/character-for-character renderings
   - For Japanese: detect English-style relative clauses, missing/wrong particles (は・が・を・に・で・と・へ・の), unnatural punctuation, forced romaji where kanji/kana is natural, missing the Japanese contextual subject-drop
   - Penalize anything a native ${lang} reader would flag as "obviously translated"

2. sourceOnlyIdiomHandling (1-5, 5 = excellent):
   - Identify source-Chinese expressions that have NO direct counterpart in ${lang}:
     * Internet slang: 腌入味了 / 傻软 / 卷 / 摆烂 / doomscrolling-equivalents
     * Cultural-specific: 学习委员, 同桌, 小红书, 校招, 相亲
     * Classical-poetic: 欲買桂花同載酒、終不似、少年游
     * Conceptual compounds: X 感, X 价值, 结尾的结尾
   - Judge whether the translator chose a NATIVE ${lang} equivalent or settled for a stiff literal rendering
   - A stiff literal compound is FAILURE, not safe default

SECONDARY AXES:
3. adequacy (1-5): all source meaning preserved
4. fluency (1-5): reads as native ${lang}
5. localization (1-5): cultural references adapted
6. tone (1-5): emotional register preserved
7. structure (1-5): paragraphs / headings / tables / links / images intact

Return STRICTLY this JSON shape:
{
  "scores": {
    "adequacy": 1-5,
    "fluency": 1-5,
    "localization": 1-5,
    "tone": 1-5,
    "structure": 1-5,
    "machineTranslationTracesFreeness": 1-5,
    "sourceOnlyIdiomHandling": 1-5
  },
  "verdict": "pass|borderline|fail",
  "machineTranslationTraces": [
    {
      "sourceSnippet": "...",
      "translatedSnippet": "...",
      "problem": "what reads as MT smell",
      "suggestion": "how a native writer would say it"
    }
  ],
  "sourceOnlyIdioms": [
    {
      "sourceExpression": "the Chinese expression",
      "translatedRendering": "what the model produced",
      "nativeAlternative": "what a native ${lang} writer would use",
      "quality": "good|awkward|literal|lost",
      "note": "one-line evaluation"
    }
  ],
  "overallReasons": ["bullet points summarizing strengths and weaknesses"]
}

List up to 8 entries in each array. Be specific — quote actual text.`,
      },
      {
        role: 'user',
        content: `TARGET_LANGUAGE: ${lang}
MODEL_UNDER_REVIEW: ${label}

<<<SOURCE_CHINESE
${source}
SOURCE_CHINESE

<<<TRANSLATION_${lang.toUpperCase()}
${translated}
TRANSLATION_${lang.toUpperCase()}`,
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
  if (!m) {
    console.warn(`no JSON in judge output: ${raw.slice(0, 240)}`)
    return null
  }
  try {
    return JSON.parse(m[0]) as DeepJudge
  } catch (e: any) {
    console.warn(`JSON parse failed: ${e.message}\n${raw.slice(0, 240)}`)
    return null
  }
}

interface RunRow {
  label: string
  model: string
  provider: string
  durationMs: number
  translatedTitle: string | null
  textLeaves: string
  nodeTypeDiff: string[]
  fileBase: string
}

async function main() {
  const lexicalSvc = new LexicalService()
  const sourceLex = JSON.parse(await readFile(SAMPLE, 'utf8'))
  const sourceText = extractDocumentContext(sourceLex.root?.children ?? [])
  console.log(`Source full text: ${sourceText.length} chars`)
  console.log(`Out dir: ${relative(repoRoot, OUT)}`)
  console.log(`Judge: ${JUDGE_MODEL}`)

  const existing = JSON.parse(
    await readFile(resolve(OUT, 'matrix.json'), 'utf8'),
  )
  const files = await readdir(OUT)
  const lexFiles = files.filter(
    (f) => f.startsWith('lexical-') && f.endsWith('.json'),
  )

  const runs: Array<RunRow & { deep: DeepJudge | null; translatedMd: string }> =
    []

  for (const r of existing.runs as RunRow[]) {
    const safe = r.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const lexFile = lexFiles.find((f) => f.includes(safe))
    if (!lexFile) {
      console.warn(`no lexical file for ${r.label}`)
      continue
    }
    const lex = JSON.parse(await readFile(resolve(OUT, lexFile), 'utf8'))
    const translatedMd = lexicalSvc.lexicalToMarkdown(JSON.stringify(lex))
    console.log(`\n[${r.label}] md=${translatedMd.length} chars`)
    const deep = await deepJudge(sourceText, translatedMd, r.label)
    if (deep) {
      const s = deep.scores
      const total =
        s.adequacy +
        s.fluency +
        s.localization +
        s.tone +
        s.structure +
        s.machineTranslationTracesFreeness +
        s.sourceOnlyIdiomHandling
      console.log(
        `  verdict=${deep.verdict} total=${total}/35 mtFree=${s.machineTranslationTracesFreeness} idiom=${s.sourceOnlyIdiomHandling}`,
      )
      console.log(
        `  MT-traces: ${deep.machineTranslationTraces.length}, idiom-cases: ${deep.sourceOnlyIdioms.length}`,
      )
    }
    runs.push({ ...r, deep, translatedMd, fileBase: lexFile })
  }

  const report = {
    sample: existing.sample,
    target: TARGET,
    targetName: TARGET_NAME[TARGET] ?? TARGET,
    judgeModel: JUDGE_MODEL,
    sourceLength: sourceText.length,
    runs: runs.map((r) => ({
      label: r.label,
      model: r.model,
      provider: r.provider,
      durationMs: r.durationMs,
      translatedTitle: r.translatedTitle,
      textLeaves: r.textLeaves,
      nodeTypeDiff: r.nodeTypeDiff,
      markdownLength: r.translatedMd.length,
      deep: r.deep,
    })),
  }
  await writeFile(
    resolve(OUT, 'deep-judge.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )

  // Build markdown report
  const lines: string[] = []
  lines.push(`# Translation Matrix Deep Report — target ${TARGET}`)
  lines.push('')
  lines.push(`- Sample: \`${existing.sample}\``)
  lines.push(`- Target language: \`${report.targetName}\` (\`${TARGET}\`)`)
  lines.push(`- Judge model: \`${JUDGE_MODEL}\``)
  lines.push(`- Source markdown: ${sourceText.length} chars`)
  lines.push('')

  lines.push('## Judge Criteria')
  lines.push('')
  lines.push(
    'Each translation is scored on **7 axes** (1-5 each, 35 max), with two PRIMARY axes the user explicitly asked about:',
  )
  lines.push('')
  lines.push(
    '1. **`machineTranslationTracesFreeness`** (PRIMARY) — absence of MT smell: literal calques, source-language word order, kanji-for-character renderings, missing/forced particles in Japanese, "translation-ese" cadence. 5 = no MT smell.',
  )
  lines.push(
    '2. **`sourceOnlyIdiomHandling`** (PRIMARY) — handling of Chinese-only expressions that have no direct counterpart in the target language: internet slang (腌入味了 / 傻软 / 卷), cultural references (学习委员 / 小红书 / 校招), classical poetry, conceptual compounds (结尾的结尾 / X 感). 5 = native equivalent or skillful paraphrase; 1 = stiff literal.',
  )
  lines.push('3. `adequacy` — all source meaning preserved')
  lines.push('4. `fluency` — reads as native target language')
  lines.push('5. `localization` — cultural references adapted')
  lines.push('6. `tone` — emotional register preserved')
  lines.push('7. `structure` — paragraphs / tables / links / images intact')
  lines.push('')

  lines.push('## Scoreboard')
  lines.push('')
  lines.push(
    '| Model | ms | leaves | nodeDiff | verdict | total/35 | MT-free | Idiom |',
  )
  lines.push('| --- | ---: | :-: | --- | :-: | ---: | :-: | :-: |')
  for (const r of runs) {
    const s = r.deep?.scores
    const total = s
      ? s.adequacy +
        s.fluency +
        s.localization +
        s.tone +
        s.structure +
        s.machineTranslationTracesFreeness +
        s.sourceOnlyIdiomHandling
      : 0
    lines.push(
      `| ${r.label} | ${r.durationMs} | ${r.textLeaves} | ${r.nodeTypeDiff.join(', ') || 'none'} | ${r.deep?.verdict ?? '-'} | ${total || '-'} | ${s?.machineTranslationTracesFreeness ?? '-'} | ${s?.sourceOnlyIdiomHandling ?? '-'} |`,
    )
  }
  lines.push('')

  lines.push('## Score Breakdown')
  lines.push('')
  lines.push(
    '| Model | adequacy | fluency | local. | tone | struct. | MT-free | idiom |',
  )
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const r of runs) {
    const s = r.deep?.scores
    lines.push(
      s
        ? `| ${r.label} | ${s.adequacy} | ${s.fluency} | ${s.localization} | ${s.tone} | ${s.structure} | ${s.machineTranslationTracesFreeness} | ${s.sourceOnlyIdiomHandling} |`
        : `| ${r.label} | - | - | - | - | - | - | - |`,
    )
  }
  lines.push('')

  lines.push('## Titles')
  lines.push('')
  for (const r of runs) {
    lines.push(`- **${r.label}** → ${JSON.stringify(r.translatedTitle)}`)
  }
  lines.push('')

  for (const r of runs) {
    lines.push(`## ${r.label}`)
    lines.push('')
    if (!r.deep) {
      lines.push('Judge produced no output.')
      lines.push('')
      continue
    }

    lines.push('### Machine-translation traces')
    lines.push('')
    if (r.deep.machineTranslationTraces.length === 0) {
      lines.push('_None flagged by the judge._')
    } else {
      lines.push('| Source | Translation | Problem | Suggestion |')
      lines.push('| --- | --- | --- | --- |')
      for (const t of r.deep.machineTranslationTraces) {
        const esc = (s: string) =>
          s.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 220)
        lines.push(
          `| ${esc(t.sourceSnippet)} | ${esc(t.translatedSnippet)} | ${esc(t.problem)} | ${esc(t.suggestion)} |`,
        )
      }
    }
    lines.push('')

    lines.push('### Source-only idiom handling')
    lines.push('')
    if (r.deep.sourceOnlyIdioms.length === 0) {
      lines.push('_None flagged by the judge._')
    } else {
      lines.push(
        '| Source expression | Rendering | Native alternative | Quality | Note |',
      )
      lines.push('| --- | --- | --- | :-: | --- |')
      for (const t of r.deep.sourceOnlyIdioms) {
        const esc = (s: string) =>
          s.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 220)
        lines.push(
          `| ${esc(t.sourceExpression)} | ${esc(t.translatedRendering)} | ${esc(t.nativeAlternative)} | ${t.quality} | ${esc(t.note)} |`,
        )
      }
    }
    lines.push('')

    lines.push('### Overall reasons')
    lines.push('')
    for (const reason of r.deep.overallReasons) {
      lines.push(`- ${reason}`)
    }
    lines.push('')
  }

  await writeFile(resolve(OUT, 'deep-judge.md'), lines.join('\n'))
  console.log(
    `\nWrote ${relative(repoRoot, resolve(OUT, 'deep-judge.json'))}`,
  )
  console.log(`Wrote ${relative(repoRoot, resolve(OUT, 'deep-judge.md'))}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e)
  process.exitCode = 1
})
