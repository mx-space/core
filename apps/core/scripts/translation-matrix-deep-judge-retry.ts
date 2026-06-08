#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config as loadEnv } from 'dotenv'
import { jsonrepair } from 'jsonrepair'

import { LexicalService } from '../src/processors/helper/helper.lexical.service'
import { extractDocumentContext } from '../src/utils/content.util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
loadEnv({ path: resolve(repoRoot, '.env'), quiet: true })

const SAMPLE = resolve(repoRoot, 'data/lexical/sample-1.json')
const TARGET = readArg('--target') ?? 'en'
const OUT = resolve(repoRoot, readArg('--out') ?? 'tmp/translation-matrix')
const LABEL = readArg('--label') ?? 'DeepSeek V4 Pro'
const LEX_FILE = readArg('--file') ?? 'lexical-deepseek-v4-pro.json'
const JUDGE_MODEL = 'anthropic/claude-opus-4.6'
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
}

async function judge(
  source: string,
  translated: string,
  label: string,
): Promise<any | null> {
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

CRITICAL JSON RULES:
- ESCAPE every double quote inside string values with \\".
- NEVER put a raw newline inside a JSON string; use \\n.

PRIMARY AXES (1-5 scale, 5 best):
- machineTranslationTracesFreeness: 5 = no MT smell. Penalize literal calques, source-language word order, kanji-for-character renderings, awkward "translation-ese", Japanese particle misuse.
- sourceOnlyIdiomHandling: 5 = native equivalent or skillful paraphrase for Chinese-only expressions (腌入味了, 学习委员, 结尾的结尾, classical poetry, X 感 compounds). 1 = stiff literal.

SECONDARY AXES (1-5 scale):
- adequacy, fluency, localization, tone, structure.

OUTPUT SHAPE:
{
  "scores": {"adequacy":1-5,"fluency":1-5,"localization":1-5,"tone":1-5,"structure":1-5,"machineTranslationTracesFreeness":1-5,"sourceOnlyIdiomHandling":1-5},
  "verdict": "pass|borderline|fail",
  "machineTranslationTraces": [{"sourceSnippet":"...","translatedSnippet":"...","problem":"...","suggestion":"..."}],
  "sourceOnlyIdioms": [{"sourceExpression":"...","translatedRendering":"...","nativeAlternative":"...","quality":"good|awkward|literal|lost","note":"..."}],
  "overallReasons": ["..."]
}
Up to 8 entries per array. Be specific — quote actual text.`,
      },
      {
        role: 'user',
        content: `TARGET_LANGUAGE: ${lang}\nMODEL: ${label}\n\n<<<SOURCE\n${source}\nSOURCE\n\n<<<TRANSLATION\n${translated}\nTRANSLATION`,
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
    console.error(`HTTP ${resp.status}: ${await resp.text()}`)
    return null
  }
  const json: any = await resp.json()
  const raw: string = json.choices?.[0]?.message?.content ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0])
  } catch {
    try {
      return JSON.parse(jsonrepair(m[0]))
    } catch (e: any) {
      console.error(`parse + repair failed: ${e.message}`)
      await writeFile('/tmp/deep-retry-raw.json', raw)
      return null
    }
  }
}

async function main() {
  const lexicalSvc = new LexicalService()
  const sourceLex = JSON.parse(await readFile(SAMPLE, 'utf8'))
  const sourceText = extractDocumentContext(sourceLex.root?.children ?? [])
  const lex = JSON.parse(await readFile(resolve(OUT, LEX_FILE), 'utf8'))
  const md = lexicalSvc.lexicalToMarkdown(JSON.stringify(lex))
  console.log(`[${LABEL}] md=${md.length} chars`)

  const result = await judge(sourceText, md, LABEL)
  if (!result) {
    console.error('judge failed')
    process.exitCode = 1
    return
  }
  const s = result.scores
  const total =
    s.adequacy +
    s.fluency +
    s.localization +
    s.tone +
    s.structure +
    s.machineTranslationTracesFreeness +
    s.sourceOnlyIdiomHandling
  console.log(`verdict=${result.verdict} total=${total}/35`)

  const existing = JSON.parse(
    await readFile(resolve(OUT, 'deep-judge.json'), 'utf8'),
  )
  const row = existing.runs.find((r: any) => r.label === LABEL)
  if (row) row.deep = result
  await writeFile(
    resolve(OUT, 'deep-judge.json'),
    `${JSON.stringify(existing, null, 2)}\n`,
  )
  console.log('updated deep-judge.json')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e)
  process.exitCode = 1
})
