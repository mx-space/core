#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')

const OUT = resolve(repoRoot, readArg('--out') ?? 'tmp/translation-matrix')
const TARGET = readArg('--target') ?? 'en'
const TARGET_NAME: Record<string, string> = { en: 'English', ja: 'Japanese' }

function readArg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  if (i >= 0) return process.argv[i + 1]
}

function esc(s: string) {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 220)
}

async function main() {
  const report = JSON.parse(
    await readFile(resolve(OUT, 'deep-judge.json'), 'utf8'),
  )
  const lines: string[] = []
  lines.push(`# Translation Matrix Deep Report — target ${TARGET}`)
  lines.push('')
  lines.push(`- Sample: \`${report.sample}\``)
  lines.push(`- Target language: \`${TARGET_NAME[TARGET] ?? TARGET}\` (\`${TARGET}\`)`)
  lines.push(`- Judge model: \`${report.judgeModel}\``)
  lines.push(`- Source markdown: ${report.sourceLength} chars`)
  lines.push('')

  lines.push('## Judge Criteria')
  lines.push('')
  lines.push('Each translation is scored on **7 axes** (1-5 each, 35 max), with two PRIMARY axes:')
  lines.push('')
  lines.push('1. **`machineTranslationTracesFreeness`** (PRIMARY) — absence of MT smell: literal calques, source-language word order, awkward "translation-ese", forced particles in Japanese. 5 = no smell.')
  lines.push('2. **`sourceOnlyIdiomHandling`** (PRIMARY) — handling of Chinese-only expressions (网络词如腌入味了，文化语 如学习委员、小红书，古典诗 如欲買桂花同載酒，概念合成 如结尾的结尾、X 感). 5 = native equivalent; 1 = stiff literal.')
  lines.push('3. `adequacy`, 4. `fluency`, 5. `localization`, 6. `tone`, 7. `structure`.')
  lines.push('')

  lines.push('## Scoreboard')
  lines.push('')
  lines.push('| Model | ms | leaves | nodeDiff | verdict | total/35 | MT-free | Idiom |')
  lines.push('| --- | ---: | :-: | --- | :-: | ---: | :-: | :-: |')
  for (const r of report.runs) {
    const s = r.deep?.scores
    const total = s
      ? s.adequacy + s.fluency + s.localization + s.tone + s.structure + s.machineTranslationTracesFreeness + s.sourceOnlyIdiomHandling
      : 0
    lines.push(
      `| ${r.label} | ${r.durationMs} | ${r.textLeaves} | ${r.nodeTypeDiff.join(', ') || 'none'} | ${r.deep?.verdict ?? '-'} | ${total || '-'} | ${s?.machineTranslationTracesFreeness ?? '-'} | ${s?.sourceOnlyIdiomHandling ?? '-'} |`,
    )
  }
  lines.push('')

  lines.push('## Score Breakdown')
  lines.push('')
  lines.push('| Model | adequacy | fluency | local. | tone | struct. | MT-free | idiom |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const r of report.runs) {
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
  for (const r of report.runs) {
    lines.push(`- **${r.label}** → ${JSON.stringify(r.translatedTitle)}`)
  }
  lines.push('')

  for (const r of report.runs) {
    lines.push(`## ${r.label}`)
    lines.push('')
    if (!r.deep) {
      lines.push('Judge produced no output.')
      lines.push('')
      continue
    }
    lines.push('### Machine-translation traces')
    lines.push('')
    if (!r.deep.machineTranslationTraces?.length) {
      lines.push('_None flagged by the judge._')
    } else {
      lines.push('| Source | Translation | Problem | Suggestion |')
      lines.push('| --- | --- | --- | --- |')
      for (const t of r.deep.machineTranslationTraces) {
        lines.push(`| ${esc(t.sourceSnippet)} | ${esc(t.translatedSnippet)} | ${esc(t.problem)} | ${esc(t.suggestion)} |`)
      }
    }
    lines.push('')
    lines.push('### Source-only idiom handling')
    lines.push('')
    if (!r.deep.sourceOnlyIdioms?.length) {
      lines.push('_None flagged by the judge._')
    } else {
      lines.push('| Source expression | Rendering | Native alternative | Quality | Note |')
      lines.push('| --- | --- | --- | :-: | --- |')
      for (const t of r.deep.sourceOnlyIdioms) {
        lines.push(`| ${esc(t.sourceExpression)} | ${esc(t.translatedRendering)} | ${esc(t.nativeAlternative)} | ${t.quality} | ${esc(t.note)} |`)
      }
    }
    lines.push('')
    lines.push('### Overall reasons')
    lines.push('')
    for (const reason of r.deep.overallReasons ?? []) {
      lines.push(`- ${reason}`)
    }
    lines.push('')
  }

  await writeFile(resolve(OUT, 'deep-judge.md'), lines.join('\n'))
  console.log(`rebuilt ${resolve(OUT, 'deep-judge.md')}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e)
  process.exitCode = 1
})
