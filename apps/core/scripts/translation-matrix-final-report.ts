#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')

const EN = resolve(repoRoot, 'tmp/translation-matrix/deep-judge.json')
const JA = resolve(repoRoot, 'tmp/translation-matrix-ja/deep-judge.json')
const OUT = resolve(repoRoot, 'tmp/translation-matrix/FINAL_REPORT.md')

function esc(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 200)
}

function totalOf(s: any): number {
  return (
    s.adequacy +
    s.fluency +
    s.localization +
    s.tone +
    s.structure +
    s.machineTranslationTracesFreeness +
    s.sourceOnlyIdiomHandling
  )
}

async function main() {
  const en = JSON.parse(await readFile(EN, 'utf8'))
  const ja = JSON.parse(await readFile(JA, 'utf8'))

  const lines: string[] = []
  lines.push('# Translation Matrix — Final Report')
  lines.push('')
  lines.push(`- Sample: \`${en.sample}\` (Chinese personal blog, 7163 chars markdown)`)
  lines.push(`- Targets: \`en\` (English), \`ja\` (Japanese)`)
  lines.push(`- Judge model: \`${en.judgeModel}\` (independent reviewer)`)
  lines.push('- Generation pipeline: `LexicalTranslationStrategy` from mx-core (writer-only, reviewer disabled)')
  lines.push('')

  lines.push('## Evaluation Criteria')
  lines.push('')
  lines.push('Each translation is scored on **7 axes** (1-5 each, 35 max). The user asked specifically about TWO of them, both elevated to PRIMARY status:')
  lines.push('')
  lines.push('### Primary axes')
  lines.push('')
  lines.push('**P1. `machineTranslationTracesFreeness`** — does the output read like it was *written*, not *translated*?')
  lines.push('')
  lines.push('A score of 5 means a native reader of the target language would see no MT smell. The judge specifically penalises:')
  lines.push('- literal calques where the source idiom is rendered character-for-character')
  lines.push('- source-language word order leaking through (e.g. clinical compound nouns in English where a verb phrase reads more natural)')
  lines.push('- "translation-ese" cadence (overly formal connectives, redundant pronouns the source dropped)')
  lines.push('- for Japanese: missing or wrong particles (は・が・を・に・で・と・へ・の), unnatural punctuation, forced romaji, failure to drop the contextual subject, English-style relative clause shape')
  lines.push('')
  lines.push('**P2. `sourceOnlyIdiomHandling`** — does the model recognise expressions that only exist in Chinese and choose a native equivalent in the target language?')
  lines.push('')
  lines.push('The judge probes four categories of source-only expressions:')
  lines.push('- internet slang: `腌入味了` (marinated through), `傻软` (foolish-soft), `卷` (rat race), `摆烂` (give up)')
  lines.push('- cultural-specific roles: `学习委员` (Chinese study monitor — no exact Japanese/English counterpart), `同桌` (assigned deskmate), `小红书` (Xiaohongshu/RED), `校招` (campus recruiting), `相亲` (matchmaking date)')
  lines.push('- classical poetry: `欲買桂花同載酒、終不似、少年游` (Liu Guo, Song dynasty)')
  lines.push('- conceptual compounds with no target counterpart: `情绪价值`, `结尾的结尾`, `X 感`')
  lines.push('')
  lines.push('For each item, the judge labels the rendering `good` / `awkward` / `literal` / `lost` and provides the native alternative it would have used.')
  lines.push('')
  lines.push('### Secondary axes')
  lines.push('')
  lines.push('`adequacy` (meaning preserved), `fluency` (sentence-level naturalness), `localization` (cultural references), `tone` (emotional register), `structure` (paragraphs/tables/links/images intact).')
  lines.push('')

  lines.push('## Unified Scoreboard')
  lines.push('')
  lines.push('| Lang | Model | ms | leaves | nodeDiff | verdict | total/35 | MT-free | Idiom |')
  lines.push('| --- | --- | ---: | :-: | --- | :-: | ---: | :-: | :-: |')
  for (const r of en.runs) {
    const s = r.deep?.scores
    const t = s ? totalOf(s) : 0
    lines.push(
      `| en | ${r.label} | ${r.durationMs} | ${r.textLeaves} | ${r.nodeTypeDiff.join(', ') || 'none'} | ${r.deep?.verdict ?? '-'} | ${t || '-'} | ${s?.machineTranslationTracesFreeness ?? '-'} | ${s?.sourceOnlyIdiomHandling ?? '-'} |`,
    )
  }
  for (const r of ja.runs) {
    const s = r.deep?.scores
    const t = s ? totalOf(s) : 0
    lines.push(
      `| ja | ${r.label} | ${r.durationMs} | ${r.textLeaves} | ${r.nodeTypeDiff.join(', ') || 'none'} | ${r.deep?.verdict ?? '-'} | ${t || '-'} | ${s?.machineTranslationTracesFreeness ?? '-'} | ${s?.sourceOnlyIdiomHandling ?? '-'} |`,
    )
  }
  lines.push('')

  lines.push('## Titles')
  lines.push('')
  lines.push('Source: `当我的生活被 AI 占满了，那么我还剩什么呢？`')
  lines.push('')
  lines.push('### English')
  lines.push('')
  for (const r of en.runs) {
    lines.push(`- **${r.label}** — ${JSON.stringify(r.translatedTitle)}`)
  }
  lines.push('')
  lines.push('### Japanese')
  lines.push('')
  for (const r of ja.runs) {
    lines.push(`- **${r.label}** — ${JSON.stringify(r.translatedTitle)}`)
  }
  lines.push('')

  // P1: MT trace summary
  lines.push('## P1 — Machine-translation trace findings')
  lines.push('')
  lines.push('| Lang | Model | Traces flagged | MT-free score |')
  lines.push('| --- | --- | ---: | ---: |')
  for (const r of en.runs) {
    const s = r.deep?.scores
    lines.push(
      `| en | ${r.label} | ${r.deep?.machineTranslationTraces?.length ?? '-'} | ${s?.machineTranslationTracesFreeness ?? '-'} |`,
    )
  }
  for (const r of ja.runs) {
    const s = r.deep?.scores
    lines.push(
      `| ja | ${r.label} | ${r.deep?.machineTranslationTraces?.length ?? '-'} | ${s?.machineTranslationTracesFreeness ?? '-'} |`,
    )
  }
  lines.push('')

  for (const [langLabel, src] of [
    ['English (zh→en)', en],
    ['Japanese (zh→ja)', ja],
  ] as const) {
    lines.push(`### ${langLabel} — MT trace examples`)
    lines.push('')
    for (const r of src.runs) {
      lines.push(`#### ${r.label}`)
      lines.push('')
      const traces = r.deep?.machineTranslationTraces ?? []
      if (traces.length === 0) {
        lines.push('_None flagged._')
        lines.push('')
        continue
      }
      lines.push('| Source | Translation | Problem | Suggestion |')
      lines.push('| --- | --- | --- | --- |')
      for (const t of traces) {
        lines.push(
          `| ${esc(t.sourceSnippet)} | ${esc(t.translatedSnippet)} | ${esc(t.problem)} | ${esc(t.suggestion)} |`,
        )
      }
      lines.push('')
    }
  }

  // P2: source-only idiom summary
  lines.push('## P2 — Source-only idiom handling')
  lines.push('')
  lines.push('| Lang | Model | Idioms inspected | Idiom score |')
  lines.push('| --- | --- | ---: | ---: |')
  for (const r of en.runs) {
    const s = r.deep?.scores
    lines.push(
      `| en | ${r.label} | ${r.deep?.sourceOnlyIdioms?.length ?? '-'} | ${s?.sourceOnlyIdiomHandling ?? '-'} |`,
    )
  }
  for (const r of ja.runs) {
    const s = r.deep?.scores
    lines.push(
      `| ja | ${r.label} | ${r.deep?.sourceOnlyIdioms?.length ?? '-'} | ${s?.sourceOnlyIdiomHandling ?? '-'} |`,
    )
  }
  lines.push('')

  for (const [langLabel, src] of [
    ['English (zh→en)', en],
    ['Japanese (zh→ja)', ja],
  ] as const) {
    lines.push(`### ${langLabel} — Idiom handling tables`)
    lines.push('')
    for (const r of src.runs) {
      lines.push(`#### ${r.label}`)
      lines.push('')
      const items = r.deep?.sourceOnlyIdioms ?? []
      if (items.length === 0) {
        lines.push('_None flagged._')
        lines.push('')
        continue
      }
      lines.push('| Source | Rendering | Native alternative | Quality | Note |')
      lines.push('| --- | --- | --- | :-: | --- |')
      for (const t of items) {
        lines.push(
          `| ${esc(t.sourceExpression)} | ${esc(t.translatedRendering)} | ${esc(t.nativeAlternative)} | ${t.quality} | ${esc(t.note)} |`,
        )
      }
      lines.push('')
    }
  }

  // Overall narrative
  lines.push('## Overall reviewer notes')
  lines.push('')
  for (const [langLabel, src] of [
    ['English (zh→en)', en],
    ['Japanese (zh→ja)', ja],
  ] as const) {
    lines.push(`### ${langLabel}`)
    lines.push('')
    for (const r of src.runs) {
      lines.push(`#### ${r.label}`)
      lines.push('')
      for (const reason of r.deep?.overallReasons ?? []) {
        lines.push(`- ${reason}`)
      }
      lines.push('')
    }
  }

  lines.push('## Verdict')
  lines.push('')
  lines.push('- **Best English**: tie between `Claude Opus 4.6` (33/35, MT-free 5, only 1 trace flagged) and `DeepSeek V4 Pro` (33/35, MT-free 4). Opus has the cleanest prose; DeepSeek is 40% faster.')
  lines.push('- **Best Japanese**: `Claude Opus 4.6` (34/35, MT-free 5, only 1 trace flagged). Particle usage, register, and Japanese sentence rhythm are noticeably more natural than the other two.')
  lines.push('- **Fastest**: `DeepSeek V4 Pro` in both languages (140s EN / 218s JA), at a ~1-2 point cost on the 35-point scale.')
  lines.push('- **Gemini 3.1 Pro**: comparable quality to DeepSeek but consistently the slowest (221s EN / 380s JA) — no clear advantage for this content.')
  lines.push('')
  lines.push('### Recurring weaknesses across all three models')
  lines.push('')
  lines.push("- **`傻软`** (foolish-soft, internet slang): all three models flatten it to \"idiot\" / \"fool\" / \"sap\" / \"おめでたいやつ\" / \"バカみたいに\". None of them recover the *soft-hearted, easily-moved* nuance. The native alternatives the judge proposed (`hopeless sap`, `ぼーっとしたお人好し`) are within the writers' reach with a better idiom-resolution step.")
  lines.push('- **`学习委员`**: Gemini EN renders as `study commissary` (semantically wrong — *commissary* = store/canteen). DeepSeek and Opus use `class study monitor` / `学級委員`, which is the safe call.')
  lines.push("- **`结尾的结尾`** (the ending of the ending): the self-referential repetition is dropped by everyone. DeepSeek's `as a closing too far` is creative; the others go safe.")
  lines.push('- **`情绪价值`** (Chinese coined concept "emotional value"): all three lean literal — `emotional value` / `感情的価値`. A native-leaning rendering would be `emotional support` / `精神的な見返り`.')
  lines.push('')
  lines.push('## Artifacts')
  lines.push('')
  lines.push('- `tmp/translation-matrix/matrix.json` + `matrix.md` — English baseline run (initial shallow judge had a truncation bug now fixed)')
  lines.push('- `tmp/translation-matrix/deep-judge.json` + `deep-judge.md` — English 7-axis deep evaluation')
  lines.push('- `tmp/translation-matrix-ja/matrix.json` + `matrix.md` — Japanese baseline run')
  lines.push('- `tmp/translation-matrix-ja/deep-judge.json` + `deep-judge.md` — Japanese 7-axis deep evaluation')
  lines.push('- `tmp/translation-matrix*/lexical-*.json` — full translated Lexical editor states (per model, per language)')
  lines.push('- `apps/core/scripts/translation-matrix.ts` — matrix runner (vite-node)')
  lines.push('- `apps/core/scripts/translation-matrix-deep-judge.ts` — 7-axis judge runner')
  lines.push('- `apps/core/scripts/translation-matrix-deep-judge-retry.ts` — single-model judge retry with explicit scale and jsonrepair')
  lines.push('- `apps/core/scripts/translation-matrix-rebuild-md.ts` — md rebuilder from existing json')
  lines.push('- `apps/core/scripts/translation-matrix-final-report.ts` — this report generator')
  lines.push('')

  await writeFile(OUT, lines.join('\n'))
  console.log(`wrote ${OUT}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e)
  process.exitCode = 1
})
