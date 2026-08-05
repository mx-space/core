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
| `endpoint` | string | `''` | Required when `provider === 'custom'`, validated in `configs.service.ts` like the image endpoint check. |
| `model` | string | `''` | e.g. `openai/gpt-4o-mini-tts-2025-12-15` |
| `voice` | string | `''` | Voice availability is model-dependent; free text. |
| `speed` | number | `1` | Range 0.25–4. |
| `maxCharsPerChunk` | number | `1800` | Below the 4096-char ceiling most providers enforce. |
| `concurrency` | number | `3` | Parallel synthesis requests per task. |

`format` is not configurable — mp3 only.

Defaults are added to `configs.default.ts`; `configs.interface.ts` gets the
`ttsOptions` key; `configs.dsl.util.ts` adds `'ttsOptions'` to the `ai` group's
`sectionKeys` so the settings page renders it with no admin-side code.

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

The migration is purely additive (two `CREATE TABLE`s plus indexes), so it is
safe under the rolling two-replica deploy with no expand-contract phasing. It
still goes through `mx-migration-author` and `pnpm -C apps/core run lint:migrations`.

Repositories extend `BaseRepository` and register in `repository.tokens.ts`.

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
  run together (`LexicalService.extractBlockText` concatenates children with no
  separator — correct for fingerprinting, wrong for speech, hence a dedicated
  walker here).
- Bare URLs in link nodes are dropped; the link's visible text is kept.
- Whitespace is collapsed. Blocks whose extracted text is empty after cleaning
  are skipped entirely.

### Identity and chunking

Block identity and fingerprints come from `LexicalService.extractRootBlocks`
(`{ id, type, text, fingerprint, index }`, fingerprint = `md5(type:normalizedText)`).
Reusing it keeps TTS and translation on one definition of "block changed".

Stored Lexical content already carries block ids via
`LexicalService.normalizeContentForStorage`. Defensively, a block with a null id
is keyed as `idx:${index}` and a warning is logged — such a block loses reuse
whenever surrounding blocks shift, which is acceptable for legacy content.

Blocks longer than `maxCharsPerChunk` are split on sentence boundaries (CJK
`。！？` and Latin `.!?` followed by whitespace), falling back to a hard cut when
a single sentence exceeds the limit. Chunking is a pure deterministic function of
the block text, so an unchanged fingerprint implies unchanged chunks — the
fingerprint alone is a sufficient reuse key.

### Diff

```ts
planTts(currentBlocks, existingRows): {
  toGenerate: Array<{ blockId, chunkIndex, text, fingerprint }>
  toReuse: Array<{ blockId, chunkIndex }>
  toDelete: Array<{ id, url }>
  blockOrder: string[]
  charCount: number
}
```

- fingerprint matches an existing row for the same `(blockId, chunkIndex)` → reuse
- fingerprint differs, or no row exists → generate
- rows whose `blockId` is absent from the current document, or whose
  `chunkIndex` exceeds the new chunk count → delete (row plus stored file)

`force` mode skips the comparison: everything goes to `toGenerate`, everything
existing goes to `toDelete`.

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

`computeAITaskDedupKey` returns `${refId}:${(langs ?? []).sort().join(',')}` — the
same convention as summary/translation. `AiTaskService.createTtsTask` fills
article info via the existing `fillArticleInfo`.

`AiTtsService` registers a handler on `TaskQueueProcessor`, mirroring
`AiImageService`:

1. Read `ttsOptions`. Throw `TTS_DISABLED` when disabled,
   `TTS_PROVIDER_NOT_CONFIGURED` when `apiKey`/`model`/`voice` are missing.
2. Resolve target languages. `langs` omitted ⇒ source language only. The source
   language is the article's `meta.lang`, read through the existing
   `BaseTranslationService.getMetaLang(document)`, falling back to
   `DEFAULT_SUMMARY_LANG` (`'zh'`). Every requested language is normalized with
   `parseLanguageCode`. Rows for the source language carry
   `is_translation = false` and `source_lang = null`; rows for a translated
   language carry `is_translation = true` and `source_lang` = the resolved
   source language. Each language is processed independently; a failure in one
   does not abort the others — it is logged via `context.appendLog('warn', …)`
   and recorded in the task result.
3. Resolve content per language: source language reads the article's Lexical
   content; a translated language reads `ai_translations.content` for
   `(refId, lang)`. When that row is missing or its `contentFormat` is not
   `lexical`, skip the language with a warning (`TTS_SOURCE_NOT_LEXICAL` is only
   thrown when *every* requested language fails this way).
4. Resolve effective voice config: existing row + no `force` ⇒ the row's stored
   `model/voice/speed`; new row or `force` ⇒ current global config.
5. `planTts(...)`.
6. Synthesize `toGenerate` with `p-limit(concurrency)`. Each chunk:
   `throwIfAborted(context.signal)` → `runtime.generateSpeech` →
   `fileService.uploadBuffer(buffer, { type: 'audio', originalFilename:
   'tts-{refId}-{lang}-{blockId}-{chunkIndex}.mp3', contentType: 'audio/mpeg' })`.
   After each chunk, `context.updateProgress(done / total, …, done, total)`.
7. Persist in one transaction: upsert `ai_tts` (config, `block_order`,
   `char_count`), insert/update the generated block rows, delete `toDelete` rows.
   Stored files for deleted rows are removed after the transaction commits;
   a failure to delete a file is logged, never fatal.
8. `context.setResult({ perLang: [{ lang, ttsId, total, generated, reused, deleted, charCount }], skipped: [...] })`.

Abort and failure semantics: chunks that already uploaded and committed stay in
the database, so a re-run resumes incrementally instead of paying for them
again. A chunk that still fails after the adapter's retries fails the whole
language with `TTS_GENERATION_FAILED`; no partial row is left in a corrupt state
because `block_order` is only written together with the block rows.

`FileType` gains an `audio` member (`modules/file/file.type.ts`) and `audio` is
added to the S3 branch whitelist in `FileService.uploadBuffer`, which today only
routes `image | file | video` to S3.

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

The public route enforces article visibility through the existing
`ai-article-visibility.util.ts` helper, exactly as the summary and insights
public routes do.

Views live in `ai-tts.views.ts` (`detail | listItem | public`) and are parsed at
the controller layer. Responses use the standard envelope and snake_case
transform — no `RawResponse`, no SSE. Generation progress is delivered by the
existing task-queue WebSocket channel; no new streaming protocol is introduced.

`packages/api-client/controllers/ai.ts` gains a `tts` group
(`tts.article(id).get({ lang })`) for Yohaku.

### Article detail meta

`common/response/meta.types.ts`:

```ts
export const TtsMetaSchema = z
  .object({
    available: z.boolean(),
    lang: z.string().optional(),
    blockCount: z.number().optional(),
    updatedAt: z.date().optional(),
  })
  .strict()
```

`PostResponseMetaSchema` and `NoteResponseMetaSchema` each gain an optional
`tts` key; `PostMetaBuilder` and `NoteMetaBuilder` each gain a `.tts()` method,
following the `insights` precedent.

Population sites — the three detail assemblies that already call
`.insights({ hasInLocale })`:

- `modules/post/post.controller.ts` (detail handler, alongside `insightsLang`)
- `modules/note/note.controller.ts` (two handlers)

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

All are raised through `createAppException`, so the global filter renders the
standard `{ error: { code, message, details? } }` envelope.

## 9. Testing

Unit — `tts-block-plan.spec.ts` (pure, no mocks):

- whitelist filtering keeps prose blocks, drops code/mermaid/table/image
- list items are joined with separators rather than concatenated
- chunking splits on sentence boundaries and respects `maxCharsPerChunk`
- diff classifies reuse / regenerate / delete correctly, including a block moved
  to a new position (reused, `block_order` updated) and a chunk-count reduction
  (trailing chunks deleted)
- `force` routes everything to generate + delete

Faux e2e — `test/src/modules/ai/ai-tts.faux.e2e.spec.ts`, following the existing
faux-suite conventions (stub runtime returning a fixed buffer, stub
`FileService`, no network):

- first run generates every block and writes `block_order` in document order
- editing one block on a second run regenerates only that block and reuses the rest
- deleting a block removes its row and requests file deletion
- `force` regenerates everything and adopts the new global voice config, while a
  normal incremental run keeps the row's locked config
- disabled config and missing credentials produce the documented error codes

Controller — public route returns `null` for an ungenerated article, respects
article visibility, and `meta.tts.available` flips correctly on post and note
detail responses.

## Implementation phasing

Suggested order for the plan, each phase independently verifiable:

1. **Foundation** — schema tables + migration, `ttsOptions` config (schema,
   defaults, interface, DSL group, endpoint validation), `FileType.audio` and
   the `uploadBuffer` whitelist.
2. **Planning core** — `tts-block-plan.ts` plus its unit suite. No Nest wiring.
3. **Runtime and task** — `tts-runtime.adapter.ts`, `AiTtsService`,
   `AiTtsRepository`, `AITaskType.Tts`, module registration, faux e2e suite.
4. **HTTP** — `ai-tts.controller.ts`, `ai-tts.views.ts`, error codes,
   `meta.tts` on post and note detail, api-client methods.
5. **Admin** — editor panel, management page, `api/ai.ts`, i18n, nav entry.

## Out of scope

- Reader-triggered on-demand generation
- Automatic generation on publish or update
- Word/sentence-level timestamps and karaoke-style highlighting
- Server-side concatenation into a single audio file
- Duration extraction (the column exists and stays null)
- Non-OpenAI-compatible providers such as ElevenLabs
