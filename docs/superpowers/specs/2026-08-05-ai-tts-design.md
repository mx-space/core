# AI TTS (article narration) design

Date: 2026-08-05
Status: approved, pending implementation

## Goal

Add text-to-speech narration for articles as a new feature of the AI module.
Audio is generated **per Lexical root block**, so a later edit only regenerates
the blocks that actually changed — the same incremental model the translation
feature already uses via `sourceBlockSnapshots`.

Audio is pre-generated from admin. Readers only play what already exists; the
public endpoint never triggers generation.

## Decisions

| Topic | Decision |
|---|---|
| Trigger | Admin pre-generation only. No reader-triggered generation, no publish hook. |
| Provider | Single OpenAI-compatible adapter (`POST {endpoint}/audio/speech`). Provider enum `openrouter \| openai \| custom`, mirroring `imageGenerationOptions`. |
| Text source | Full article body (Lexical), whitelisted block types only. |
| Storage granularity | One audio file per block (per chunk when a block is oversized). |
| Languages | Source language plus translated languages (`ai_translations.content`). |
| Data model | Two tables: `ai_tts` (one row per `refId` + `lang`) and `ai_tts_blocks` (one row per block/chunk). |
| Voice/model changes | Locked per `ai_tts` row at generation time. Incremental runs reuse the row's stored config; only an explicit regenerate adopts the current global config. |
| Duration | `duration_ms` stays nullable and unpopulated for now — no mp3 frame parser, no new dependency. The client `<audio>` element knows the duration. |
| Detail meta | Article detail responses carry `meta.tts` (availability flag), following the existing `meta.insights.hasInLocale` pattern. |
| Admin entry points | Article editor panel + AI management list page. |
| Access control | The public endpoint and `meta.tts` apply the same premium/paywall guard as insights and translations. Narration of a locked article is never exposed. |
| Audio file lifecycle | Owned by `ai_tts_blocks`, **not** by `FileReferenceService`. Audio uploads opt out of the pending-reference mechanism; the block row stores the storage key and the service deletes objects directly. |
| Reuse key | A dedicated speech fingerprint over the exact synthesized text, not `extractRootBlocks`' fingerprint. |
| Staleness | `ai_tts.source_modified_at` is compared against the article's `modifiedAt`; `meta.tts.stale` tells the client the narration predates the current text. |

## 1. Provider runtime

OpenRouter exposes `POST /api/v1/audio/speech`, byte-compatible with the OpenAI
Audio Speech API: body `{ model, input, voice, response_format, speed }`,
response is a raw audio byte stream (not JSON). `response_format` defaults to
`pcm` on OpenRouter, so `mp3` must always be sent explicitly. The same shape is
served by OpenAI, SiliconFlow, Groq, Fish Audio and local kokoro servers, so one
adapter covers every provider we care about.

New file `modules/ai/ai-tts/tts-runtime.adapter.ts`, modelled on
`ai-image/image-runtime.adapter.ts`:

```ts
interface TtsGenerateOptions {
  input: string
  voice: string
  speed: number
  format: 'mp3'
  providerParams?: Record<string, unknown>
  signal?: AbortSignal
}

interface ITtsRuntime {
  generateSpeech(options: TtsGenerateOptions): Promise<{
    buffer: Buffer
    mimeType: string
  }>
}
```

Behaviour:

- `POST {endpoint}/audio/speech` with `Authorization: Bearer {apiKey}`.
- Retries 3 times with exponential backoff on network errors and 5xx/429; 4xx
  fails immediately (bad model id, bad voice, quota exhausted).
- A non-audio `Content-Type` in the response is treated as an error and the body
  is surfaced in the message — providers return JSON errors with HTTP 200 in
  some edge cases.
- `mimeType` is `audio/mpeg` for `mp3`.

This adapter does **not** go through the pi runtime. The
`apps/core/CLAUDE.md` "everything through pi" invariant covers text generation;
pi has no speech-synthesis surface, and `ai-image` already sets the precedent of
a dedicated adapter for a non-text modality.

## 2. Configuration

New section `ttsOptions` in `modules/configs/configs.schema.ts`, shaped like
`ImageGenerationOptionsSchema`:

| Field | Type | Default | Notes |
|---|---|---|---|
| `enable` | boolean | `false` | |
| `provider` | `openrouter \| openai \| custom` | `openrouter` | |
| `apiKey` | string | `''` | |
| `endpoint` | string | `''` | Required when `provider === 'custom'`, validated in `configs.service.ts` like the image endpoint check. Presets: `openrouter` → `https://openrouter.ai/api/v1`, `openai` → `https://api.openai.com/v1`. The adapter appends `/audio/speech`. |
| `model` | string | `''` | e.g. `openai/gpt-4o-mini-tts-2025-12-15` |
| `voice` | string | `''` | Voice availability is model-dependent; free text. |
| `speed` | number | `1` | Validated 0.25–4. Individual providers narrow this further (Groq, for example); a provider-side rejection surfaces as `TTS_GENERATION_FAILED`. |
| `maxCharsPerChunk` | number | `1800` | Validated 200–4000, below the 4096-char ceiling most providers enforce. |
| `concurrency` | number | `3` | Validated 1–8. Parallel synthesis requests within one task. |
| `maxCharsPerRun` | number | `120000` | Per language, per run. Exceeding it fails the language with `TTS_BUDGET_EXCEEDED` instead of silently spending. |

`format` is not configurable — mp3 only.

The `openrouter | openai | custom` enum intentionally adds an `openai` preset
that `imageGenerationOptions` (`openrouter | custom`) does not have, because the
OpenAI speech endpoint is a first-class target here.

Wiring a config section touches five places, all required:

1. `configs.schema.ts` — the `section(...)` definition, `apiKey` marked as a
   password field, plus an entry in `configSchemaMapping`
2. `configs.default.ts` — defaults
3. `configs.interface.ts` — the `ttsOptions` key on `IConfig`
4. `configs.dsl.util.ts` — `'ttsOptions'` appended to the `ai` group's `sectionKeys`
5. `configs.service.ts` — the `provider === 'custom'` endpoint check and numeric
   range validation, next to the existing `imageGenerationOptions` check

## 3. Data model

New tables in `packages/db-schema/src/schema/ai.ts`:

```ts
export const aiTts = pgTable(
  'ai_tts',
  {
    id: pkText(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    refId: refText('ref_id').notNull(),
    lang: text('lang').notNull(),
    isTranslation: boolean('is_translation').notNull().default(false),
    sourceLang: text('source_lang'),
    model: text('model').notNull(),
    voice: text('voice').notNull(),
    speed: real('speed').notNull().default(1),
    format: text('format').notNull().default('mp3'),
    blockOrder: jsonb('block_order').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    charCount: integer('char_count').notNull().default(0),
    totalDurationMs: integer('total_duration_ms'),
    sourceModifiedAt: tsCol('source_modified_at'),
  },
  (table) => [
    uniqueIndex('ai_tts_ref_lang_uniq').on(table.refId, table.lang),
    index('ai_tts_ref_id_idx').on(table.refId),
  ],
)

export const aiTtsBlocks = pgTable(
  'ai_tts_blocks',
  {
    id: pkText(),
    createdAt: createdAt(),
    ttsId: refText('tts_id')
      .notNull()
      .references((): AnyPgColumn => aiTts.id, { onDelete: 'cascade' }),
    blockId: text('block_id').notNull(),
    fingerprint: text('fingerprint').notNull(),
    chunkIndex: integer('chunk_index').notNull().default(0),
    text: text('text').notNull(),
    url: text('url').notNull(),
    storageBackend: text('storage_backend').notNull(),
    storageKey: text('storage_key').notNull(),
    byteSize: integer('byte_size'),
    durationMs: integer('duration_ms'),
  },
  (table) => [
    uniqueIndex('ai_tts_blocks_key_uniq').on(table.ttsId, table.blockId, table.chunkIndex),
    index('ai_tts_blocks_tts_id_idx').on(table.ttsId),
  ],
)
```

`block_order` holds the ordered `blockId[]` for playback; the block rows
themselves are unordered and are joined back through it. Rewriting the whole
array on every run is cheap and keeps ordering authoritative in one place.

`fingerprint` is the **speech fingerprint** defined in §4, not the value
returned by `LexicalService.extractRootBlocks`.

`storage_backend` (`s3 | local`) and `storage_key` (the S3 object key, or the
local relative path) exist because a URL alone cannot be deleted:
`S3Uploader.deleteObject` needs the object key, and the local cleanup path in
`FileReferenceService` only recognizes `/objects/image/` URLs.

Column helper notes, verified against `packages/db-schema/src/schema/columns.ts`:
`pkText()` has no default, so ids come from `SnowflakeService.nextId()` like
every other AI repository; `updatedAt()` is nullable with no default and no
auto-update, so every write sets it explicitly. `integer` is the established
numeric builder in this schema file; `real` (for `speed`) is available in
`drizzle-orm/pg-core` but not yet imported into `ai.ts`.

The migration is purely additive (two `CREATE TABLE`s plus indexes), so it is
safe under the rolling two-replica deploy with no expand-contract phasing. It
still goes through `mx-migration-author` and `pnpm -C apps/core run lint:migrations`.

`AiTtsRepository` extends `BaseRepository`, gets a `aiTts` symbol in
`POSTGRES_REPOSITORY_TOKENS`, and — like `AiSummaryRepository` and every other AI
repository — is registered as a class provider in `AiModule`, not through the
token map. `AiTtsService` is added to `AiModule`'s `exports` so the post and note
controllers can inject it for `meta.tts`.

## 4. Block planning (`tts-block-plan.ts`)

A dependency-free module: no network, no database, no Nest injection. This is
where all the interesting logic lives and where most of the tests point.

### Speakable blocks

Whitelist of Lexical root types: `paragraph`, `heading`, `quote`, `rich-quote`,
`list`. Everything else is skipped — `code`, `mermaid`, `excalidraw`, `image`,
`gallery`, `table`, `poll`, `embed`, dividers. Reading a code block or a diagram
aloud produces noise, not narration.

### Text extraction

`extractSpeakableText(node)` walks the whitelisted node and returns clean prose:

- Text and linebreak nodes contribute their content.
- `list` joins its `listitem` children with a sentence separator so items do not
  run together.
- Bare URLs in link nodes are dropped; the link's visible text is kept.
- Whitespace is collapsed. Blocks whose extracted text is empty after cleaning
  are skipped entirely.

### Identity and chunking

`LexicalService.extractRootBlocks` returns `{ id, type, text, fingerprint, index }`
but not the underlying node, and its `text` is produced by the private
`extractBlockText`, which concatenates children with no separator. That is
correct for translation but wrong as a reuse key here: list items `["ab", "c"]`
and `["a", "bc"]` collapse to the same `abc` fingerprint text while producing
different narration once separators are inserted.

Therefore:

- `LexicalService` gains a public `extractRootBlockNodes(content): Array<{ id, type, node, index }>`
  — the same walk over `root.children` and the same block-id reading as
  `extractRootBlocks`, but returning the node so callers can derive their own
  text. `extractRootBlocks` is refactored to sit on top of it; its output is
  byte-identical, so translation is unaffected.
- The reuse key is a **speech fingerprint**: `md5(`${type}:${chunkText}`)` over
  the exact string that will be sent to the provider, computed per chunk after
  cleaning and splitting. Same audio input ⇒ same fingerprint, by construction.

Stored Lexical content already carries block ids via
`LexicalService.normalizeContentForStorage`. Defensively, a block with a null id
is keyed as `idx:${index}` and a warning is logged — such a block loses reuse
whenever surrounding blocks shift, which is acceptable for legacy content.

Blocks longer than `maxCharsPerChunk` are split on sentence boundaries (CJK
`。！？` and Latin `.!?` followed by whitespace), falling back to a hard cut when
a single sentence exceeds the limit. Chunking is deterministic, so the same
cleaned block text always yields the same chunk list.

### Diff

```ts
planTts(plannedChunks, existingRows): {
  toGenerate: Array<{ blockId, chunkIndex, text, fingerprint }>
  toReuse: Array<{ rowId, blockId, chunkIndex }>
  toDelete: Array<{ rowId, storageBackend, storageKey }>
  blockOrder: string[]
  charCount: number
}
```

- speech fingerprint matches an existing row for the same `(blockId, chunkIndex)` → reuse
- fingerprint differs, or no row exists → generate
- rows whose `blockId` is absent from the current document, or whose
  `chunkIndex` exceeds the new chunk count → delete (row plus stored object)

`force` mode skips the comparison: every planned chunk goes to `toGenerate`, and
every existing row goes to `toDelete`. Because a `(blockId, chunkIndex)` key can
then appear in both sets, the pipeline always **generates and upserts first,
deletes the displaced object afterwards** — never the reverse, so a crash between
the two leaves an orphan object rather than a row pointing at a deleted file. The
delete list is keyed by row id, so an upserted row is removed from it before the
deletion pass runs.

## 5. Generation pipeline

Task type `AITaskType.Tts = 'ai:tts'` in `ai-task/ai-task.types.ts`:

```ts
interface TtsTaskPayload {
  refId: string
  langs?: string[]
  force?: boolean
  title?: string
  refType?: string
}
```

`computeAITaskDedupKey` returns
`${refId}:${force ? 'force' : 'inc'}:${canonicalLangs.join(',')}` where
`canonicalLangs` is the normalized, deduplicated, sorted language list.
`AiTaskService.createTtsTask` fills article info via the existing
`fillArticleInfo`.

Queue-level dedup is not sufficient on its own: `TaskQueueService` keys on the
dedup string with a five-minute TTL, so two enqueues with *overlapping but not
identical* language sets, or the same enqueue after the TTL lapses, both produce
concurrent runs that write the same `(refId, lang)` rows. The handler therefore
takes a Redis lock per canonical `(refId, lang)` for the duration of that
language's work, renewed while it runs. A language whose lock is already held is
skipped with a warning and reported in the task result — the in-flight run is
already doing that work.

`AiTtsService` registers a handler on `TaskQueueProcessor`, mirroring
`AiImageService`:

1. Read `ttsOptions`. Throw `TTS_DISABLED` when disabled,
   `TTS_PROVIDER_NOT_CONFIGURED` when `apiKey`/`model`/`voice` are missing.
2. Resolve target languages. `langs` omitted ⇒ source language only. The source
   language is the article's `meta.lang`, read through the existing
   `BaseTranslationService.getMetaLang(document)`, falling back to
   `DEFAULT_SUMMARY_LANG` (`'zh'`). `getMetaLang` returns the raw metadata value
   (`zh-CN`, `en_US`, anything the author typed), so it is canonicalized with
   `parseLanguageCode` before any comparison, dedup or storage — otherwise a
   `zh-CN` source and a `zh` target look like two different languages and race
   on the same row. Explicit `langs` entries are canonicalized and deduplicated
   the same way; an entry that `parseLanguageCode` cannot resolve is rejected at
   the controller rather than silently falling back to `zh`. Rows for the source
   language carry
   `is_translation = false` and `source_lang = null`; rows for a translated
   language carry `is_translation = true` and `source_lang` = the resolved
   source language. Each language is processed independently; a failure in one
   does not abort the others — it is logged via `context.appendLog('warn', …)`
   and recorded in the task result.
3. Resolve content per language: source language reads the article's Lexical
   content; a translated language reads `ai_translations.content` for
   `(refId, lang)`, and requires that row's canonical `sourceLang` to match the
   resolved source language and its `hash` to be current — a stale translation
   must not be narrated. When the row is missing, stale, or its `contentFormat`
   is not `lexical`, skip the language with a warning
   (`TTS_SOURCE_NOT_LEXICAL` is only thrown when *every* requested language
   fails this way).
4. Resolve effective voice config: existing row + no `force` ⇒ the row's stored
   `model/voice/speed`; new row or `force` ⇒ current global config.
5. `planTts(...)`. If `charCount` of `toGenerate` exceeds `maxCharsPerRun`, fail
   this language with `TTS_BUDGET_EXCEEDED` before spending anything.
6. Synthesize `toGenerate` with `p-limit(concurrency)`. Each chunk:
   `throwIfAborted(context.signal)` → `runtime.generateSpeech` →
   `fileService.uploadBuffer(buffer, { type: 'audio', originalFilename:
   'tts-{refId}-{lang}-{blockId}-{chunkIndex}.mp3', contentType: 'audio/mpeg' })`
   → **immediately upsert that block row in its own transaction**. Then
   `context.updateProgress(Math.round(100 * done / total), \`Generated ${done}/${total}\`, done, total)`
   — `updateProgress` takes a percentage, as `AiSummaryService` does.
7. Finalize in one transaction once every chunk has landed: upsert `ai_tts`
   (config, `block_order`, `char_count`, `source_modified_at`, `updated_at`),
   then delete the rows in `toDelete`. Their stored objects are removed after
   the transaction commits; a failed object deletion is logged, never fatal.
8. Before finalizing, re-read the article's `modifiedAt` and compare it with the
   value captured at step 3. A mismatch means the source changed mid-run: skip
   the finalize, log a warning, and re-enqueue the language. The per-chunk rows
   already written stay valid — they are keyed by speech fingerprint, so the
   next run reuses whatever still matches.
9. `context.setResult({ perLang: [{ lang, ttsId, total, generated, reused, deleted, charCount }], skipped: [...] })`.
   Set `TaskStatus.PartialFailed` when some languages failed and
   `TaskStatus.Failed` when all did — without an explicit `setStatus` the
   processor reports a fully successful task.

Abort and failure semantics: because each chunk is committed right after its
upload, an abort or a mid-run failure never leaves a paid-for object without a
row. A re-run reuses every committed chunk and only pays for what is missing.
`block_order` is written only at finalize, so a partially generated language is
simply not yet published — the previous `block_order` continues to serve.
A chunk that still fails after the adapter's retries fails that language with
`TTS_GENERATION_FAILED`.

### Audio file lifecycle

`FileType` gains an `audio` member (`modules/file/file.type.ts`) and `audio` is
added to the S3 branch whitelist in `FileService.uploadBuffer`, which today only
routes `image | file | video` to S3.

That alone is **not** enough, and getting it wrong destroys generated audio: the
S3 branch calls `FileReferenceService.createPendingReference` for every upload,
`activateReferences` only ever discovers *image* URLs inside documents, and
`cleanupOrphanFiles` deletes owner-pending rows older than 60 minutes. Audio
would therefore be deleted an hour after it is generated.

So `uploadBuffer` takes a `skipReference` option (or gates on
`type === 'audio'`) and creates no file-reference row for audio. `ai_tts_blocks`
*is* the reference: it stores `storage_backend` and `storage_key`, and
`AiTtsService` deletes objects directly — `S3Uploader.deleteObject(storageKey)`
for `s3`, `fs.unlink` under the audio directory for `local`.

Deletion paths that must exist:

- a block row superseded or removed by a run (§5 step 7)
- `DELETE /ai/tts/:id`
- article deletion — `refId` is polymorphic, so there is no FK cascade. Follow
  `AiSummaryService`'s explicit post/note/page delete-event handlers and add TTS
  cleanup to the same events.
- a reconciliation pass for objects orphaned by a crash between upload and
  commit, run alongside the existing orphan cleanup cron.

## 6. HTTP surface

New `ai-tts.controller.ts`, `@ApiController('ai/tts')`.

Admin (`@Auth()`):

| Route | Purpose |
|---|---|
| `POST /task` | Body `{ refId, langs?, force? }` → enqueue `AITaskType.Tts`, returns `{ taskId, created }`. |
| `GET /ref/:id` | All TTS rows for one article with their block summaries — powers the editor panel. |
| `GET /` | Paginated list for the AI management page; `withMeta(data, pagination + articles)` like `ai/summaries/grouped`. |
| `DELETE /:id` | Delete the row (blocks cascade) and remove the stored audio files. |

Public (no auth):

| Route | Purpose |
|---|---|
| `GET /article/:id?lang=` | Returns `{ lang, model, voice, blockOrder, segments: [{ blockId, chunkIndex, text, url }] }`, or `null` when nothing is generated. `lang` is normalized with `parseLanguageCode` and falls back to the article's source language when omitted; a miss returns `null` rather than falling back to another language. Never generates. |

The public route runs **two** guards, not one:

1. `isGlobalArticleVisible` from `ai-article-visibility.util.ts` — drafts,
   password-protected notes and future-dated secrets.
2. The premium/paywall guard. `isGlobalArticleVisible` checks only `isPublished`
   for posts, while `posts.isPremium` exists and both `AiInsightsService` and
   `AiTranslationService` apply their own premium check on top. Narration is the
   full article text read aloud, so it is exactly the payload a paywall exists to
   withhold: an unentitled reader gets `null`, never segments.

Both guards apply to `meta.tts` as well — a locked article reports
`available: false`, mirroring how post detail already suppresses `meta.summary`
when `paywall.locked`.

Views live in `ai-tts.views.ts` (`detail | listItem | public`) and are parsed at
the controller layer. Responses use the standard envelope and snake_case
transform — no `RawResponse`, no SSE. Generation progress is delivered by the
existing task-queue WebSocket channel; no new streaming protocol is introduced.

The global `CacheInterceptor` caches anonymous GETs for 15 seconds and may serve
them stale for up to 60 more. That window is accepted as-is: narration appearing
up to a minute late is harmless, and the cached payload is the same one the
guards above already vetted for that request's entitlement. No cache-invalidation
machinery is added. What must **not** happen is caching a response across
entitlement states — the interceptor's existing anonymous-only rule already
prevents that, and the TTS routes add no new cache key.

`packages/api-client/controllers/ai.ts` gains a flat `getTts({ articleId, lang })`
method — the controller exposes flat methods (`getSummary`, `getInsights`,
`getTranslation`), not nested groups — plus an `AITtsModel` in
`packages/api-client/models/ai.ts`.

### Article detail meta

`common/response/meta.types.ts`:

```ts
export const TtsMetaSchema = z
  .object({
    available: z.boolean(),
    lang: z.string().optional(),
    blockCount: z.number().optional(),
    stale: z.boolean().optional(),
    updatedAt: z.date().nullish(),
  })
  .strict()
```

`updatedAt` is nullish because `updatedAt()` is a nullable column with no
default — a row written by a code path that forgot to set it would otherwise
fail schema parsing.

`stale` is `article.modifiedAt > tts.sourceModifiedAt`: the narration exists but
predates the current text. Automatic regeneration on edit is out of scope, so the
client needs to know it may be hearing an older version. Both values are already
in hand at meta-assembly time, so this costs nothing extra.

`PostResponseMetaSchema` and `NoteResponseMetaSchema` each gain an optional
`tts` key; `PostMetaBuilder` and `NoteMetaBuilder` each gain a `.tts()` method,
following the `insights` precedent.

Population sites — exactly the handlers that already call
`.insights({ hasInLocale })`, and no others:

- `modules/post/post.controller.ts` — the `@Get('/:category/:slug')` detail handler
- `modules/note/note.controller.ts` — the shared note detail meta assembly (used
  by `@Get(':id')` and `@Get('/:year/:month/:day/:slug')`) and `@Get('/latest')`

`@Get('/:id')` on posts builds its metadata without insights today and is left
alone; list endpoints are untouched. If TTS is later wanted on those routes it is
an additive change, not a gap in this design.

Each adds `AiTtsService.getMetaForArticle(refId, insightsLang)` to the existing
`Promise.all` batch, reusing the `parseLanguageCode(lang)` value those handlers
already compute for insights and summary. That method runs a single existence query
(`id`, `updated_at`, `jsonb_array_length(block_order)` filtered by
`(ref_id, lang)`) and returns `{ available: false }` on miss. List endpoints do
not query TTS at all, so there is no N+1 risk.

## 7. Admin UI

**Editor panel** — `apps/admin/src/features/write/components/tts/`, patterned on
`cover-generation/`. A toolbar entry opens a drawer showing: state (not
generated / running / ready / partially failed), block and character counts, the
row's locked `model/voice/speed`, one tab per language, and a per-block list with
text and an `<audio>` preview. Two actions: **Generate** (incremental) and
**Regenerate** (`force: true`, adopts the current global config). Progress comes
from the existing task WebSocket subscription.

**Management page** — `apps/admin/src/views/(intelligence)/ai/tts/page.tsx` plus
`features/ai/routes/AiTtsRouteView.tsx`, patterned on `AiSummaryRouteView`: a
paginated table (title, language, block count, character count, updated at) with
batch enqueue, delete and regenerate.

Supporting changes: new methods in `apps/admin/src/api/ai.ts`, new keys in
`i18n/resources/en-US.ts` and `zh-CN.ts`, and a nav entry next to the existing
summary / insights / translation items. The settings form needs no admin code —
the config DSL renders `ttsOptions` automatically.

## 8. Errors

New members of `AppErrorCode`:

| Code | Status | Meaning |
|---|---|---|
| `TTS_DISABLED` | 403 | `ttsOptions.enable` is false. |
| `TTS_PROVIDER_NOT_CONFIGURED` | 400 | Missing `apiKey`, `model` or `voice`. |
| `TTS_SOURCE_NOT_LEXICAL` | 400 | No requested language has usable Lexical content. |
| `TTS_GENERATION_FAILED` | 500 | A chunk failed after the adapter's retries. |
| `TTS_BUDGET_EXCEEDED` | 400 | The planned run exceeds `maxCharsPerRun`. |

Adding a code means three registries, not one: the `AppErrorCode` enum,
`APP_ERROR_DEFINITIONS` (status + default message), and `AppErrorPayloadMap`
(the details payload type). All are raised through `createAppException`, so the
global filter renders the standard `{ error: { code, message, details? } }`
envelope.

### Cost and concurrency ceilings

`concurrency` bounds parallelism *within* one task, but `TaskQueueProcessor` runs
up to ten tasks per process, and the deployment runs two replicas — so a naive
default admits ~60 concurrent synthesis calls. Bounds:

- `maxCharsPerRun` (config, default 120000) caps one language of one run.
- A process-wide semaphore caps total in-flight synthesis calls across TTS tasks,
  independent of how many tasks are running.
- A task carries at most 8 languages; the controller rejects more.

These are guardrails against a runaway batch enqueue, not a billing system.

## 9. Testing

Unit — `tts-block-plan.spec.ts` (pure, no mocks):

- whitelist filtering keeps prose blocks, drops code/mermaid/table/image
- list items are joined with separators rather than concatenated
- **the `["ab","c"]` vs `["a","bc"]` case produces different speech fingerprints**
  — the regression that motivated a dedicated fingerprint
- chunking splits on sentence boundaries and respects `maxCharsPerChunk`
- diff classifies reuse / regenerate / delete correctly, including a block moved
  to a new position (reused, `block_order` updated) and a chunk-count reduction
  (trailing chunks deleted)
- `force` routes everything to generate + delete, and a key present in both sets
  resolves to generate-then-delete-the-displaced-object

Lexical service — `extractRootBlocks` output is byte-identical before and after
the `extractRootBlockNodes` refactor, asserted against the existing translation
fixtures so the shared parse cannot regress translation.

Faux e2e — `test/src/modules/ai/ai-tts.faux.e2e.spec.ts`, following the existing
faux-suite conventions (stub runtime returning a fixed buffer, stub
`FileService`, no network):

- first run generates every block and writes `block_order` in document order
- editing one block on a second run regenerates only that block and reuses the rest
- deleting a block removes its row and requests object deletion with the stored
  `storage_key`
- an audio upload creates **no** file-reference row, so `cleanupOrphanFiles`
  leaves it alone
- an abort mid-run leaves committed chunks intact and the previous `block_order`
  published; the next run reuses them and pays only for the remainder
- a source edit detected at finalize skips publication and re-enqueues
- `force` regenerates everything and adopts the new global voice config, while a
  normal incremental run keeps the row's locked config
- a second concurrent run for the same `(refId, lang)` is skipped by the lock
- per-language failure sets `PartialFailed`; total failure sets `Failed`
- disabled config, missing credentials and an over-budget plan produce the
  documented error codes

Controller — public route returns `null` for an ungenerated article, for a draft,
and for a paywalled article the reader is not entitled to; `meta.tts.available`
flips correctly on post and note detail responses and stays `false` when locked;
`meta.tts.stale` flips when the article is edited after generation.

## Implementation phasing

Suggested order for the plan, each phase independently verifiable:

1. **Foundation** — schema tables + migration, `ttsOptions` config (all five
   wiring points), `FileType.audio`, the `uploadBuffer` whitelist and its
   reference opt-out, error-code registries.
2. **Planning core** — `extractRootBlockNodes` on `LexicalService` (with the
   byte-identical assertion for `extractRootBlocks`), `tts-block-plan.ts`, unit
   suite. No Nest wiring.
3. **Runtime and task** — `tts-runtime.adapter.ts`, `AiTtsService`,
   `AiTtsRepository`, `AITaskType.Tts`, the per-`(refId, lang)` lock, article
   delete handlers, orphan reconciliation, module registration, faux e2e suite.
4. **HTTP** — `ai-tts.controller.ts`, `ai-tts.views.ts`, the visibility and
   premium guards, `meta.tts` on post and note detail, api-client method + model.
5. **Admin** — editor panel, management page, `api/ai.ts`, i18n, nav entry.

## Out of scope

- Reader-triggered on-demand generation
- Automatic generation on publish or update (`meta.tts.stale` reports the
  consequence rather than fixing it)
- Word/sentence-level timestamps and karaoke-style highlighting
- Server-side concatenation into a single audio file
- Duration extraction (the column exists and stays null)
- Non-OpenAI-compatible providers such as ElevenLabs. Only OpenRouter and OpenAI
  are guaranteed; a `custom` endpoint is a compatibility profile the operator
  verifies, and provider-specific limits (Groq's narrower `speed` range, for
  instance) surface as generation failures rather than being validated up front.
- Cache invalidation infrastructure (the 15s/60s anonymous cache window is
  accepted)
