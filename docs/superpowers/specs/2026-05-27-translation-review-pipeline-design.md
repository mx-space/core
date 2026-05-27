# Translation Review Pipeline — Design

**Date:** 2026-05-27
**Status:** Draft, awaiting user review
**Scope:** `apps/core/src/modules/ai/ai-translation/**`, `apps/core/src/modules/ai/ai.prompts.ts`

## Goal

Add a **review-then-revise** step to the AI translation pipeline so output reads natively rather than like translationese, while keeping the existing incremental block-reuse behavior intact.

## Non-goals

- Multi-round iterative refinement (max N=1 revise pass)
- Cross-article terminology glossary persistence (deferred)
- Tool-call-driven agent loops (rejected — flow is fixed-shape)
- Re-architecting incremental block reuse

## Current state

Two strategies live under `ai-translation/strategies/`:

- **`MarkdownTranslationStrategy`** — single LLM call, structured output of `{sourceLang, title, text, subtitle?, summary?, tags?}`.
- **`LexicalTranslationStrategy`** — parses Lexical JSON into `TranslationUnit`s, batches them by token budget (`MAX_BATCH_TOKENS = 4000`), runs one LLM call per batch via `callChunkTranslation`. Incremental path reuses translations of blocks whose source fingerprint is unchanged.

Both use `runtime.generateStructured` (Vercel AI SDK `generateObject`) with a zod schema; both fall back to text-mode JSON parse + repair when structured output is unsupported.

No critique/review step exists. The translation prompt heavily emphasizes "native-feel localization", but model output is accepted as-is.

## Design decisions

### D1 — Pipeline shape: sequential three-step

```
writer → reviewer → editor
```

Three independent LLM calls. Not an agent loop, not tool-call multi-turn. Each step is `runtime.generateStructured` with its own zod schema.

**Rejected alternatives:**
- Reviewer-as-judge with retry loop (latency/cost unbounded)
- Reviewer outputs full rewrite (couples critique with translation, violates separation of concerns)
- Self-refine inside one LLM call (no independent reviewer; correlated errors)
- Agent loop with `writeTranslation` / `editTranslation` tools (overkill — flow is fixed)

### D2 — Reviewer is critique-only, not revise

Reviewer emits `{score, issues[]}`. The editor (translator round 2) reads issues + original translation and emits patches. Reviewer never produces final translated text.

**Rationale:** Decouples judgment from generation. Reviewer can be a different/cheaper/stronger provider without risking it injecting its own translation style.

### D3 — Persistence: in-memory pipeline, single DB write

`writer → reviewer → editor` runs entirely in memory; the merged result writes to the DB once. No "publish first, patch later" — translation runs in a task queue (not user-realtime), so double-write would only cause event re-emission and cache churn.

**Failure fallback:** If reviewer or editor fails, the writer's initial output is persisted instead.

### D4 — Drop lexical chunking

The existing `translateChunkedUnits` (batches at `MAX_BATCH_TOKENS = 4000`) is removed. Modern LLM context windows are large enough that whole-article single-call translation is feasible and produces better cross-segment coherence.

**Removed code:**
- `LexicalTranslationStrategy.translateChunkedUnits`
- `MAX_BATCH_TOKENS`
- Per-batch retry loop in `translateChunkedUnits`

**Kept code:**
- Incremental block-reuse (`backfillReusableBlockTranslations`)
- `documentContext` extraction
- Unit-level retry on missing translations (collapsed into a single whole-article retry)

### D5 — Incremental + review interaction

The reviewer sees the **full translated text** (unchanged-reused old translations + newly translated changed segments), so it can judge global coherence. But the prompt **constrains issue IDs to changed segments only**.

This means:
- Reviewer can detect "this new paragraph clashes with the old paragraph before it" but cannot flag the old paragraph for rewrite.
- Cross-segment style drift is acknowledged but not aggressively fixed; it's the cost of incremental savings.

Future work (deferred): glossary persistence per article — reviewer emits term constraints that bind future incremental translations.

### D6 — Review gating

- **T1**: If incremental mode hits zero changed entries (full reuse) → skip review entirely, persist as-is.
- **Score threshold**: If reviewer's `score >= configured threshold` (default 85) **or** `issues = []` → skip edit, persist writer's output.
- **Issue severity**: All issues are passed to editor; severity only feeds metrics.

### D7 — Reviewer model independence

Reviewer is configured separately from translator: `model`, `provider`, `reasoningEffort`. Recommended default: cross-family pairing (e.g., translator on Anthropic, reviewer on OpenAI) to mitigate correlated-error blind spots.

Both runtimes obtained via existing `ai.service.ts` runtime factory.

### D8 — Tool / schema shapes

#### writeTranslation (lexical)

```ts
z.object({
  sourceLang: z.string(),
  translations: z.object({
    // Per-segment keys synthesized from the current call's textEntries.
    // Includes reserved keys: __title__, __subtitle__, __summary__, __tags__
    // (tags joined by `|||`).
  }).strict(),
})
```

#### writeTranslation (markdown)

```ts
z.object({
  sourceLang: z.string(),
  title: z.string(),
  text: z.string(),
  subtitle: z.string().nullable(),
  summary: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
})
```

#### reviewerOutput (unified)

```ts
z.object({
  score: z.number().int().min(0).max(100),
  issues: z.array(z.object({
    id: z.string(),         // segment id | field name | "text:p<N>"
    severity: z.enum(['minor', 'major']),
    problem: z.string(),
    hint: z.string().optional(),
  })),
})
```

#### editTranslation (lexical)

```ts
z.object({
  patches: z.record(z.string(), z.string()),
  // key MUST be in the original translations.keys set
})
```

#### editTranslation (markdown)

```ts
z.object({
  patches: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).optional(),
    // Per-paragraph patches under text, keyed as "text:p0", "text:p1", ...
  }).catchall(z.string()),
})
```

### D9 — Markdown paragraph splitting (for review/edit IDs)

A new util `markdown-paragraph-splitter.ts`:

```ts
splitMarkdownIntoParagraphs(text: string): Array<{ id: string; text: string }>
joinMarkdownParagraphs(paragraphs: Array<{ id: string; text: string }>): string
```

Rules:

- Split on `\n\n+` (one or more blank lines).
- Fenced code blocks (` ``` ... ``` `) are **kept as one paragraph** — splitter scans for opening/closing fences and never splits inside.
- Paragraph ID = `text:p<index>` where index counts only non-empty paragraphs from 0.
- Round-trip stable: `join(split(x))` semantically equivalent to `x` (whitespace-normalized).

For the markdown writer prompt, the splitter is **not used** — writer emits full `text` field. The splitter only runs:
1. Before reviewer: split `fullTranslated.text` to label paragraphs in the review payload.
2. Before editor: same labeling, so editor's `patches["text:p3"]` targets the right paragraph.
3. After editor: replace flagged paragraphs in-place, then `join` back.

### D10 — Implementation A (3× generateStructured)

```ts
// Pseudocode for BaseTranslationService.translate (post-refactor)

const initial = await callWriter(content, targetLang, runtime, ...)

if (incrementalAndFullReuse) {
  return persist(initial)  // T1 gate
}

if (!reviewConfig.enabled) {
  return persist(initial)  // global disabled
}

const fullTranslated = mergeWithReused(initial, allTranslations)

let review: ReviewerOutput
try {
  review = await callReviewer(reviewerRuntime, {
    fullTranslated,
    changedIds: collectChangedIds(initial),
    sourceLang: initial.sourceLang,
    targetLang,
  })
} catch (e) {
  logger.warn(`Reviewer failed, persisting initial: ${e.message}`)
  return persist(initial)
}

if (review.score >= reviewConfig.scoreThreshold || review.issues.length === 0) {
  return persist(initial)
}

let edited: EditTranslationOutput
try {
  edited = await callEditor(runtime, { initial, review, content })
} catch (e) {
  logger.warn(`Editor failed, persisting initial: ${e.message}`)
  return persist(initial)
}

const merged = applyPatches(initial, edited.patches)
return persist(merged)
```

### D11 — Configuration

Add to `ai.config.ts` schema:

```ts
translation: {
  // ... existing ...
  review: {
    enabled: boolean,                  // default false initially, enable per-deployment
    model: string,                     // e.g. "gpt-4o-mini"
    provider: string,                  // resolved by runtime factory
    scoreThreshold: number,            // default 85
    reasoningEffort: 'none' | 'low' | 'medium' | 'high',  // default 'low'
  },
}
```

Reviewer runtime obtained via existing `AiService.getRuntime({ model, provider })` — no factory changes.

### D12 — Failure modes

| Stage | Failure | Behavior |
|---|---|---|
| writer call | Network/JSON failure | Existing fallback (text-mode parse + jsonrepair). Same as today. |
| writer call | Repeated failure | Throws, task fails (same as today). |
| reviewer call | Any error | `logger.warn`, persist initial. No retry. |
| reviewer output | Schema parse failure | Same as call error → persist initial. |
| editor call | Any error | `logger.warn`, persist initial. No retry. |
| editor patches | Key not in original translations | Skip that patch, increment metric, continue. |
| editor patches | Empty patches | Persist initial. |

No retries on review/edit — they are best-effort polish.

### D13 — Prompts

Three new/changed prompt builders in `ai.prompts.ts`:

- **`translationWriter(...)`** — current `translationChunk` / `translation` repurposed. No major prompt change beyond removing chunk-specific instructions.
- **`translationReviewer(targetLang, payload)`** — new. Returns `{systemPrompt, prompt, schema: reviewerOutputSchema, reasoningEffort}`. System prompt emphasizes:
  - Concrete rubric: register match, native collocations, idiomatic phrasing, absence of literalness markers (e.g. unnatural calques, mirrored source syntax).
  - Reviewer is critique-only; do not propose rewrites in `issues[].hint` beyond a phrase-level cue.
  - Score scale anchored: 100 = native-original, 85 = polished translation, 70 = readable but stiff, ≤60 = translationese.
  - **Allowed `issues[].id` set is provided in the user prompt** (the changed-IDs list); MUST NOT emit IDs outside this set.
- **`translationEditor(targetLang, payload)`** — new. System prompt emphasizes:
  - Issues list is mandatory input; address each flagged issue.
  - Output `patches` keyed exactly by `issues[].id` (or a subset; unaddressed issues are dropped silently).
  - Each patch value MUST be the full revised text for that id; not a diff.
  - Preserve formatting/markdown/code/mermaid invariants from the original writer system prompt.

### D14 — Observability

Per translation task, log:

- `pipeline=writer` / `reviewer` / `editor` with model, provider, token usage (when SDK exposes), latency.
- `review.score`, `review.issuesCount`, `review.skippedReason` (threshold | empty | full-reuse | disabled).
- `editor.patchesApplied`, `editor.patchesDropped` (invalid keys).

Metrics names (Prometheus-style if registered):
- `ai_translation_review_score_histogram`
- `ai_translation_review_skip_total{reason}`
- `ai_translation_editor_patches_applied_total`
- `ai_translation_editor_patches_dropped_total`

## File-level change inventory

### New files

- `apps/core/src/modules/ai/ai-translation/reviewer.service.ts` — encapsulates `callReviewer(runtime, payload) → ReviewerOutput`.
- `apps/core/src/modules/ai/ai-translation/markdown-paragraph-splitter.ts` — `splitMarkdownIntoParagraphs`, `joinMarkdownParagraphs`, with fenced-code awareness.

### Modified files

- `apps/core/src/modules/ai/ai-translation/strategies/base-translation-strategy.ts`
  - Rename `callChunkTranslation` → `callWriter` (semantically clearer).
  - Add `callEditor(runtime, { initial, review, payload })`.
  - No change to JSON repair / parse fallbacks.

- `apps/core/src/modules/ai/ai-translation/strategies/lexical-translation.strategy.ts`
  - Remove `translateChunkedUnits`, `MAX_BATCH_TOKENS`, batch loop.
  - `translateFull` / `translateIncremental` call `callWriter` once with all units.
  - After writer returns, build `fullTranslated`, call reviewer if enabled, call editor on issues, apply patches.

- `apps/core/src/modules/ai/ai-translation/strategies/markdown-translation.strategy.ts`
  - Insert review + edit step between writer and result.
  - Use paragraph splitter for review/edit payloads on `text` field.

- `apps/core/src/modules/ai/ai.prompts.ts`
  - Repurpose `translationChunk` → `translationWriter` (drop chunk-specific language).
  - Add `translationReviewer`, `translationEditor`.

- `apps/core/src/configs/configs.schema.ts` (or wherever `translation` config schema lives)
  - Add `review.{enabled, model, provider, scoreThreshold, reasoningEffort}`.

- `apps/core/src/modules/ai/ai-translation/ai-translation.service.ts`
  - Inject reviewer config; resolve reviewer runtime via `AiService.getRuntime`.
  - Thread `reviewerRuntime` (or `undefined` when disabled) through to strategies.

### Test surface

- Unit tests for `markdown-paragraph-splitter.ts`: fenced code, nested lists, edge whitespace.
- Strategy tests for both strategies covering:
  - Review disabled → behaves like today (writer only).
  - Reviewer returns empty issues → no edit call.
  - Reviewer returns issues → editor called, patches applied.
  - Reviewer fails → falls back to initial.
  - Editor fails → falls back to initial.
  - Editor returns invalid keys → patches skipped, metric incremented.
  - Lexical incremental + review: reviewer prompt receives changed-IDs set; out-of-set IDs in response are dropped.

### D15 — E2E smoke test (live OpenRouter)

A live smoke test exercises the full `writer → reviewer → editor` pipeline against a real LLM via OpenRouter. It is **not** part of the default CI run; it requires `OPENROUTER_TOKEN` and is invoked manually or in a nightly job.

The smoke test has two distinct purposes which the assertions structure reflects:

- **Hard assertions** (always pass/fail): pipeline runs, structural invariants hold, no key explodes. These are reproducible regardless of LLM stochasticity.
- **Quality observations** (log + per-run markdown report): translation quality, revise effectiveness, structural fidelity. LLM output is not deterministic, so these are **informational signals** captured for human review, never gated.

This separation is non-negotiable: gating CI on LLM quality scores leads to flaky tests. Quality is reviewed by humans reading the report; assertions only protect against regressions in the deterministic plumbing.

#### Test file

`apps/core/test/src/modules/ai/translation-review-pipeline.live.e2e-spec.ts`

#### Naming convention

The `.live.e2e-spec.ts` suffix distinguishes tests that hit live external APIs from the existing `*-e2e.spec.ts` files (which run against testcontainers / in-process mocks). Vitest config excludes `*.live.e2e-spec.ts` from the default `pnpm test` glob; a separate npm script `pnpm test:live` opts in.

#### Fixtures

- `data/lexical/sample-1.json` and `data/lexical/sample-2.json` — real article Lexical JSON documents (231 KB and 179 KB). Source language is detected at test setup time (`parseLexicalForTranslation` + a quick text-snippet language guess) so the test does not hardcode a direction; whichever sample is EN drives the EN→JA case, whichever is JA drives the JA→EN case. If both are the same language, the test logs a warning and reuses sample-1 for both directions (translating EN→JA, then translating the result back to verify the reverse path).
- A small inline markdown fixture for the markdown-strategy case: title, 4–6 paragraphs, one fenced code block, one nested list. Constructed in the spec file, not loaded from disk.

#### Model

- Translator: `deepseek/deepseek-v4-pro` (exact OpenRouter slug TBD at implementation time; spec assumes this exists, with a test-side env override `SMOKE_TRANSLATOR_MODEL` for fallback).
- Reviewer: same model in default smoke config. (Cross-family pairing is a deployment concern; the smoke test does not enforce it. A second optional env var `SMOKE_REVIEWER_MODEL` lets a developer try cross-family locally.)

Both routed through `runtime.factory` with provider `openrouter` (OpenAI-compatible endpoint at `https://openrouter.ai/api/v1`, bearer = `OPENROUTER_TOKEN`).

#### Skip condition

```ts
const TOKEN = process.env.OPENROUTER_TOKEN
describe.skipIf(!TOKEN)('translation review pipeline (live)', () => { /* ... */ })
```

CI without the secret silently skips. Local runs without `.env` likewise skip.

#### Per-case data captured

For every live case, the test harness records the following stages and observations into a structured `CaseReport` object:

```ts
interface CaseReport {
  caseName: string
  direction: { source: string; target: string }
  timings: { writerMs: number; reviewerMs: number | null; editorMs: number | null }

  writer: {
    segmentCount: number               // total segments / fields produced
    nonEmptyCount: number
    targetLangCharRatio: number        // chars matching target-lang script / total non-ASCII chars
    detectedSourceLang: string
    sampleSegments: Array<{ id: string; source: string; output: string }>  // first 5 for human review
  }

  reviewer: {
    invoked: boolean
    skippedReason: string | null       // 'full-reuse' | 'disabled' | null
    score: number
    issuesCount: number
    issuesBySeverity: { minor: number; major: number }
    issueIds: string[]                 // for cross-checking edit coverage
    sampleIssues: Array<{ id: string; problem: string; hint?: string }>  // first 5
  } | null

  editor: {
    invoked: boolean
    skippedReason: string | null       // 'empty-issues' | 'score-above-threshold' | null
    patchKeysRequested: string[]       // keys editor returned
    patchKeysApplied: string[]         // keys that actually overwrote initial
    patchKeysDropped: string[]         // out-of-set, skipped
    addressedIssueRatio: number        // |patchKeysApplied ∩ reviewer.issueIds| / |reviewer.issueIds|
    samplePatches: Array<{ id: string; before: string; after: string }>  // first 5 applied
  } | null

  quality: {
    rereviewScore: number              // run reviewer once more over final output
    rereviewIssuesCount: number
    scoreDelta: number                 // rereviewScore - writer's pre-edit score
    issuesDelta: number                // rereviewIssuesCount - reviewer.issuesCount
  } | null

  structure: {
    lexical?: {
      sourceSegmentCount: number
      outputSegmentCount: number
      roundTripParses: boolean         // restored JSON re-parses cleanly
      mermaidValidationsPassed: number
      mermaidValidationsRejected: number
    }
    markdown?: {
      paragraphCountSource: number
      paragraphCountOutput: number
      fencedCodeBlocksPreserved: boolean
      listMarkersPreserved: boolean
    }
  }
}
```

This data answers the user's four observation goals directly:

| Goal | Where it appears |
|---|---|
| 1. Initial writer output | `writer.*` (segment counts, samples, lang ratio) |
| 2. Did the edit succeed | `editor.invoked`, `editor.addressedIssueRatio`, `editor.samplePatches` (before/after diff) |
| 3. Quality after edit | `quality.rereviewScore`, `quality.scoreDelta`, `quality.issuesDelta` |
| 4. Structure damage | `structure.*` (segment counts, round-trip parse, fence/list preservation) |

#### Test cases

1. **Lexical EN → JA** (sample with EN source)
2. **Lexical JA → EN** (sample with JA source)
3. **Markdown EN → JA** (inline fixture)
4. **Markdown JA → EN** (inline fixture, reverse direction)
5. **T1 skip path** — second incremental pass on the lexical EN→JA result, no content change; spy verifies `callReviewer` never invoked.
6. **Threshold skip path** — set threshold = 0; assert `editor.invoked === false` and final output bytes equal initial.
7. **Editor invalid-patch handling** — mock reviewer to inject one out-of-set issue ID; assert `editor.patchKeysDropped` is non-empty and the run completes successfully.

Cases 1–4 are the **quality-observation cases**; 5–7 are **deterministic invariant cases**.

#### Hard assertions (per case 1–4)

These MUST pass — they catch regressions independent of LLM quality:

- `report.writer.segmentCount > 0` and `report.writer.nonEmptyCount === report.writer.segmentCount`.
- `report.writer.targetLangCharRatio > 0.5` (loose floor — sanity check that the model translated, not echoed).
- No translated value contains the literal strings `undefined`, `null`, `[object Object]`, or unresolved template markers like `${`.
- For lexical: `structure.lexical.roundTripParses === true`; `structure.lexical.sourceSegmentCount === structure.lexical.outputSegmentCount` (writer must not invent or drop segments).
- For lexical: `structure.lexical.mermaidValidationsRejected === 0`.
- For markdown: `structure.markdown.fencedCodeBlocksPreserved === true`; paragraph counts agree pre/post.
- All `editor.patchKeysApplied` ⊆ initial-translations key set (the patch invariant the design promises).
- Pipeline completes without throwing.

#### Quality observations (per case 1–4, log + report only)

Captured into `tmp/translation-review-smoke-<timestamp>.md`, one section per case, structured for human review:

```md
## Case 1 — Lexical EN → JA

**Timings:** writer 4.2s · reviewer 1.8s · editor 2.3s

### 1. Initial writer output
- segments: 142 / 142 non-empty
- target-language char ratio: 0.87
- detected sourceLang: en
- samples (5):
  - t_3: "On the road again..."  →  "また旅に出る..."
  - t_7: ... → ...

### 2. Revise step
- reviewer score: 76 / 100 (threshold: 85)
- issues: 12 (minor: 9, major: 3)
- editor invoked: yes
- patches: 11 applied, 1 dropped (out-of-set: t_99)
- addressedIssueRatio: 0.92
- before / after samples (5):
  - t_3: "また旅に出る..."  →  "また旅路の途中で..."
  - t_7: ... → ...

### 3. Quality after edit
- re-review score: 88 (Δ +12)
- re-review issues: 4 (Δ -8)

### 4. Structural fidelity
- segment count source/output: 142 / 142
- round-trip parse: ok
- mermaid validations: 3 passed, 0 rejected
```

The report file is **the** artifact a human inspects after a live run. Cases 5–7 also append their structural results but no quality block.

#### Timeout

Each test case allowed up to 120 seconds (`{ timeout: 120_000 }`); large fixtures + re-review pass can push a single case to 60–90s on a slow OpenRouter route.

#### Npm script

```json
"test:live": "vitest run --include 'test/**/*.live.e2e-spec.ts'"
```

#### Cost ceiling

Sample articles total ~50 KB. Worst case per full run (4 quality cases × 4 calls each [writer + reviewer + editor + re-review] + 3 cheap deterministic cases) ≈ 19 LLM calls. At ~30K input tokens average on DeepSeek-V4-Pro OpenRouter pricing, estimated total cost per smoke run: under USD $2. Acceptable for manual/nightly invocation; do **not** auto-trigger on every CI commit.

#### Why not assert on quality scores

LLM output is non-deterministic. A `finalScore > 80` assertion would pass 9/10 runs and fail intermittently, training the team to ignore failures or pin a model version (which we already do, but the model itself drifts). Quality is judged by reading the report — humans calibrate against multiple runs over time. Tests stay green when the plumbing is correct.

## Rollout

1. Land code with `review.enabled = false` in default config.
2. Add per-deployment opt-in.
3. After internal validation (qualitative review of ~50 translations, plus repeated `pnpm test:live` runs), enable by default.

## Open questions for user review

- **Default review provider**: Anthropic translator + OpenAI reviewer? Or symmetric (both Anthropic)? Cross-family is recommended but requires both API keys configured. Leave as deployment config; no hardcoded default cross-family pairing.
- **Score threshold default 85**: empirically calibrated only after rollout. Treat 85 as placeholder.
- **Metric backend**: project already uses `prom-client`? Confirm before wiring metric names.
