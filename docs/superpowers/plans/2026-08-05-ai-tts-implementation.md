# AI TTS Article Narration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate per-block narration audio for articles from the admin, stored so that editing one block only regenerates that block.

**Architecture:** A task-queue handler splits an article's Lexical content into speakable root blocks, synthesizes each changed chunk through an OpenAI-compatible `/audio/speech` endpoint, uploads each result to a content-addressed object key, and commits one `ai_tts_blocks` row per chunk. A parent `ai_tts` row per `(refId, lang)` holds playback order and the voice config locked at generation time. Readers fetch the segment list from a public endpoint; article detail responses advertise availability through `meta.tts`.

**Tech Stack:** NestJS, Drizzle ORM (PostgreSQL), Redis, Vitest, `p-limit`, React 19 (admin).

**Spec:** `docs/superpowers/specs/2026-08-05-ai-tts-design.md`

## Global Constraints

- Comments: write **zero** comments and **zero** JSDoc unless documenting genuinely unexpected behavior or a hidden invariant. This overrides any instinct to explain code.
- API responses: return a bare value, or `withMeta(data, meta)`. Never return an object literal whose top-level key is `data`.
- Errors: throw `createAppException(AppErrorCode.X, payload?)`. Adding a code requires **three** registries — `app-error-code.ts`, `app-error-payload.ts`, `app-error-definitions.ts`.
- Case: code is camelCase end to end. `ResponseInterceptor` converts to snake_case at the wire. Never hand-convert in a controller.
- Migrations: expand-contract, additive only here. Run `pnpm -C apps/core run lint:migrations` after generating.
- Language codes are canonicalized with `parseLanguageCode` before any comparison, dedup, or storage.
- `updateProgress` takes a **percentage** (0–100), not a fraction.
- Audio objects are **never overwritten in place**. A changed chunk gets a new content-addressed key and the old object is deleted afterwards.
- Audio uploads must **not** create `FileReference` rows — `cleanupOrphanFiles` would delete them after 60 minutes.
- Tests: `pnpm -C apps/core test run <path>`. Lint only files you touched.
- Run lint after writing code. Do not run a full build.

---

## File Structure

**Created — core:**

| File | Responsibility |
|---|---|
| `packages/db-schema/src/schema/ai.ts` (modify) | `aiTts`, `aiTtsBlocks` table definitions |
| `apps/core/src/database/migrations/0026_ai_tts.sql` | Additive migration |
| `apps/core/src/modules/ai/ai-tts/ai-tts.types.ts` | Row types, plan types, runtime interface |
| `apps/core/src/modules/ai/ai-tts/tts-block-plan.ts` | Pure planning: speakable text, chunking, fingerprint, diff |
| `apps/core/src/modules/ai/ai-tts/tts-object-key.ts` | Pure content-addressed object key builder |
| `apps/core/src/modules/ai/ai-tts/tts-runtime.adapter.ts` | HTTP adapter for `/audio/speech` |
| `apps/core/src/modules/ai/ai-tts/ai-tts.repository.ts` | Drizzle queries |
| `apps/core/src/modules/ai/ai-tts/ai-tts.service.ts` | Task handler, lock, upload, commit, delete |
| `apps/core/src/modules/ai/ai-tts/ai-tts.schema.ts` | Request DTOs |
| `apps/core/src/modules/ai/ai-tts/ai-tts.views.ts` | Response views |
| `apps/core/src/modules/ai/ai-tts/ai-tts.controller.ts` | Admin + public routes |

**Modified — core:** `modules/file/file.type.ts`, `modules/file/file.service.ts`, `modules/configs/{configs.schema,configs.default,configs.interface,configs.dsl.util,configs.service}.ts`, `common/errors/{app-error-code,app-error-payload,app-error-definitions}.ts`, `common/response/meta.types.ts`, `modules/post/post-meta-builder.ts`, `modules/note/note-meta-builder.ts`, `modules/post/post.controller.ts`, `modules/note/note.controller.ts`, `modules/ai/ai.module.ts`, `modules/ai/ai-task/ai-task.types.ts`, `modules/ai/ai-task/ai-task.service.ts`, `processors/helper/helper.lexical.service.ts`, `processors/database/repository.tokens.ts`.

**Modified — packages/admin:** `packages/api-client/controllers/ai.ts`, `packages/api-client/models/ai.ts`, `apps/admin/src/api/ai.ts`, `apps/admin/src/features/write/components/tts/*`, `apps/admin/src/views/(intelligence)/ai/tts/page.tsx`, `apps/admin/src/features/ai/routes/AiTtsRouteView.tsx`, `apps/admin/src/i18n/resources/{en-US,zh-CN}.ts`.

---

## Task 1: Database schema and migration

**Files:**
- Modify: `packages/db-schema/src/schema/ai.ts`
- Create: `apps/core/src/database/migrations/0026_ai_tts.sql`

**Interfaces:**
- Consumes: nothing
- Produces: `aiTts`, `aiTtsBlocks` Drizzle tables exported from `~/database/schema`

- [ ] **Step 1: Add the tables**

In `packages/db-schema/src/schema/ai.ts`, extend the `drizzle-orm/pg-core` import with `integer` and `real`, then append:

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
    blockOrder: jsonb('block_order')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
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
    uniqueIndex('ai_tts_blocks_key_uniq').on(
      table.ttsId,
      table.blockId,
      table.chunkIndex,
    ),
    index('ai_tts_blocks_tts_id_idx').on(table.ttsId),
  ],
)
```

- [ ] **Step 2: Write the migration**

Create `apps/core/src/database/migrations/0026_ai_tts.sql`:

```sql
-- migration-lint:allow=no-bare-create-index reason=indexes target brand-new empty ai_tts tables; CONCURRENTLY cannot run inside the migration transaction
CREATE TABLE "ai_tts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"ref_id" text NOT NULL,
	"lang" text NOT NULL,
	"is_translation" boolean DEFAULT false NOT NULL,
	"source_lang" text,
	"model" text NOT NULL,
	"voice" text NOT NULL,
	"speed" real DEFAULT 1 NOT NULL,
	"format" text DEFAULT 'mp3' NOT NULL,
	"block_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"char_count" integer DEFAULT 0 NOT NULL,
	"total_duration_ms" integer,
	"source_modified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_tts_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tts_id" text NOT NULL,
	"block_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"url" text NOT NULL,
	"storage_backend" text NOT NULL,
	"storage_key" text NOT NULL,
	"byte_size" integer,
	"duration_ms" integer
);
--> statement-breakpoint
ALTER TABLE "ai_tts_blocks" ADD CONSTRAINT "ai_tts_blocks_tts_id_ai_tts_id_fk" FOREIGN KEY ("tts_id") REFERENCES "public"."ai_tts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_tts_ref_lang_uniq" ON "ai_tts" USING btree ("ref_id","lang");
--> statement-breakpoint
CREATE INDEX "ai_tts_ref_id_idx" ON "ai_tts" USING btree ("ref_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_tts_blocks_key_uniq" ON "ai_tts_blocks" USING btree ("tts_id","block_id","chunk_index");
--> statement-breakpoint
CREATE INDEX "ai_tts_blocks_tts_id_idx" ON "ai_tts_blocks" USING btree ("tts_id");
```

Register it in `apps/core/src/database/migrations/meta/_journal.json` following the shape of the existing `0025` entry, and add the matching `0026_snapshot.json`. If `pnpm -C apps/core exec drizzle-kit generate` reproduces this SQL, prefer its generated output and snapshot over the hand-written file.

- [ ] **Step 3: Verify the migration lints**

Run: `pnpm -C apps/core run lint:migrations`
Expected: PASS with no violations for `0026_ai_tts.sql`.

- [ ] **Step 4: Verify the schema typechecks**

Run: `pnpm -C apps/core exec tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `ai_tts`.

- [ ] **Step 5: Commit**

```bash
git add packages/db-schema/src/schema/ai.ts apps/core/src/database/migrations
git commit -m "feat(ai-tts): add ai_tts and ai_tts_blocks tables"
```

---

## Task 2: `ttsOptions` configuration

**Files:**
- Modify: `apps/core/src/modules/configs/configs.schema.ts`
- Modify: `apps/core/src/modules/configs/configs.default.ts`
- Modify: `apps/core/src/modules/configs/configs.interface.ts`
- Modify: `apps/core/src/modules/configs/configs.dsl.util.ts`
- Modify: `apps/core/src/modules/configs/configs.service.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `configService.get('ttsOptions')` returning `{ enable, provider, apiKey, endpoint, model, voice, speed, maxCharsPerChunk, concurrency, maxCharsPerRun }`

- [ ] **Step 1: Add the section schema**

In `configs.schema.ts`, after the Image Generation Options block:

```ts
// ==================== TTS Options ====================
export const TtsOptionsSchema = section('AI text to speech', {
  enable: field.toggle(z.boolean().optional(), 'Enable AI narration'),
  provider: field.select(
    z.enum(['openrouter', 'openai', 'custom']).optional().default('openrouter'),
    'Provider',
    [
      { label: 'OpenRouter', value: 'openrouter' },
      { label: 'OpenAI', value: 'openai' },
      { label: 'Custom', value: 'custom' },
    ],
    {
      description:
        'Endpoint preset. "custom" requires Endpoint to be set. The adapter appends /audio/speech.',
    },
  ),
  apiKey: field.password(nullableStorageText(), 'API Key'),
  endpoint: field.plain(nullableStorageText(), 'Endpoint', {
    'ui:options': { showWhen: { provider: 'custom' } },
  }),
  model: field.plain(nullableStorageText(), 'Model', {
    description: 'Speech model id, e.g. openai/gpt-4o-mini-tts-2025-12-15',
  }),
  voice: field.plain(nullableStorageText(), 'Voice', {
    description: 'Voice id. Availability depends on the model.',
  }),
  speed: field.number(
    z.coerce.number().min(0.25).max(4).optional().default(1),
    'Speed',
    { 'ui:options': { halfGrid: true } },
  ),
  maxCharsPerChunk: field.number(
    z.coerce.number().int().min(200).max(4000).optional().default(1800),
    'Max characters per request',
    { 'ui:options': { halfGrid: true } },
  ),
  concurrency: field.number(
    z.coerce.number().int().min(1).max(8).optional().default(3),
    'Concurrent requests per task',
    { 'ui:options': { halfGrid: true } },
  ),
  maxCharsPerRun: field.number(
    z.coerce.number().int().min(1000).max(1000000).optional().default(120000),
    'Max characters per run',
    { 'ui:options': { halfGrid: true } },
  ),
})
export class TtsOptionsDto extends createZodDto(TtsOptionsSchema) {}
export type TtsOptionsConfig = z.infer<typeof TtsOptionsSchema>
```

If `field.number` does not exist in `configs.zod-schema.util.ts`, use `field.plain` with the same `'ui:options': { halfGrid: true }` metadata.

Add to `configSchemaMapping` next to `imageGenerationOptions`:

```ts
  ttsOptions: TtsOptionsSchema,
```

- [ ] **Step 2: Add defaults**

In `configs.default.ts`, after `imageGenerationOptions`:

```ts
  ttsOptions: {
    enable: false,
    provider: 'openrouter',
    apiKey: '',
    endpoint: '',
    model: '',
    voice: '',
    speed: 1,
    maxCharsPerChunk: 1800,
    concurrency: 3,
    maxCharsPerRun: 120000,
  },
```

- [ ] **Step 3: Add the interface key and DSL group**

In `configs.interface.ts`, next to `imageGenerationOptions`:

```ts
  ttsOptions: Required<z.infer<typeof TtsOptionsSchema>>
```

In `configs.dsl.util.ts`, extend the `ai` group:

```ts
    sectionKeys: ['ai', 'imageGenerationOptions', 'ttsOptions'],
```

- [ ] **Step 4: Add endpoint validation**

In `configs.service.ts`, beside the `imageGenerationOptions.endpoint` check:

```ts
    const { ttsOptions } = config
    if (ttsOptions.provider === 'custom' && !ttsOptions.endpoint) {
      errors.push('ttsOptions.endpoint: required when provider is "custom"')
    }
```

Match the surrounding code's error-collection style exactly — read lines 505–525 of the current file before writing.

- [ ] **Step 5: Verify**

Run: `pnpm -C apps/core exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `pnpm -C apps/core test run configs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/modules/configs
git commit -m "feat(ai-tts): add ttsOptions configuration section"
```

---

## Task 3: Audio file type, explicit object key, reference opt-out

**Files:**
- Modify: `apps/core/src/modules/file/file.type.ts`
- Modify: `apps/core/src/modules/file/file.service.ts`
- Test: `apps/core/test/src/modules/file/file-upload-audio.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `fileService.uploadBuffer(buffer, { type, contentType, originalFilename?, objectKey?, skipReference? })` → `{ url, name, storageBackend: 's3' | 'local', storageKey: string }`

- [ ] **Step 1: Write the failing test**

Create `apps/core/test/src/modules/file/file-upload-audio.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { FileService } from '~/modules/file/file.service'

function createService(overrides: {
  s3Enabled: boolean
  prefix?: string
}) {
  const configService = {
    get: vi.fn(async (key: string) => {
      if (key === 'fileUploadOptions') {
        return {
          enableCustomNaming: true,
          filenameTemplate: '{name}{ext}',
          pathTemplate: '{type}',
        }
      }
      if (key === 'imageStorageOptions') {
        return {
          enable: overrides.s3Enabled,
          endpoint: 'https://s3.example.com',
          secretId: 'id',
          secretKey: 'key',
          bucket: 'bucket',
          region: 'auto',
          prefix: overrides.prefix ?? '',
          customDomain: '',
        }
      }
      if (key === 'url') return { serverUrl: 'https://example.com' }
      return {}
    }),
  }
  const fileReferenceService = { createPendingReference: vi.fn() }
  const service = new FileService(
    configService as never,
    fileReferenceService as never,
  )
  return { service, fileReferenceService }
}

describe('FileService.uploadBuffer audio', () => {
  it('uses the explicit objectKey instead of the filename template', async () => {
    const { service } = createService({ s3Enabled: false })
    const result = await service.uploadBuffer(Buffer.from('x'), {
      type: 'audio',
      contentType: 'audio/mpeg',
      objectKey: 'tts/1/zh/blk-0-abcdef123456.mp3',
      skipReference: true,
    })

    expect(result.storageBackend).toBe('local')
    expect(result.storageKey).toBe('tts/1/zh/blk-0-abcdef123456.mp3')
    expect(result.url).toBe(
      'https://example.com/objects/audio/tts/1/zh/blk-0-abcdef123456.mp3',
    )
  })

  it('creates no file reference when skipReference is set', async () => {
    const { service, fileReferenceService } = createService({ s3Enabled: false })
    await service.uploadBuffer(Buffer.from('x'), {
      type: 'audio',
      contentType: 'audio/mpeg',
      objectKey: 'tts/1/zh/blk-0-abcdef123456.mp3',
      skipReference: true,
    })

    expect(fileReferenceService.createPendingReference).not.toHaveBeenCalled()
  })
})
```

Adjust the `FileService` constructor arguments to match the real signature — read `file.service.ts:30–45` first. Mock the local write by stubbing `service.writeFile` if the real filesystem write is awkward in this suite.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C apps/core test run test/src/modules/file/file-upload-audio.spec.ts`
Expected: FAIL — `audio` is not a valid `FileType`, `objectKey` is not accepted.

- [ ] **Step 3: Add the audio file type**

In `apps/core/src/modules/file/file.type.ts`:

```ts
export enum FileTypeEnum {
  icon = 'icon',
  file = 'file',
  avatar = 'avatar',
  image = 'image',
  video = 'video',
  audio = 'audio',
}
```

`FileQuerySchema` derives its enum from `FileTypeEnum`, so `/objects/audio/*` starts serving with no further change.

- [ ] **Step 4: Extend `uploadBuffer`**

In `file.service.ts`, change the signature and both branches:

```ts
  async uploadBuffer(
    buffer: Buffer,
    opts: {
      type: FileType
      originalFilename?: string
      contentType: string
      objectKey?: string
      skipReference?: boolean
    },
  ): Promise<{
    url: string
    name: string
    storageBackend: 's3' | 'local'
    storageKey: string
  }> {
```

In the S3 branch:
- add `type === 'audio'` to the routing condition
- when `opts.objectKey` is set, use it verbatim as `objectKey` and skip `generateFilename` / prefix templating
- guard the reference creation: `if (!opts.skipReference) { await this.fileReferenceService.createPendingReference(...) }`
- return `{ url: s3Url, name: path.basename(objectKey), storageBackend: 's3', storageKey: objectKey }`

In the local branch:
- when `opts.objectKey` is set, use it as `relativePath` directly
- keep the existing `if (type === 'image')` reference creation, and additionally require `!opts.skipReference`
- return `{ url: fileUrl, name: path.basename(relativePath), storageBackend: 'local', storageKey: relativePath }`

`originalFilename` becomes optional; when `objectKey` is absent, fall back to today's behavior and treat a missing `originalFilename` as `''`.

- [ ] **Step 5: Update existing call sites**

Run: `rg -n "uploadBuffer\(" apps/core/src --glob '*.ts'`

Every existing caller keeps working because the added fields are optional and the return type only gained keys. Confirm each call site still typechecks; do not change their behavior.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm -C apps/core test run test/src/modules/file/file-upload-audio.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/core/src/modules/file apps/core/test/src/modules/file
git commit -m "feat(file): support audio uploads with an explicit object key"
```

---

## Task 4: Error codes

**Files:**
- Modify: `apps/core/src/common/errors/app-error-code.ts`
- Modify: `apps/core/src/common/errors/app-error-payload.ts`
- Modify: `apps/core/src/common/errors/app-error-definitions.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `AppErrorCode.TTS_DISABLED`, `TTS_PROVIDER_NOT_CONFIGURED`, `TTS_SOURCE_NOT_LEXICAL`, `TTS_GENERATION_FAILED`, `TTS_BUDGET_EXCEEDED`

- [ ] **Step 1: Add the enum members**

In `app-error-code.ts`, beside the image codes:

```ts
  TTS_DISABLED = 'TTS_DISABLED',
  TTS_PROVIDER_NOT_CONFIGURED = 'TTS_PROVIDER_NOT_CONFIGURED',
  TTS_SOURCE_NOT_LEXICAL = 'TTS_SOURCE_NOT_LEXICAL',
  TTS_GENERATION_FAILED = 'TTS_GENERATION_FAILED',
  TTS_BUDGET_EXCEEDED = 'TTS_BUDGET_EXCEEDED',
```

- [ ] **Step 2: Add the payload map entries**

In `app-error-payload.ts`:

```ts
  [AppErrorCode.TTS_DISABLED]: undefined
  [AppErrorCode.TTS_PROVIDER_NOT_CONFIGURED]: undefined
  [AppErrorCode.TTS_SOURCE_NOT_LEXICAL]: { lang?: string } | undefined
  [AppErrorCode.TTS_GENERATION_FAILED]: { message?: string } | undefined
  [AppErrorCode.TTS_BUDGET_EXCEEDED]: { charCount: number; limit: number }
```

Match the separator style of the surrounding entries (comma or newline).

- [ ] **Step 3: Add the definitions**

In `app-error-definitions.ts`:

```ts
  [AppErrorCode.TTS_DISABLED]: {
    status: 403,
    message: 'AI narration is disabled',
  },
  [AppErrorCode.TTS_PROVIDER_NOT_CONFIGURED]: {
    status: 400,
    message: 'TTS provider is not configured',
  },
  [AppErrorCode.TTS_SOURCE_NOT_LEXICAL]: {
    status: 400,
    message: 'No requested language has narratable Lexical content',
    details: (p) => (p?.lang ? { lang: p.lang } : undefined),
  },
  [AppErrorCode.TTS_GENERATION_FAILED]: {
    status: 500,
    message: (p) => p?.message ?? 'Speech generation failed',
  },
  [AppErrorCode.TTS_BUDGET_EXCEEDED]: {
    status: 400,
    message: (p) =>
      `Planned narration of ${p.charCount} characters exceeds the ${p.limit} limit`,
    details: (p) => ({ charCount: p.charCount, limit: p.limit }),
  },
```

- [ ] **Step 4: Verify exhaustiveness**

Run: `pnpm -C apps/core exec tsc --noEmit -p tsconfig.json`
Expected: no errors. A missing registry entry fails here — that is the check.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/common/errors
git commit -m "feat(ai-tts): register TTS error codes"
```

---

## Task 5: `extractRootBlockNodes` on `LexicalService`

**Files:**
- Modify: `apps/core/src/processors/helper/helper.lexical.service.ts`
- Test: `apps/core/test/src/processors/helper/lexical-root-block-nodes.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `lexicalService.extractRootBlockNodes(content: string): Array<{ id: string | null; type: string; node: any; index: number }>`; `extractRootBlocks` output stays byte-identical.

- [ ] **Step 1: Write the failing test**

Create `apps/core/test/src/processors/helper/lexical-root-block-nodes.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { LexicalService } from '~/processors/helper/helper.lexical.service'

const CONTENT = JSON.stringify({
  root: {
    children: [
      {
        type: 'paragraph',
        $: { blockId: 'blk-a' },
        children: [{ type: 'text', text: 'hello' }],
      },
      {
        type: 'code',
        code: 'const a = 1',
        $: { blockId: 'blk-b' },
      },
    ],
  },
})

describe('LexicalService.extractRootBlockNodes', () => {
  it('returns the underlying node alongside id and type', () => {
    const service = new LexicalService()
    const nodes = service.extractRootBlockNodes(CONTENT)

    expect(nodes).toHaveLength(2)
    expect(nodes[0].id).toBe('blk-a')
    expect(nodes[0].type).toBe('paragraph')
    expect(nodes[0].node.children[0].text).toBe('hello')
    expect(nodes[1].index).toBe(1)
  })

  it('leaves extractRootBlocks output unchanged', () => {
    const service = new LexicalService()
    const blocks = service.extractRootBlocks(CONTENT)

    expect(blocks.map((b) => b.fingerprint)).toEqual([
      blocks[0].fingerprint,
      blocks[1].fingerprint,
    ])
    expect(blocks[0]).toMatchObject({
      id: 'blk-a',
      type: 'paragraph',
      text: 'hello',
      index: 0,
    })
  })
})
```

Read the real `NODE_STATE_KEY` and `BLOCK_ID_STATE_KEY` constants at the top of `helper.lexical.service.ts` and use those exact keys in the fixture instead of the placeholder `$` / `blockId` above.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C apps/core test run test/src/processors/helper/lexical-root-block-nodes.spec.ts`
Expected: FAIL — `extractRootBlockNodes is not a function`.

- [ ] **Step 3: Add the method and refactor**

In `helper.lexical.service.ts`:

```ts
  extractRootBlockNodes(
    content: string,
  ): Array<{ id: string | null; type: string; node: any; index: number }> {
    const editorState = this.parseEditorState(content)
    if (!editorState?.root || !Array.isArray(editorState.root.children)) {
      return []
    }

    return editorState.root.children
      .map((child: any, index: number) => {
        if (!child || typeof child !== 'object') return null
        return {
          id: this.readBlockId(child),
          type: typeof child.type === 'string' ? child.type : 'unknown',
          node: child,
          index,
        }
      })
      .filter(Boolean) as Array<{
      id: string | null
      type: string
      node: any
      index: number
    }>
  }

  extractRootBlocks(content: string): LexicalRootBlock[] {
    return this.extractRootBlockNodes(content).map(
      ({ id, type, node, index }) => {
        const text = this.extractBlockText(node)
        const normalized = this.normalizeText(text)
        return {
          id,
          type,
          text,
          fingerprint: md5(`${type}:${normalized}`),
          index,
        } satisfies LexicalRootBlock
      },
    )
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C apps/core test run test/src/processors/helper/lexical-root-block-nodes.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verify translation is unaffected**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-translation`
Expected: PASS — every existing translation test still green. If any fails, the refactor changed `extractRootBlocks` semantics; revert and re-derive rather than adjusting the test.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/processors/helper apps/core/test/src/processors/helper
git commit -m "refactor(lexical): expose extractRootBlockNodes"
```

---

## Task 6: Block planning module

**Files:**
- Create: `apps/core/src/modules/ai/ai-tts/ai-tts.types.ts`
- Create: `apps/core/src/modules/ai/ai-tts/tts-block-plan.ts`
- Test: `apps/core/test/src/modules/ai/ai-tts/tts-block-plan.spec.ts`

**Interfaces:**
- Consumes: `lexicalService.extractRootBlockNodes` (Task 5)
- Produces:
  - `SPEAKABLE_BLOCK_TYPES: ReadonlySet<string>`
  - `extractSpeakableText(node: any): string`
  - `splitIntoChunks(text: string, maxChars: number): string[]`
  - `computeSpeechFingerprint(type: string, chunkText: string): string`
  - `planTts(input: PlanTtsInput): TtsPlan`
  - types `PlannedChunk`, `ExistingBlockRow`, `TtsPlan`

- [ ] **Step 1: Write the types**

Create `apps/core/src/modules/ai/ai-tts/ai-tts.types.ts`:

```ts
export interface PlannedChunk {
  blockId: string
  chunkIndex: number
  type: string
  text: string
  fingerprint: string
}

export interface ExistingBlockRow {
  id: string
  blockId: string
  chunkIndex: number
  fingerprint: string
  storageBackend: 's3' | 'local'
  storageKey: string
}

export interface TtsPlan {
  toGenerate: PlannedChunk[]
  toReuse: Array<{ rowId: string; blockId: string; chunkIndex: number }>
  toDelete: Array<{
    rowId: string
    storageBackend: 's3' | 'local'
    storageKey: string
  }>
  blockOrder: string[]
  charCount: number
}

export interface PlanTtsInput {
  chunks: PlannedChunk[]
  existing: ExistingBlockRow[]
  force: boolean
}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/core/test/src/modules/ai/ai-tts/tts-block-plan.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  computeSpeechFingerprint,
  extractSpeakableText,
  planTts,
  splitIntoChunks,
  SPEAKABLE_BLOCK_TYPES,
} from '~/modules/ai/ai-tts/tts-block-plan'

const textNode = (text: string) => ({ type: 'text', text })

describe('SPEAKABLE_BLOCK_TYPES', () => {
  it('accepts prose blocks and rejects the rest', () => {
    expect(SPEAKABLE_BLOCK_TYPES.has('paragraph')).toBe(true)
    expect(SPEAKABLE_BLOCK_TYPES.has('heading')).toBe(true)
    expect(SPEAKABLE_BLOCK_TYPES.has('quote')).toBe(true)
    expect(SPEAKABLE_BLOCK_TYPES.has('rich-quote')).toBe(true)
    expect(SPEAKABLE_BLOCK_TYPES.has('list')).toBe(true)
    for (const type of [
      'code',
      'mermaid',
      'excalidraw',
      'image',
      'gallery',
      'table',
      'poll',
      'embed',
      'horizontalrule',
    ]) {
      expect(SPEAKABLE_BLOCK_TYPES.has(type)).toBe(false)
    }
  })
})

describe('extractSpeakableText', () => {
  it('joins list items with a separator instead of concatenating', () => {
    const list = {
      type: 'list',
      children: [
        { type: 'listitem', children: [textNode('ab')] },
        { type: 'listitem', children: [textNode('c')] },
      ],
    }
    expect(extractSpeakableText(list)).toBe('ab。c')
  })

  it('drops the url of a link but keeps its text', () => {
    const paragraph = {
      type: 'paragraph',
      children: [
        { type: 'link', url: 'https://example.com', children: [textNode('docs')] },
      ],
    }
    expect(extractSpeakableText(paragraph)).toBe('docs')
  })

  it('collapses whitespace', () => {
    const paragraph = {
      type: 'paragraph',
      children: [textNode('a   \n  b')],
    }
    expect(extractSpeakableText(paragraph)).toBe('a b')
  })
})

describe('computeSpeechFingerprint', () => {
  it('separates list splits that share concatenated text', () => {
    const left = {
      type: 'list',
      children: [
        { type: 'listitem', children: [textNode('ab')] },
        { type: 'listitem', children: [textNode('c')] },
      ],
    }
    const right = {
      type: 'list',
      children: [
        { type: 'listitem', children: [textNode('a')] },
        { type: 'listitem', children: [textNode('bc')] },
      ],
    }
    expect(computeSpeechFingerprint('list', extractSpeakableText(left))).not.toBe(
      computeSpeechFingerprint('list', extractSpeakableText(right)),
    )
  })
})

describe('splitIntoChunks', () => {
  it('splits on sentence boundaries under the limit', () => {
    expect(splitIntoChunks('一。二。三。', 4)).toEqual(['一。二。', '三。'])
  })

  it('hard-cuts a single sentence longer than the limit', () => {
    expect(splitIntoChunks('a'.repeat(9), 4)).toEqual(['aaaa', 'aaaa', 'a'])
  })

  it('returns one chunk when the text fits', () => {
    expect(splitIntoChunks('short', 100)).toEqual(['short'])
  })
})

describe('planTts', () => {
  const chunk = (blockId: string, chunkIndex: number, fingerprint: string) => ({
    blockId,
    chunkIndex,
    type: 'paragraph',
    text: `${blockId}-${chunkIndex}`,
    fingerprint,
  })
  const row = (
    id: string,
    blockId: string,
    chunkIndex: number,
    fingerprint: string,
  ) => ({
    id,
    blockId,
    chunkIndex,
    fingerprint,
    storageBackend: 's3' as const,
    storageKey: `k/${id}`,
  })

  it('reuses a matching fingerprint and regenerates a changed one', () => {
    const plan = planTts({
      chunks: [chunk('a', 0, 'fp-a'), chunk('b', 0, 'fp-b2')],
      existing: [row('r1', 'a', 0, 'fp-a'), row('r2', 'b', 0, 'fp-b1')],
      force: false,
    })

    expect(plan.toReuse).toEqual([{ rowId: 'r1', blockId: 'a', chunkIndex: 0 }])
    expect(plan.toGenerate).toEqual([chunk('b', 0, 'fp-b2')])
    expect(plan.toDelete).toEqual([])
  })

  it('keeps a moved block reused and reflects the move in blockOrder', () => {
    const plan = planTts({
      chunks: [chunk('b', 0, 'fp-b'), chunk('a', 0, 'fp-a')],
      existing: [row('r1', 'a', 0, 'fp-a'), row('r2', 'b', 0, 'fp-b')],
      force: false,
    })

    expect(plan.toGenerate).toEqual([])
    expect(plan.blockOrder).toEqual(['b', 'a'])
  })

  it('deletes rows for removed blocks and trailing chunks', () => {
    const plan = planTts({
      chunks: [chunk('a', 0, 'fp-a')],
      existing: [
        row('r1', 'a', 0, 'fp-a'),
        row('r2', 'a', 1, 'fp-a1'),
        row('r3', 'gone', 0, 'fp-x'),
      ],
      force: false,
    })

    expect(plan.toDelete.map((d) => d.rowId).sort()).toEqual(['r2', 'r3'])
  })

  it('force regenerates everything and only deletes rows not being replaced', () => {
    const plan = planTts({
      chunks: [chunk('a', 0, 'fp-a')],
      existing: [row('r1', 'a', 0, 'fp-a'), row('r2', 'old', 0, 'fp-o')],
      force: true,
    })

    expect(plan.toGenerate).toHaveLength(1)
    expect(plan.toDelete.map((d) => d.rowId)).toEqual(['r2'])
  })

  it('sums charCount over the planned chunks', () => {
    const plan = planTts({
      chunks: [chunk('a', 0, 'fp-a'), chunk('b', 0, 'fp-b')],
      existing: [],
      force: false,
    })

    expect(plan.charCount).toBe(6)
  })

  it('dedupes blockOrder so a multi-chunk block appears once', () => {
    const plan = planTts({
      chunks: [chunk('a', 0, 'fp-a0'), chunk('a', 1, 'fp-a1')],
      existing: [],
      force: false,
    })

    expect(plan.blockOrder).toEqual(['a'])
  })
})
```

Note on the `force` case: a row whose `(blockId, chunkIndex)` is being regenerated is **not** in `toDelete`, because the upsert replaces it. Its displaced *object* is deleted by the service using the storage key it read before the upsert.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/tts-block-plan.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the module**

Create `apps/core/src/modules/ai/ai-tts/tts-block-plan.ts`:

```ts
import { md5 } from '~/utils/tool.util'

import type {
  ExistingBlockRow,
  PlannedChunk,
  PlanTtsInput,
  TtsPlan,
} from './ai-tts.types'

export const SPEAKABLE_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'paragraph',
  'heading',
  'quote',
  'rich-quote',
  'list',
])

const SENTENCE_SEPARATOR = '。'

function collectInlineText(node: any): string {
  if (!node || typeof node !== 'object') return ''
  if (node.type === 'text') return String(node.text ?? '')
  if (node.type === 'linebreak') return ' '
  if (Array.isArray(node.children)) {
    return node.children.map((child: any) => collectInlineText(child)).join('')
  }
  return ''
}

export function extractSpeakableText(node: any): string {
  if (!node || typeof node !== 'object') return ''

  const raw =
    node.type === 'list' && Array.isArray(node.children)
      ? node.children
          .map((item: any) => collectInlineText(item).trim())
          .filter(Boolean)
          .join(SENTENCE_SEPARATOR)
      : collectInlineText(node)

  return raw.replaceAll(/\s+/g, ' ').trim()
}

export function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return text ? [text] : []

  const sentences = text.match(/[^。！？.!?]*[。！？]|[^。！？.!?]*[.!?](\s|$)|[^。！？.!?]+$/g) ?? [text]
  const chunks: string[] = []
  let current = ''

  const pushCurrent = () => {
    if (current) {
      chunks.push(current)
      current = ''
    }
  }

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      pushCurrent()
      for (let i = 0; i < sentence.length; i += maxChars) {
        chunks.push(sentence.slice(i, i + maxChars))
      }
      continue
    }
    if (current.length + sentence.length > maxChars) pushCurrent()
    current += sentence
  }
  pushCurrent()

  return chunks.filter(Boolean)
}

export function computeSpeechFingerprint(
  type: string,
  chunkText: string,
): string {
  return md5(`${type}:${chunkText}`)
}

function rowKey(blockId: string, chunkIndex: number): string {
  return `${blockId}#${chunkIndex}`
}

export function planTts(input: PlanTtsInput): TtsPlan {
  const { chunks, existing, force } = input
  const existingByKey = new Map<string, ExistingBlockRow>(
    existing.map((row) => [rowKey(row.blockId, row.chunkIndex), row]),
  )

  const toGenerate: PlannedChunk[] = []
  const toReuse: TtsPlan['toReuse'] = []
  const consumed = new Set<string>()

  for (const chunk of chunks) {
    const key = rowKey(chunk.blockId, chunk.chunkIndex)
    const row = existingByKey.get(key)
    if (row) consumed.add(row.id)

    if (!force && row && row.fingerprint === chunk.fingerprint) {
      toReuse.push({
        rowId: row.id,
        blockId: chunk.blockId,
        chunkIndex: chunk.chunkIndex,
      })
      continue
    }
    toGenerate.push(chunk)
  }

  const toDelete = existing
    .filter((row) => !consumed.has(row.id))
    .map((row) => ({
      rowId: row.id,
      storageBackend: row.storageBackend,
      storageKey: row.storageKey,
    }))

  const blockOrder: string[] = []
  for (const chunk of chunks) {
    if (blockOrder.at(-1) !== chunk.blockId) blockOrder.push(chunk.blockId)
  }

  return {
    toGenerate,
    toReuse,
    toDelete,
    blockOrder,
    charCount: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
  }
}
```

Confirm `md5` is exported from `~/utils/tool.util` (it is what `helper.lexical.service.ts` imports); if the path differs, use that import.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/tts-block-plan.spec.ts`
Expected: PASS — all cases. Fix the chunk regex if the sentence-splitting cases fail; the test values, not the implementation, are the contract.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/modules/ai/ai-tts apps/core/test/src/modules/ai/ai-tts
git commit -m "feat(ai-tts): add pure block planning module"
```

---

## Task 7: Content-addressed object key builder

**Files:**
- Create: `apps/core/src/modules/ai/ai-tts/tts-object-key.ts`
- Test: `apps/core/test/src/modules/ai/ai-tts/tts-object-key.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `buildTtsObjectKey(input: { prefix?: string; refId: string; lang: string; blockId: string; chunkIndex: number; fingerprint: string }): string`

- [ ] **Step 1: Write the failing test**

Create `apps/core/test/src/modules/ai/ai-tts/tts-object-key.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildTtsObjectKey } from '~/modules/ai/ai-tts/tts-object-key'

const base = {
  refId: '123',
  lang: 'zh',
  blockId: 'blk-a',
  chunkIndex: 0,
  fingerprint: 'abcdef1234567890',
}

describe('buildTtsObjectKey', () => {
  it('builds a content-addressed key', () => {
    expect(buildTtsObjectKey(base)).toBe('tts/123/zh/blk-a-0-abcdef123456.mp3')
  })

  it('applies the storage prefix without doubling slashes', () => {
    expect(buildTtsObjectKey({ ...base, prefix: 'media/' })).toBe(
      'media/tts/123/zh/blk-a-0-abcdef123456.mp3',
    )
  })

  it('changes the key when the fingerprint changes', () => {
    expect(buildTtsObjectKey({ ...base, fingerprint: 'ffffff0000001111' })).not.toBe(
      buildTtsObjectKey(base),
    )
  })

  it('sanitizes path separators out of the block id', () => {
    expect(buildTtsObjectKey({ ...base, blockId: '../escape' })).toBe(
      'tts/123/zh/--escape-0-abcdef123456.mp3',
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/tts-object-key.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

```ts
const SAFE_SEGMENT = /[^a-zA-Z0-9_-]/g

export function buildTtsObjectKey(input: {
  prefix?: string
  refId: string
  lang: string
  blockId: string
  chunkIndex: number
  fingerprint: string
}): string {
  const prefix = (input.prefix ?? '').replace(/^\/+|\/+$/g, '')
  const blockId = input.blockId.replaceAll(SAFE_SEGMENT, '-')
  const lang = input.lang.replaceAll(SAFE_SEGMENT, '-')
  const name = `${blockId}-${input.chunkIndex}-${input.fingerprint.slice(0, 12)}.mp3`
  const path = `tts/${input.refId}/${lang}/${name}`
  return prefix ? `${prefix}/${path}` : path
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/tts-object-key.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/modules/ai/ai-tts/tts-object-key.ts apps/core/test/src/modules/ai/ai-tts/tts-object-key.spec.ts
git commit -m "feat(ai-tts): add content-addressed object key builder"
```

---

## Task 8: Speech runtime adapter

**Files:**
- Create: `apps/core/src/modules/ai/ai-tts/tts-runtime.adapter.ts`
- Test: `apps/core/test/src/modules/ai/ai-tts/tts-runtime.adapter.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `resolveTtsBaseUrl(provider: string, endpoint?: string): string`
  - `class TtsRuntimeAdapter implements ITtsRuntime` with `generateSpeech(opts: TtsGenerateOptions): Promise<{ buffer: Buffer; mimeType: string }>`
  - `TtsGenerateOptions = { input: string; voice: string; speed: number; providerParams?: Record<string, unknown>; signal?: AbortSignal }`

- [ ] **Step 1: Write the failing test**

Create `apps/core/test/src/modules/ai/ai-tts/tts-runtime.adapter.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  resolveTtsBaseUrl,
  TtsRuntimeAdapter,
} from '~/modules/ai/ai-tts/tts-runtime.adapter'

const audio = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'content-type': 'audio/mpeg' },
  })

afterEach(() => vi.unstubAllGlobals())

describe('resolveTtsBaseUrl', () => {
  it('maps the presets and honours a custom endpoint', () => {
    expect(resolveTtsBaseUrl('openrouter')).toBe('https://openrouter.ai/api/v1')
    expect(resolveTtsBaseUrl('openai')).toBe('https://api.openai.com/v1')
    expect(resolveTtsBaseUrl('custom', 'https://tts.local/v1/')).toBe(
      'https://tts.local/v1',
    )
  })
})

describe('TtsRuntimeAdapter', () => {
  it('posts the OpenAI speech body and returns the audio buffer', async () => {
    const fetchMock = vi.fn(async () => audio())
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new TtsRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'k',
      model: 'openai/tts',
    })
    const result = await adapter.generateSpeech({
      input: 'hello',
      voice: 'alloy',
      speed: 1,
    })

    expect(result.mimeType).toBe('audio/mpeg')
    expect([...result.buffer]).toEqual([1, 2, 3])

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/audio/speech')
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'openai/tts',
      input: 'hello',
      voice: 'alloy',
      speed: 1,
      response_format: 'mp3',
    })
  })

  it('retries a 500 and succeeds on the next attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(audio())
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new TtsRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'k',
      model: 'm',
      retryDelayMs: 0,
    })
    await adapter.generateSpeech({ input: 'x', voice: 'v', speed: 1 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 400', async () => {
    const fetchMock = vi.fn(async () => new Response('bad voice', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new TtsRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'k',
      model: 'm',
      retryDelayMs: 0,
    })

    await expect(
      adapter.generateSpeech({ input: 'x', voice: 'v', speed: 1 }),
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects a non-audio 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'quota' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    )

    const adapter = new TtsRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'k',
      model: 'm',
      retryDelayMs: 0,
    })

    await expect(
      adapter.generateSpeech({ input: 'x', voice: 'v', speed: 1 }),
    ).rejects.toThrow(/quota/)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/tts-runtime.adapter.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the adapter**

```ts
import { AppErrorCode, createAppException } from '~/common/errors'
import { sleep } from '~/utils/tool.util'

export interface TtsGenerateOptions {
  input: string
  voice: string
  speed: number
  providerParams?: Record<string, unknown>
  signal?: AbortSignal
}

export interface ITtsRuntime {
  generateSpeech(
    opts: TtsGenerateOptions,
  ): Promise<{ buffer: Buffer; mimeType: string }>
}

export interface TtsRuntimeAdapterConfig {
  provider: string
  apiKey: string
  endpoint?: string
  model: string
  maxAttempts?: number
  retryDelayMs?: number
}

const PRESET_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
}

export function resolveTtsBaseUrl(provider: string, endpoint?: string): string {
  const trimmed = endpoint?.trim().replace(/\/+$/, '')
  if (trimmed) return trimmed
  const preset = PRESET_BASE_URLS[provider]
  if (!preset) {
    throw createAppException(AppErrorCode.TTS_PROVIDER_NOT_CONFIGURED)
  }
  return preset
}

export class TtsRuntimeAdapter implements ITtsRuntime {
  private readonly baseUrl: string
  private readonly maxAttempts: number
  private readonly retryDelayMs: number

  constructor(private readonly config: TtsRuntimeAdapterConfig) {
    this.baseUrl = resolveTtsBaseUrl(config.provider, config.endpoint)
    this.maxAttempts = config.maxAttempts ?? 3
    this.retryDelayMs = config.retryDelayMs ?? 500
  }

  async generateSpeech(
    opts: TtsGenerateOptions,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.requestOnce(opts)
      } catch (error) {
        lastError = error as Error
        if (!isRetryable(error) || attempt === this.maxAttempts) break
        await sleep(this.retryDelayMs * 2 ** (attempt - 1))
      }
    }

    throw createAppException(AppErrorCode.TTS_GENERATION_FAILED, {
      message: lastError?.message,
    })
  }

  private async requestOnce(opts: TtsGenerateOptions) {
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        input: opts.input,
        voice: opts.voice,
        speed: opts.speed,
        response_format: 'mp3',
        ...opts.providerParams,
      }),
      signal: opts.signal,
    })

    if (!response.ok) {
      throw new HttpStatusError(response.status, await safeText(response))
    }

    const mimeType = response.headers.get('content-type') ?? ''
    if (!mimeType.startsWith('audio/')) {
      throw new HttpStatusError(response.status, await safeText(response))
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType,
    }
  }
}

class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`tts request failed (${status}): ${body.slice(0, 300)}`)
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof HttpStatusError) {
    return error.status >= 500 || error.status === 429
  }
  return true
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}
```

A non-audio 200 becomes an `HttpStatusError` with `status: 200`, which `isRetryable` treats as non-retryable — matching the test.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/tts-runtime.adapter.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/modules/ai/ai-tts/tts-runtime.adapter.ts apps/core/test/src/modules/ai/ai-tts/tts-runtime.adapter.spec.ts
git commit -m "feat(ai-tts): add OpenAI-compatible speech runtime adapter"
```

---

## Task 9: Repository

**Files:**
- Create: `apps/core/src/modules/ai/ai-tts/ai-tts.repository.ts`
- Modify: `apps/core/src/processors/database/repository.tokens.ts`
- Test: `apps/core/test/src/modules/ai/ai-tts/ai-tts.repository.pg.e2e.spec.ts`

**Interfaces:**
- Consumes: `aiTts`, `aiTtsBlocks` (Task 1)
- Produces `AiTtsRepository` with:
  - `findByRefAndLang(refId, lang): Promise<AiTtsRow | null>`
  - `findAllByRef(refId): Promise<AiTtsRow[]>`
  - `findBlocks(ttsId): Promise<AiTtsBlockRow[]>`
  - `upsertParent(input): Promise<AiTtsRow>`
  - `upsertBlock(input): Promise<AiTtsBlockRow>`
  - `deleteBlocksByIds(ids: string[]): Promise<void>`
  - `deleteById(id): Promise<AiTtsBlockRow[]>` (returns the removed blocks so the caller can delete their objects)
  - `deleteByRefId(refId): Promise<AiTtsBlockRow[]>`
  - `listPaginated({ page, size, search }): Promise<PaginationResult<AiTtsRow>>`
  - `findMeta(refId, lang): Promise<{ id, updatedAt, blockCount, sourceModifiedAt } | null>`

- [ ] **Step 1: Write the failing test**

Create `apps/core/test/src/modules/ai/ai-tts/ai-tts.repository.pg.e2e.spec.ts` modelled on the existing `ai-translation.repository.pg.e2e.spec.ts` — read that file first and copy its container bootstrap verbatim. Cover:

```ts
  it('upserts a parent row and replaces a block in place', async () => {
    const parent = await repository.upsertParent({
      refId: '1',
      lang: 'zh',
      isTranslation: false,
      sourceLang: null,
      model: 'm',
      voice: 'v',
      speed: 1,
      format: 'mp3',
      blockOrder: ['a'],
      charCount: 5,
      sourceModifiedAt: new Date(),
    })

    await repository.upsertBlock({
      ttsId: parent.id,
      blockId: 'a',
      chunkIndex: 0,
      fingerprint: 'fp1',
      text: 'hello',
      url: 'https://cdn/x1.mp3',
      storageBackend: 's3',
      storageKey: 'k/x1',
      byteSize: 10,
    })
    await repository.upsertBlock({
      ttsId: parent.id,
      blockId: 'a',
      chunkIndex: 0,
      fingerprint: 'fp2',
      text: 'hello there',
      url: 'https://cdn/x2.mp3',
      storageBackend: 's3',
      storageKey: 'k/x2',
      byteSize: 12,
    })

    const blocks = await repository.findBlocks(parent.id)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].fingerprint).toBe('fp2')
  })

  it('cascades block deletion when the parent is deleted', async () => {
    const removed = await repository.deleteById(parent.id)
    expect(removed.map((b) => b.storageKey)).toContain('k/x2')
    expect(await repository.findBlocks(parent.id)).toEqual([])
  })

  it('findMeta reports the block count from block_order', async () => {
    const meta = await repository.findMeta('1', 'zh')
    expect(meta?.blockCount).toBe(1)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/ai-tts.repository.pg.e2e.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the repository**

Follow `ai-summary.repository.ts` exactly: `@Injectable()`, `extends BaseRepository`, `@Inject(PG_DB_TOKEN) db: AppDatabase`, `private readonly snowflake: SnowflakeService`, a module-level `mapRow` per table using `toEntityId`, `parseEntityId` on every incoming id.

Key implementations:

```ts
  async upsertParent(input: UpsertParentInput): Promise<AiTtsRow> {
    const [row] = await this.db
      .insert(aiTts)
      .values({
        id: this.snowflake.nextId(),
        refId: parseEntityId(input.refId),
        lang: input.lang,
        isTranslation: input.isTranslation,
        sourceLang: input.sourceLang,
        model: input.model,
        voice: input.voice,
        speed: input.speed,
        format: input.format,
        blockOrder: input.blockOrder,
        charCount: input.charCount,
        sourceModifiedAt: input.sourceModifiedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [aiTts.refId, aiTts.lang],
        set: {
          model: input.model,
          voice: input.voice,
          speed: input.speed,
          format: input.format,
          blockOrder: input.blockOrder,
          charCount: input.charCount,
          sourceModifiedAt: input.sourceModifiedAt,
          updatedAt: new Date(),
        },
      })
      .returning()
    return mapParent(row)
  }

  async upsertBlock(input: UpsertBlockInput): Promise<AiTtsBlockRow> {
    const [row] = await this.db
      .insert(aiTtsBlocks)
      .values({
        id: this.snowflake.nextId(),
        ttsId: parseEntityId(input.ttsId),
        blockId: input.blockId,
        chunkIndex: input.chunkIndex,
        fingerprint: input.fingerprint,
        text: input.text,
        url: input.url,
        storageBackend: input.storageBackend,
        storageKey: input.storageKey,
        byteSize: input.byteSize ?? null,
      })
      .onConflictDoUpdate({
        target: [aiTtsBlocks.ttsId, aiTtsBlocks.blockId, aiTtsBlocks.chunkIndex],
        set: {
          fingerprint: input.fingerprint,
          text: input.text,
          url: input.url,
          storageBackend: input.storageBackend,
          storageKey: input.storageKey,
          byteSize: input.byteSize ?? null,
        },
      })
      .returning()
    return mapBlock(row)
  }
```

`findMeta` selects `id`, `updatedAt`, `sourceModifiedAt` and `sql<number>`jsonb_array_length(${aiTts.blockOrder})`` as `blockCount`, filtered by `(refId, lang)`, limit 1.

`deleteById` and `deleteByRefId` select the block rows first, then delete the parent, returning the collected blocks.

Add the token in `repository.tokens.ts`:

```ts
  aiTts: Symbol('AiTtsRepository'),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/ai-tts.repository.pg.e2e.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/modules/ai/ai-tts/ai-tts.repository.ts apps/core/src/processors/database/repository.tokens.ts apps/core/test/src/modules/ai/ai-tts
git commit -m "feat(ai-tts): add repository"
```

---

## Task 10: Generation service and task handler

**Files:**
- Create: `apps/core/src/modules/ai/ai-tts/ai-tts.service.ts`
- Modify: `apps/core/src/modules/ai/ai-task/ai-task.types.ts`
- Modify: `apps/core/src/modules/ai/ai-task/ai-task.service.ts`
- Modify: `apps/core/src/modules/ai/ai.module.ts`
- Test: `apps/core/test/src/modules/ai/ai-tts/ai-tts.faux.e2e.spec.ts`

**Interfaces:**
- Consumes: `planTts` (Task 6), `buildTtsObjectKey` (Task 7), `TtsRuntimeAdapter` (Task 8), `AiTtsRepository` (Task 9), `FileService.uploadBuffer` (Task 3)
- Produces:
  - `AITaskType.Tts = 'ai:tts'`, `TtsTaskPayload { refId, langs?, force?, title?, refType? }`
  - `AiTaskService.createTtsTask(payload): Promise<{ taskId, created }>`
  - `AiTtsService.getMetaForArticle(refId, lang, modifiedAt?): Promise<TtsMeta>`
  - `AiTtsService.getPublicNarration(refId, lang?): Promise<PublicNarration | null>`
  - `AiTtsService.getDetailsByRefId(refId): Promise<TtsDetailView[]>`
  - `AiTtsService.list(query: { page?: number; size?: number }): Promise<PaginationResult<TtsListItem>>`
  - `AiTtsService.deleteById(id): Promise<void>`

- [ ] **Step 1: Register the task type**

In `ai-task.types.ts`:

```ts
  Tts = 'ai:tts',
```

```ts
export interface TtsTaskPayload {
  refId: string
  langs?: string[]
  force?: boolean
  title?: string
  refType?: string
}
```

Add it to the `AITaskPayload` union and to `computeAITaskDedupKey`:

```ts
    case AITaskType.Tts: {
      const p = payload as TtsTaskPayload
      const langs = (p.langs || []).slice().sort().join(',')
      return `${p.refId}:${p.force ? 'force' : 'inc'}:${langs}`
    }
```

In `ai-task.service.ts`:

```ts
  async createTtsTask(
    payload: TtsTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    await this.fillArticleInfo(payload)
    return this.createTask(AITaskType.Tts, payload)
  }
```

- [ ] **Step 2: Write the failing faux e2e test**

Create `apps/core/test/src/modules/ai/ai-tts/ai-tts.faux.e2e.spec.ts`. Read `ai-image.faux.e2e.spec.ts` first and reuse its handler-capture pattern (`taskProcessor.registerHandler` is captured by a mock so the test can invoke `execute` directly). Stub: `ConfigsService.get`, `FileService.uploadBuffer`, `AiTtsRepository`, `DatabaseService.findGlobalById`, `LexicalService`, `RedisService`, and the runtime.

Cases:

```ts
  it('generates every block on the first run and publishes block order', async () => {
    await execute({ refId: '1' }, context)

    expect(runtime.generateSpeech).toHaveBeenCalledTimes(2)
    expect(repository.upsertBlock).toHaveBeenCalledTimes(2)
    expect(repository.upsertParent).toHaveBeenCalledWith(
      expect.objectContaining({ blockOrder: ['blk-a', 'blk-b'] }),
    )
  })

  it('regenerates only the edited block on the second run', async () => {
    repository.findBlocks.mockResolvedValue([
      blockRow('blk-a', 'fp-a'),
      blockRow('blk-b', 'fp-b-old'),
    ])

    await execute({ refId: '1' }, context)

    expect(runtime.generateSpeech).toHaveBeenCalledTimes(1)
    expect(runtime.generateSpeech.mock.calls[0][0].input).toContain('second')
  })

  it('uploads with skipReference so the orphan sweeper leaves audio alone', async () => {
    await execute({ refId: '1' }, context)

    for (const [, opts] of fileService.uploadBuffer.mock.calls) {
      expect(opts.skipReference).toBe(true)
      expect(opts.type).toBe('audio')
      expect(opts.objectKey).toMatch(/^tts\/1\/zh\/blk-[ab]-0-[0-9a-f]{12}\.mp3$/)
    }
  })

  it('commits each chunk before the next one is generated', async () => {
    const order: string[] = []
    runtime.generateSpeech.mockImplementation(async () => {
      order.push('generate')
      return { buffer: Buffer.from('a'), mimeType: 'audio/mpeg' }
    })
    repository.upsertBlock.mockImplementation(async () => {
      order.push('commit')
      return {} as never
    })

    await execute({ refId: '1' }, context)

    expect(order.slice(0, 2)).toEqual(['generate', 'commit'])
  })

  it('deletes displaced objects after the upsert, never before', async () => {
    repository.findBlocks.mockResolvedValue([blockRow('gone', 'fp-x')])

    await execute({ refId: '1' }, context)

    expect(repository.upsertBlock).toHaveBeenCalled()
    expect(fileService.deleteObject).toHaveBeenCalledWith('s3', 'k/gone')
  })

  it('reports progress as a percentage', async () => {
    await execute({ refId: '1' }, context)

    const values = context.updateProgress.mock.calls.map((c) => c[0])
    expect(values.at(-1)).toBe(100)
    expect(values.every((v) => v >= 0 && v <= 100)).toBe(true)
  })

  it('skips a language whose lock is already held', async () => {
    redis.set.mockResolvedValue(null)

    await execute({ refId: '1', langs: ['zh'] }, context)

    expect(runtime.generateSpeech).not.toHaveBeenCalled()
    expect(repository.upsertParent).not.toHaveBeenCalled()
  })

  it('skips the finalize when the article changed mid-run', async () => {
    databaseService.findGlobalById
      .mockResolvedValueOnce(article(new Date('2026-01-01')))
      .mockResolvedValueOnce(article(new Date('2026-02-01')))

    await execute({ refId: '1' }, context)

    expect(repository.upsertBlock).toHaveBeenCalled()
    expect(repository.upsertParent).not.toHaveBeenCalled()
  })

  it('fails the language when the plan exceeds maxCharsPerRun', async () => {
    config.ttsOptions.maxCharsPerRun = 1

    await execute({ refId: '1' }, context)

    expect(context.setStatus).toHaveBeenCalledWith(TaskStatus.Failed)
    expect(runtime.generateSpeech).not.toHaveBeenCalled()
  })

  it('sets PartialFailed when one of two languages fails', async () => {
    // translation row missing for `en`
    await execute({ refId: '1', langs: ['zh', 'en'] }, context)

    expect(context.setStatus).toHaveBeenCalledWith(TaskStatus.PartialFailed)
  })

  it('throws TTS_DISABLED when the feature is off', async () => {
    config.ttsOptions.enable = false

    await expect(execute({ refId: '1' }, context)).rejects.toThrow(/TTS_DISABLED/)
  })

  it('throws TTS_PROVIDER_NOT_CONFIGURED without an api key', async () => {
    config.ttsOptions.apiKey = ''

    await expect(execute({ refId: '1' }, context)).rejects.toThrow(
      /TTS_PROVIDER_NOT_CONFIGURED/,
    )
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/ai-tts.faux.e2e.spec.ts`
Expected: FAIL — service module not found.

- [ ] **Step 4: Implement the service**

Create `ai-tts.service.ts` with this shape:

```ts
@Injectable()
export class AiTtsService implements OnModuleInit {
  private readonly logger = new Logger(AiTtsService.name)

  constructor(
    private readonly configService: ConfigsService,
    private readonly fileService: FileService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly repository: AiTtsRepository,
    private readonly databaseService: DatabaseService,
    private readonly lexicalService: LexicalService,
    private readonly translationRepository: AiTranslationRepository,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit() {
    this.taskProcessor.registerHandler({
      type: AITaskType.Tts,
      execute: async (payload: TtsTaskPayload, context) => {
        await this.runTask(payload, context)
      },
    })
  }
}
```

`runTask` sequence:

1. `const config = await this.configService.get('ttsOptions')`; throw `TTS_DISABLED` / `TTS_PROVIDER_NOT_CONFIGURED`.
2. Load the article via `databaseService.findGlobalById(payload.refId)`; capture `modifiedAt`.
3. `const sourceLang = parseLanguageCode(getMetaLang(document) ?? DEFAULT_SUMMARY_LANG)`. Build the canonical target list: `payload.langs?.map(parseLanguageCode)` deduped, else `[sourceLang]`. Reject more than 8 languages.
4. Per language, `runLanguage(...)` inside a Redis lock:

```ts
  private async withLangLock<T>(
    refId: string,
    lang: string,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const redis = this.redisService.getClient()
    const key = `ai:tts:lock:${refId}:${lang}`
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const acquired = await redis.set(key, token, 'EX', 300, 'NX')
    if (!acquired) return null

    const renew = setInterval(() => {
      void redis.expire(key, 300)
    }, 120_000)

    try {
      return await fn()
    } finally {
      clearInterval(renew)
      const current = await redis.get(key)
      if (current === token) await redis.del(key)
    }
  }
```

5. `runLanguage`: resolve content (source document, or `translationRepository.findByRefAndLang` requiring `contentFormat === 'lexical'` and a matching canonical `sourceLang`); build chunks:

```ts
  private buildChunks(content: string, maxChars: number): PlannedChunk[] {
    const chunks: PlannedChunk[] = []
    for (const block of this.lexicalService.extractRootBlockNodes(content)) {
      if (!SPEAKABLE_BLOCK_TYPES.has(block.type)) continue
      const text = extractSpeakableText(block.node)
      if (!text) continue
      const blockId = block.id ?? `idx:${block.index}`
      if (!block.id) {
        this.logger.warn(`block without id at index ${block.index}`)
      }
      splitIntoChunks(text, maxChars).forEach((chunkText, chunkIndex) => {
        chunks.push({
          blockId,
          chunkIndex,
          type: block.type,
          text: chunkText,
          fingerprint: computeSpeechFingerprint(block.type, chunkText),
        })
      })
    }
    return chunks
  }
```

6. Resolve the effective voice config: existing parent row and `!force` ⇒ its `model/voice/speed`; otherwise the global config.
7. `planTts({ chunks, existing, force })`; if `plan.charCount > config.maxCharsPerRun`, throw `TTS_BUDGET_EXCEEDED`.
8. Synthesize with `pLimit(config.concurrency)` **and** a module-level process-wide limiter so ten concurrent tasks cannot open sixty provider connections:

```ts
const globalSpeechLimit = pLimit(8)

// inside the per-chunk work:
await globalSpeechLimit(() => runtime.generateSpeech({ ... }))
```

   Per chunk: `throwIfAborted(context.signal)` → the limited `generateSpeech` → `buildTtsObjectKey({ prefix: imageStorageOptions.prefix, ... })` → `fileService.uploadBuffer(buffer, { type: 'audio', contentType: 'audio/mpeg', objectKey, skipReference: true })` → `repository.upsertBlock(...)` → `context.updateProgress(Math.round((100 * ++done) / total), \`Generated ${done}/${total}\`, done, total)`.
9. Re-read `modifiedAt`; on mismatch, log, skip finalize, return `{ requeue: true }`.
10. Finalize: `repository.upsertParent({...})`, then `repository.deleteBlocksByIds(plan.toDelete.map(d => d.rowId))`, then delete each displaced object — including the pre-upsert storage keys captured for regenerated chunks. Object deletion failures are `logger.warn`, never thrown.
11. Aggregate: `context.setResult({ perLang, skipped })` and `context.setStatus(TaskStatus.Failed | TaskStatus.PartialFailed)` as in `AiSummaryService`.

Add a `deleteObject(backend, key)` helper on `FileService` (S3: `S3Uploader.deleteObject`; local: `unlink(this.resolveFilePath('audio', key))`, ignoring `ENOENT`) and call it from here.

Register `AiTtsService`, `AiTtsRepository` in `ai.module.ts` `providers`, and add `AiTtsService` to `exports`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/ai-tts.faux.e2e.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/modules/ai apps/core/src/modules/file apps/core/test/src/modules/ai/ai-tts
git commit -m "feat(ai-tts): add generation task handler"
```

---

## Task 11: Article deletion cleanup and orphan reconciliation

**Files:**
- Modify: `apps/core/src/modules/ai/ai-tts/ai-tts.service.ts`
- Test: `apps/core/test/src/modules/ai/ai-tts/ai-tts-cleanup.spec.ts`

**Interfaces:**
- Consumes: `AiTtsRepository.deleteByRefId` (Task 9), `FileService.deleteObject` (Task 10)
- Produces: `AiTtsService.handleArticleDeleted(refId): Promise<void>`, `AiTtsService.reconcileOrphans(): Promise<{ deleted: number }>`

- [ ] **Step 1: Find the existing delete hooks**

Run: `rg -n "EventBusEvents|OnEvent|deleteById" apps/core/src/modules/ai/ai-summary/ai-summary.service.ts | head -20`

Read the post/note/page delete handlers there — TTS mirrors them exactly. Do not invent a new eventing mechanism.

- [ ] **Step 2: Write the failing test**

```ts
  it('removes rows and their objects when an article is deleted', async () => {
    repository.deleteByRefId.mockResolvedValue([
      { storageBackend: 's3', storageKey: 'k/a' },
      { storageBackend: 'local', storageKey: 'tts/1/zh/b.mp3' },
    ])

    await service.handleArticleDeleted('1')

    expect(fileService.deleteObject).toHaveBeenCalledWith('s3', 'k/a')
    expect(fileService.deleteObject).toHaveBeenCalledWith(
      'local',
      'tts/1/zh/b.mp3',
    )
  })

  it('survives an object deletion failure', async () => {
    repository.deleteByRefId.mockResolvedValue([
      { storageBackend: 's3', storageKey: 'k/a' },
    ])
    fileService.deleteObject.mockRejectedValue(new Error('network'))

    await expect(service.handleArticleDeleted('1')).resolves.toBeUndefined()
  })
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/ai-tts-cleanup.spec.ts`
Expected: FAIL — `handleArticleDeleted is not a function`.

- [ ] **Step 4: Implement the handlers**

```ts
  async handleArticleDeleted(refId: string): Promise<void> {
    const removed = await this.repository.deleteByRefId(refId)
    await this.deleteObjects(removed)
  }

  private async deleteObjects(
    blocks: Array<{ storageBackend: 's3' | 'local'; storageKey: string }>,
  ): Promise<void> {
    for (const block of blocks) {
      try {
        await this.fileService.deleteObject(block.storageBackend, block.storageKey)
      } catch (error) {
        this.logger.warn(
          `failed to delete tts object ${block.storageKey}: ${(error as Error).message}`,
        )
      }
    }
  }
```

`reconcileOrphans` lists objects under the `tts/` prefix (S3) or walks `STATIC_FILE_DIR/audio/tts` (local), collects every `storage_key` from `ai_tts_blocks`, and deletes objects with no row that are older than 60 minutes. Wire it to the same cron that calls `cleanupOrphanFiles` — find it with `rg -n "cleanupOrphanFiles" apps/core/src --glob '*.ts'`.

Subscribe `handleArticleDeleted` to the post/note/page delete events using the exact pattern found in step 1.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/ai-tts-cleanup.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/modules/ai/ai-tts apps/core/test/src/modules/ai/ai-tts
git commit -m "feat(ai-tts): clean up audio on article deletion"
```

---

## Task 12: HTTP surface

**Files:**
- Create: `apps/core/src/modules/ai/ai-tts/ai-tts.schema.ts`
- Create: `apps/core/src/modules/ai/ai-tts/ai-tts.views.ts`
- Create: `apps/core/src/modules/ai/ai-tts/ai-tts.controller.ts`
- Modify: `apps/core/src/modules/ai/ai.module.ts`
- Test: `apps/core/test/src/modules/ai/ai-tts/ai-tts.controller.spec.ts`

**Interfaces:**
- Consumes: `AiTtsService` (Task 10), `AiTaskService.createTtsTask` (Task 10)
- Produces: routes `POST /ai/tts/task`, `GET /ai/tts/ref/:id`, `GET /ai/tts`, `DELETE /ai/tts/:id`, `GET /ai/tts/article/:id`

- [ ] **Step 1: Write the DTOs and views**

`ai-tts.schema.ts`:

```ts
export const CreateTtsTaskSchema = z.object({
  refId: z.string(),
  langs: z.array(z.string()).max(8).optional(),
  force: z.boolean().optional(),
})
export class CreateTtsTaskDto extends createZodDto(CreateTtsTaskSchema) {}

export const GetTtsQuerySchema = z.object({ lang: z.string().optional() })
export class GetTtsQueryDto extends createZodDto(GetTtsQuerySchema) {}
```

`ai-tts.views.ts`:

```ts
const SegmentSchema = z.object({
  blockId: z.string(),
  chunkIndex: z.number(),
  text: z.string(),
  url: z.string(),
})

export const AiTtsViews = {
  public: z.object({
    lang: z.string(),
    model: z.string(),
    voice: z.string(),
    blockOrder: z.array(z.string()),
    segments: z.array(SegmentSchema),
  }),
  detail: z.object({
    id: z.string(),
    lang: z.string(),
    isTranslation: z.boolean(),
    model: z.string(),
    voice: z.string(),
    speed: z.number(),
    blockOrder: z.array(z.string()),
    charCount: z.number(),
    updatedAt: z.date().nullish(),
    segments: z.array(SegmentSchema),
  }),
  listItem: z.object({
    id: z.string(),
    refId: z.string(),
    lang: z.string(),
    blockCount: z.number(),
    charCount: z.number(),
    updatedAt: z.date().nullish(),
  }),
}
```

- [ ] **Step 2: Write the failing controller test**

Read `ai-public-sse-controllers.spec.ts` for the controller-unit pattern, then assert:

```ts
  it('returns null for an article with no narration', async () => {
    service.getPublicNarration.mockResolvedValue(null)
    await expect(controller.getArticleTts({ id: '1' }, {})).resolves.toBeNull()
  })

  it('returns null for an unpublished article', async () => {
    service.getPublicNarration.mockResolvedValue(null)
    expect(await controller.getArticleTts({ id: 'draft' }, {})).toBeNull()
  })

  it('returns null for a locked premium article', async () => {
    service.getPublicNarration.mockResolvedValue(null)
    expect(await controller.getArticleTts({ id: 'premium' }, {})).toBeNull()
  })

  it('enqueues a task with the canonical language list', async () => {
    await controller.createTask({ refId: '1', langs: ['zh-CN', 'zh'] })
    expect(taskService.createTtsTask).toHaveBeenCalledWith(
      expect.objectContaining({ refId: '1', langs: ['zh'] }),
    )
  })
```

The premium and draft cases belong in `AiTtsService.getPublicNarration` — assert the guard there with a service-level test that feeds `findGlobalById` a premium post and expects `null` without touching the repository.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/ai-tts.controller.spec.ts`
Expected: FAIL — controller not found.

- [ ] **Step 4: Implement the controller**

```ts
@ApiController('ai/tts')
export class AiTtsController {
  constructor(
    private readonly service: AiTtsService,
    private readonly taskService: AiTaskService,
  ) {}

  @Post('/task')
  @Auth()
  createTask(@Body() body: CreateTtsTaskDto) {
    return this.taskService.createTtsTask({
      refId: body.refId,
      langs: body.langs?.map((lang) => parseLanguageCode(lang)),
      force: body.force,
    })
  }

  @Get('/ref/:id')
  @Auth()
  getByRefId(@Param() params: EntityIdDto) {
    return this.service.getDetailsByRefId(params.id)
  }

  @Get('/')
  @Auth()
  async list(@Query() query: BasicPagerDto) {
    const result = await this.service.list(query)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Delete('/:id')
  @Auth()
  delete(@Param() params: EntityIdDto) {
    return this.service.deleteById(params.id)
  }

  @Get('/article/:id')
  getArticleTts(
    @Param() params: EntityIdDto,
    @Query() query: GetTtsQueryDto,
  ) {
    return this.service.getPublicNarration(
      params.id,
      query.lang ? parseLanguageCode(query.lang) : undefined,
    )
  }
}
```

`getPublicNarration` must run both guards before any repository read:

```ts
    const article = await this.databaseService.findGlobalById(refId)
    if (!article || !isGlobalArticleVisible(article)) return null
    if (this.isPremiumLocked(article)) return null
```

`isPremiumLocked` reuses the exact premium check from `AiInsightsService` — read `ai-insights.service.ts:124–150` and copy its logic rather than inventing a second policy.

Register `AiTtsController` in `ai.module.ts` `controllers`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts`
Expected: PASS.

- [ ] **Step 6: Verify the envelope check**

Run: `pnpm -C apps/core exec tsx scripts/check-controller-response-envelope.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/core/src/modules/ai/ai-tts apps/core/test/src/modules/ai/ai-tts
git commit -m "feat(ai-tts): add admin and public endpoints"
```

---

## Task 13: `meta.tts` on article detail

**Files:**
- Modify: `apps/core/src/common/response/meta.types.ts`
- Modify: `apps/core/src/modules/post/post-meta-builder.ts`
- Modify: `apps/core/src/modules/note/note-meta-builder.ts`
- Modify: `apps/core/src/modules/post/post.controller.ts`
- Modify: `apps/core/src/modules/note/note.controller.ts`
- Test: `apps/core/test/src/modules/ai/ai-tts/ai-tts-meta.spec.ts`

**Interfaces:**
- Consumes: `AiTtsService.getMetaForArticle` (Task 10)
- Produces: `TtsMetaSchema`, `PostMetaBuilder.tts()`, `NoteMetaBuilder.tts()`

- [ ] **Step 1: Write the failing test**

```ts
  it('reports available with the block count', async () => {
    repository.findMeta.mockResolvedValue({
      id: '1',
      updatedAt: new Date('2026-01-02'),
      blockCount: 3,
      sourceModifiedAt: new Date('2026-01-02'),
    })

    await expect(
      service.getMetaForArticle('1', 'zh', new Date('2026-01-02')),
    ).resolves.toEqual({
      available: true,
      lang: 'zh',
      blockCount: 3,
      stale: false,
      updatedAt: new Date('2026-01-02'),
    })
  })

  it('marks narration stale when the article was edited later', async () => {
    repository.findMeta.mockResolvedValue({
      id: '1',
      updatedAt: new Date('2026-01-02'),
      blockCount: 3,
      sourceModifiedAt: new Date('2026-01-02'),
    })

    const meta = await service.getMetaForArticle('1', 'zh', new Date('2026-03-01'))
    expect(meta.stale).toBe(true)
  })

  it('reports unavailable on a miss', async () => {
    repository.findMeta.mockResolvedValue(null)
    await expect(
      service.getMetaForArticle('1', 'zh', new Date()),
    ).resolves.toEqual({ available: false })
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/ai-tts-meta.spec.ts`
Expected: FAIL — `getMetaForArticle is not a function`.

- [ ] **Step 3: Add the schema and builder methods**

In `meta.types.ts`:

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

Add `tts: TtsMetaSchema.optional()` to `PostResponseMetaSchema` and `NoteResponseMetaSchema`, export `export type TtsMeta = z.infer<typeof TtsMetaSchema>`, and add to both builders:

```ts
  tts(value: TtsMeta): this {
    ;(this.meta as PostResponseMeta).tts = value
    return this
  }
```

- [ ] **Step 4: Implement the service method**

```ts
  async getMetaForArticle(
    refId: string,
    lang: string,
    modifiedAt?: Date | null,
  ): Promise<TtsMeta> {
    const row = await this.repository.findMeta(refId, lang)
    if (!row) return { available: false }

    return {
      available: true,
      lang,
      blockCount: row.blockCount,
      stale: Boolean(
        modifiedAt &&
          row.sourceModifiedAt &&
          modifiedAt.getTime() > row.sourceModifiedAt.getTime(),
      ),
      updatedAt: row.updatedAt,
    }
  }
```

- [ ] **Step 5: Wire the three handlers**

In `post.controller.ts`, inside the `@Get('/:category/:slug')` handler, extend the existing `Promise.all` destructuring with a `ttsMeta` binding and add the matching call as the last array element:

```ts
    const [
      translationResult,
      relatedTitleMap,
      entryMaps,
      hasInsightsInLocale,
      summaryDoc,
      ttsMeta,
    ] = await Promise.all([
      // ...existing entries unchanged...
      this.aiTtsService
        .getMetaForArticle(postDocument.id, insightsLang, postDocument.modifiedAt)
        .catch(() => ({ available: false as const })),
    ])
```

and on the builder chain, after `.insights(...)`:

```ts
      .tts(paywall?.locked ? { available: false } : ttsMeta)
```

In `note.controller.ts`, do the same in the shared detail meta assembly and in `@Get('/latest')`. Inject `AiTtsService` in both controllers' constructors — it is exported from `AiModule` (Task 10).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm -C apps/core test run test/src/modules/ai/ai-tts/ai-tts-meta.spec.ts`
Expected: PASS.

Run: `pnpm -C apps/core test run test/src/modules/post test/src/modules/note`
Expected: PASS — existing detail tests unaffected.

- [ ] **Step 7: Commit**

```bash
git add apps/core/src/common/response apps/core/src/modules/post apps/core/src/modules/note apps/core/src/modules/ai apps/core/test/src/modules/ai/ai-tts
git commit -m "feat(ai-tts): advertise narration availability in article detail meta"
```

---

## Task 14: api-client surface

**Files:**
- Modify: `packages/api-client/controllers/ai.ts`
- Modify: `packages/api-client/models/ai.ts`
- Test: `packages/api-client/__tests__/controllers/ai.test.ts`

**Interfaces:**
- Consumes: `GET /ai/tts/article/:id` (Task 12)
- Produces: `AIController.getTts({ articleId, lang })`, `AITtsModel`

- [ ] **Step 1: Write the failing test**

Append to `packages/api-client/__tests__/controllers/ai.test.ts`, matching the file's existing mock-client style:

```ts
  it('getTts requests the article narration', async () => {
    await client.ai.getTts({ articleId: 'post-1', lang: 'zh' })

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/ai/tts/article/post-1'),
        params: expect.objectContaining({ lang: 'zh' }),
      }),
    )
  })
```

Read the file first and mirror whatever assertion helper it already uses.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C packages/api-client test run __tests__/controllers/ai.test.ts`
Expected: FAIL — `getTts is not a function`.

- [ ] **Step 3: Add the model and method**

In `packages/api-client/models/ai.ts`:

```ts
export interface AITtsSegmentModel {
  blockId: string
  chunkIndex: number
  text: string
  url: string
}

export interface AITtsModel {
  lang: string
  model: string
  voice: string
  blockOrder: string[]
  segments: AITtsSegmentModel[]
}
```

In `packages/api-client/controllers/ai.ts`:

```ts
  async getTts({ articleId, lang }: { articleId: string; lang?: string }) {
    return this.proxy.tts.article(articleId).get<AITtsModel | null>({
      params: { lang },
    })
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C packages/api-client test run __tests__/controllers/ai.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api-client
git commit -m "feat(api-client): add getTts"
```

---

## Task 15: Admin editor panel

**Files:**
- Modify: `apps/admin/src/api/ai.ts`
- Create: `apps/admin/src/features/write/components/tts/TtsGenerationEntry.tsx`
- Create: `apps/admin/src/features/write/components/tts/use-tts-generation.ts`
- Modify: `apps/admin/src/features/write/components/WriteRouteViewsContent.tsx`
- Modify: `apps/admin/src/i18n/resources/en-US.ts`, `apps/admin/src/i18n/resources/zh-CN.ts`

**Interfaces:**
- Consumes: `POST /ai/tts/task`, `GET /ai/tts/ref/:id` (Task 12)
- Produces: `<TtsGenerationEntry refId={...} />`

- [ ] **Step 1: Read the reference implementation**

Read `apps/admin/src/features/write/components/cover-generation/CoverGenerationEntry.tsx` and `use-cover-generation.ts` end to end. The TTS entry mirrors their structure: a hook owning task state plus a presentational entry component. Follow their data-fetching library, their task-progress subscription, and their styling conventions exactly.

- [ ] **Step 2: Add the API methods**

In `apps/admin/src/api/ai.ts`, following the file's existing style:

```ts
export const createTtsTask = (body: {
  refId: string
  langs?: string[]
  force?: boolean
}) => apiClient.post('/ai/tts/task', body)

export const getTtsByRefId = (refId: string) =>
  apiClient.get(`/ai/tts/ref/${refId}`)

export const deleteTts = (id: string) => apiClient.delete(`/ai/tts/${id}`)
```

Replace `apiClient.*` with whatever transport the file already uses.

- [ ] **Step 3: Build the hook**

`use-tts-generation.ts` exposes:

```ts
export function useTtsGeneration(refId: string) {
  // query: getTtsByRefId(refId) -> rows per language
  // mutation: generate() -> createTtsTask({ refId })
  // mutation: regenerate() -> createTtsTask({ refId, force: true })
  // subscribes to the task progress channel used by use-cover-generation
  return { rows, isLoading, generate, regenerate, progress, isRunning }
}
```

- [ ] **Step 4: Build the entry component**

`TtsGenerationEntry.tsx` renders a toolbar button that opens a drawer containing, per language tab: the locked `model` / `voice` / `speed`, block and character counts, a **Generate** and a **Regenerate** button, and a list of segments each with its text and an `<audio controls src={segment.url} />`. While a task runs, show the percentage from `progress`. Keep the component under 300 lines; extract the segment list into a sibling file if it grows.

Mount it in `WriteRouteViewsContent.tsx` next to the cover-generation entry, passing the current article id, and render nothing when the article has not been saved yet (no id).

- [ ] **Step 5: Add i18n keys**

Add the same key set to both `en-US.ts` and `zh-CN.ts` — the title, the two button labels, the four status labels, and the empty state. Follow the surrounding namespace convention.

- [ ] **Step 6: Verify**

Run: `pnpm -C apps/admin run lint`
Expected: PASS for the touched files.

Run: `pnpm -C apps/admin exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/api apps/admin/src/features/write apps/admin/src/i18n
git commit -m "feat(admin): add TTS generation panel to the editor"
```

---

## Task 16: Admin management page

**Files:**
- Create: `apps/admin/src/views/(intelligence)/ai/tts/page.tsx`
- Create: `apps/admin/src/features/ai/routes/AiTtsRouteView.tsx`
- Modify: `apps/admin/src/api/ai.ts`
- Modify: `apps/admin/src/i18n/resources/en-US.ts`, `apps/admin/src/i18n/resources/zh-CN.ts`

**Interfaces:**
- Consumes: `GET /ai/tts`, `DELETE /ai/tts/:id`, `POST /ai/tts/task` (Task 12)
- Produces: the `/ai/tts` admin route

- [ ] **Step 1: Read the reference implementation**

Read `apps/admin/src/features/ai/routes/AiSummaryRouteView.tsx` and `apps/admin/src/views/(intelligence)/ai/summary/page.tsx` end to end. Match their table component, pagination hook, and empty/loading states.

- [ ] **Step 2: Add the list API method**

```ts
export const getTtsList = (params: { page?: number; size?: number }) =>
  apiClient.get('/ai/tts', { params })
```

- [ ] **Step 3: Build the route view**

`AiTtsRouteView.tsx` renders a paginated table with columns: article title (from `meta.articles`), language, block count, character count, updated at, and a row action menu with **Regenerate** (`createTtsTask({ refId, langs: [lang], force: true })`) and **Delete** (`deleteTts(id)`). Add a header action for batch enqueue over the selected rows.

- [ ] **Step 4: Add the page and nav entry**

`page.tsx` is a thin wrapper rendering `<AiTtsRouteView />`, matching `ai/summary/page.tsx`. Add the nav item beside the existing summary / insights / translation entries — find them with `rg -n "ai/summary" apps/admin/src --glob '*.ts*'`.

- [ ] **Step 5: Add i18n keys**

Add the page title, the column headers, and the two action labels to both resource files.

- [ ] **Step 6: Verify**

Run: `pnpm -C apps/admin run lint`
Expected: PASS for the touched files.

Run: `pnpm -C apps/admin exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src
git commit -m "feat(admin): add TTS management page"
```

---

## Task 17: Full-suite verification

**Files:** none created

- [ ] **Step 1: Run the core test suite**

Run: `pnpm -C apps/core test run`
Expected: PASS, no new failures relative to the branch point.

- [ ] **Step 2: Run the api-client suite**

Run: `pnpm -C packages/api-client test run`
Expected: PASS.

- [ ] **Step 3: Lint the touched core files**

Run: `pnpm -C apps/core exec eslint <the files this branch changed> --fix`
Expected: clean.

- [ ] **Step 4: Re-check the migration lint**

Run: `pnpm -C apps/core run lint:migrations`
Expected: PASS.

- [ ] **Step 5: Commit any lint fixes**

```bash
git add -A
git commit -m "chore(ai-tts): lint fixes"
```

---

## Self-Review Notes

Spec sections mapped to tasks:

| Spec section | Task |
|---|---|
| §1 Provider runtime | 8 |
| §2 Configuration | 2 |
| §3 Data model | 1, 9 |
| §4 Block planning | 5, 6 |
| §5 Generation pipeline | 10 |
| §5 Audio file lifecycle + object key | 3, 7, 11 |
| §6 HTTP surface | 12 |
| §6 Article detail meta | 13 |
| §6 api-client | 14 |
| §7 Admin UI | 15, 16 |
| §8 Errors + ceilings | 4, 10 |
| §9 Testing | folded into every task |
