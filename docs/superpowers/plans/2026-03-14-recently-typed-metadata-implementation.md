# Recently Typed Metadata Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend RecentlyModel with `type` + `metadata` fields to support rich content cards (book, media, music, github, link, academic, code).

**Architecture:** Add `type` enum and `metadata` Mixed field to the TypeGoose model. Replace the existing Zod schema with a `z.preprocess` + `z.discriminatedUnion` that validates metadata per type. Update service create/update to pass new fields. Update API client types.

**Tech Stack:** NestJS, TypeGoose/Mongoose, Zod (nestjs-zod), Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `apps/core/src/modules/recently/recently.schema.ts` | Zod schemas: type enum, metadata schemas, discriminated union DTO |
| Modify | `apps/core/src/modules/recently/recently.model.ts` | TypeGoose model: add `type` and `metadata` fields |
| Modify | `apps/core/src/modules/recently/recently.service.ts` | Pass `type`/`metadata` in create() and update() |
| Modify | `apps/core/src/modules/recently/recently.controller.ts` | Use new DTO for PUT endpoint |
| Modify | `packages/api-client/models/recently.ts` | Add type enum, metadata interfaces, update RecentlyModel |
| Create | `apps/core/test/src/modules/recently/recently.controller.e2e-spec.ts` | E2E tests for typed recently CRUD |

---

## Chunk 1: Schema & Model

### Task 1: Add Zod metadata schemas and discriminated union DTO

**Files:**
- Modify: `apps/core/src/modules/recently/recently.schema.ts`

- [ ] **Step 1: Write the new schema file**

Replace `RecentlySchema` and `RecentlyDto` with the type enum, metadata schemas, and discriminated union. Keep `RecentlyAttitudeEnum`, `RecentlyAttitudeSchema`, `RecentlyAttitudeDto` unchanged.

```typescript
import { zMongoId } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export enum RecentlyAttitudeEnum {
  Up,
  Down,
}

export enum RecentlyTypeEnum {
  Text = 'text',
  Book = 'book',
  Media = 'media',
  Music = 'music',
  Github = 'github',
  Link = 'link',
  Academic = 'academic',
  Code = 'code',
}

// --- Metadata schemas per type ---

export const BookMetaSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  author: z.string(),
  cover: z.string().url().optional(),
  rating: z.number().min(0).max(10).optional(),
  isbn: z.string().optional(),
})

export const MediaMetaSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  originalTitle: z.string().optional(),
  cover: z.string().url().optional(),
  rating: z.number().min(0).max(10).optional(),
  description: z.string().optional(),
  genre: z.string().optional(),
})

export const MusicMetaSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  cover: z.string().url().optional(),
  source: z.string().optional(),
})

export const GithubMetaSchema = z.object({
  url: z.string().url(),
  owner: z.string(),
  repo: z.string(),
  description: z.string().optional(),
  stars: z.number().optional(),
  language: z.string().optional(),
  languageColor: z.string().optional(),
})

export const LinkMetaSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().url().optional(),
})

export const AcademicMetaSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  authors: z.array(z.string()).optional(),
  arxivId: z.string().optional(),
})

export const CodeMetaSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  difficulty: z.string().optional(),
  tags: z.array(z.string()).optional(),
  platform: z.string().optional(),
})

// --- Shared optional fields ---

const refFields = {
  ref: zMongoId.optional(),
  refType: z.string().optional(),
}

// --- Discriminated union with preprocess for backward compat ---

const RecentlyDiscriminatedSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(RecentlyTypeEnum.Text),
    content: z.string().min(1),
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Book),
    content: z.string().optional().default(''),
    metadata: BookMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Media),
    content: z.string().optional().default(''),
    metadata: MediaMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Music),
    content: z.string().optional().default(''),
    metadata: MusicMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Github),
    content: z.string().optional().default(''),
    metadata: GithubMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Link),
    content: z.string().optional().default(''),
    metadata: LinkMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Academic),
    content: z.string().optional().default(''),
    metadata: AcademicMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Code),
    content: z.string().optional().default(''),
    metadata: CodeMetaSchema,
    ...refFields,
  }),
])

export const RecentlySchema = z.preprocess((val: any) => {
  if (val && typeof val === 'object' && !val.type) {
    return { ...val, type: RecentlyTypeEnum.Text }
  }
  return val
}, RecentlyDiscriminatedSchema)

export class RecentlyDto extends createZodDto(RecentlySchema) {}

// --- Attitude schema (unchanged) ---

export const RecentlyAttitudeSchema = z.object({
  attitude: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.enum(RecentlyAttitudeEnum),
  ),
})

export class RecentlyAttitudeDto extends createZodDto(RecentlyAttitudeSchema) {}

// Type exports
export type RecentlyInput = z.infer<typeof RecentlyDiscriminatedSchema>
export type RecentlyAttitudeInput = z.infer<typeof RecentlyAttitudeSchema>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/innei/git/innei-repo/mx-core && pnpm -C apps/core exec tsc --noEmit --pretty 2>&1 | head -30`

Expected: No errors related to `recently.schema.ts`

### Task 2: Add type and metadata fields to TypeGoose model

**Files:**
- Modify: `apps/core/src/modules/recently/recently.model.ts`

- [ ] **Step 1: Add new fields to RecentlyModel**

Add imports for `RecentlyTypeEnum` and the `type`/`metadata` props:

```typescript
import { modelOptions, prop } from '@typegoose/typegoose'
import mongoose from 'mongoose'
import {
  CollectionRefTypes,
  RECENTLY_COLLECTION_NAME,
} from '~/constants/db.constant'
import { BaseCommentIndexModel } from '~/shared/model/base-comment.model'
import { RecentlyTypeEnum } from './recently.schema'

export type RefType = {
  title: string
  url: string
}

@modelOptions({
  options: {
    customName: RECENTLY_COLLECTION_NAME,
  },
})
export class RecentlyModel extends BaseCommentIndexModel {
  @prop({ required: true })
  content: string

  @prop({
    type: String,
    enum: Object.values(RecentlyTypeEnum),
    default: RecentlyTypeEnum.Text,
  })
  type: RecentlyTypeEnum

  @prop({ type: () => mongoose.Schema.Types.Mixed })
  metadata?: Record<string, any>

  @prop({ refPath: 'refType' })
  ref: RefType

  @prop({ type: String })
  refType: CollectionRefTypes

  @prop()
  modified?: Date

  @prop({ default: 0 })
  up: number

  @prop({ default: 0 })
  down: number

  get refId() {
    return (this.ref as any)?._id ?? this.ref
  }

  set refId(id: string) {
    return
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/innei/git/innei-repo/mx-core && pnpm -C apps/core exec tsc --noEmit --pretty 2>&1 | head -30`

Expected: No errors related to `recently.model.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/core/src/modules/recently/recently.schema.ts apps/core/src/modules/recently/recently.model.ts
git commit -m "feat(recently): add type enum and metadata Zod schemas"
```

---

## Chunk 2: Service & Controller

### Task 3: Update service create() and update() to pass type/metadata

**Files:**
- Modify: `apps/core/src/modules/recently/recently.service.ts`

- [ ] **Step 1: Update create() method**

In `recently.service.ts` line 256, change the `this.model.create()` call to include `type` and `metadata`:

```typescript
// Before (line 256-260):
const res = await this.model.create({
  content: model.content,
  ref: model.refId as unknown as RecentlyModel['ref'],
  refType: model.refType,
})

// After:
const res = await this.model.create({
  content: model.content,
  type: (model as any).type,
  metadata: (model as any).metadata,
  ref: model.refId as unknown as RecentlyModel['ref'],
  refType: model.refType,
})
```

- [ ] **Step 2: Update update() method**

In `recently.service.ts` line 307-311, change `findByIdAndUpdate` to include `type` and `metadata`:

```typescript
// Before (line 307-311):
const res = await this.model.findByIdAndUpdate(
  id,
  { content: model.content, modified: new Date() },
  { new: true },
)

// After:
const res = await this.model.findByIdAndUpdate(
  id,
  {
    content: model.content,
    type: model.type,
    metadata: model.metadata,
    modified: new Date(),
  },
  { new: true },
)
```

### Task 4: Update controller PUT endpoint to use validated DTO

**Files:**
- Modify: `apps/core/src/modules/recently/recently.controller.ts`

- [ ] **Step 1: Change PUT body type from RecentlyModel to RecentlyDto**

In `recently.controller.ts` line 68, change:

```typescript
// Before:
@Put('/:id')
@Auth()
async update(@Param() { id }: MongoIdDto, @Body() body: RecentlyModel) {

// After:
@Put('/:id')
@Auth()
async update(@Param() { id }: MongoIdDto, @Body() body: RecentlyDto) {
```

Update the import at the top to remove `RecentlyModel` if no longer needed (it's still used in service cast, keep it):

No import changes needed — `RecentlyDto` is already imported.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/innei/git/innei-repo/mx-core && pnpm -C apps/core exec tsc --noEmit --pretty 2>&1 | head -30`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/core/src/modules/recently/recently.service.ts apps/core/src/modules/recently/recently.controller.ts
git commit -m "feat(recently): pass type/metadata in service create/update"
```

---

## Chunk 3: API Client

### Task 5: Update API client types

**Files:**
- Modify: `packages/api-client/models/recently.ts`

- [ ] **Step 1: Add type enum and metadata interfaces**

Replace the full file content:

```typescript
import type { BaseCommentIndexModel } from './base'

export enum RecentlyRefTypes {
  Post = 'Post',
  Note = 'Note',
  Page = 'Page',
}

export type RecentlyRefType = {
  title: string
  url: string
}

export enum RecentlyTypeEnum {
  Text = 'text',
  Book = 'book',
  Media = 'media',
  Music = 'music',
  Github = 'github',
  Link = 'link',
  Academic = 'academic',
  Code = 'code',
}

export interface BookMetadata {
  url: string
  title: string
  author: string
  cover?: string
  rating?: number
  isbn?: string
}

export interface MediaMetadata {
  url: string
  title: string
  originalTitle?: string
  cover?: string
  rating?: number
  description?: string
  genre?: string
}

export interface MusicMetadata {
  url: string
  title: string
  artist: string
  album?: string
  cover?: string
  source?: string
}

export interface GithubMetadata {
  url: string
  owner: string
  repo: string
  description?: string
  stars?: number
  language?: string
  languageColor?: string
}

export interface LinkMetadata {
  url: string
  title?: string
  description?: string
  image?: string
}

export interface AcademicMetadata {
  url: string
  title: string
  authors?: string[]
  arxivId?: string
}

export interface CodeMetadata {
  url: string
  title: string
  difficulty?: string
  tags?: string[]
  platform?: string
}

export type RecentlyMetadata =
  | BookMetadata
  | MediaMetadata
  | MusicMetadata
  | GithubMetadata
  | LinkMetadata
  | AcademicMetadata
  | CodeMetadata

export interface RecentlyModel extends BaseCommentIndexModel {
  content: string
  type: RecentlyTypeEnum
  metadata?: RecentlyMetadata

  ref?: RecentlyRefType & { [key: string]: any }
  refId?: string
  refType?: RecentlyRefTypes

  up: number
  down: number

  modified?: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/innei/git/innei-repo/mx-core && pnpm exec tsc -p packages/api-client/tsconfig.json --noEmit --pretty 2>&1 | head -30`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/api-client/models/recently.ts
git commit -m "feat(api-client): add RecentlyTypeEnum and metadata interfaces"
```

---

## Chunk 4: E2E Tests

### Task 6: Write E2E tests for typed recently CRUD

**Files:**
- Create: `apps/core/test/src/modules/recently/recently.controller.e2e-spec.ts`

- [ ] **Step 1: Write test file**

```typescript
import { redisHelper } from '@/helper/redis-mock.helper'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { ReturnModelType } from '@typegoose/typegoose'
import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { RecentlyController } from '~/modules/recently/recently.controller'
import { RecentlyModel } from '~/modules/recently/recently.model'
import { RecentlyTypeEnum } from '~/modules/recently/recently.schema'
import { RecentlyService } from '~/modules/recently/recently.service'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { CommentService } from '~/modules/comment/comment.service'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { authPassHeader } from 'test/mock/guard/auth.guard'

describe('test /recently typed metadata', () => {
  let app: NestFastifyApplication
  let model: ReturnModelType<typeof RecentlyModel>

  const proxy = createE2EApp({
    controllers: [RecentlyController],
    providers: [
      RecentlyService,
      {
        provide: DatabaseService,
        useValue: {
          findGlobalById: async () => null,
          db: { collection: () => ({ find: () => ({ [Symbol.asyncIterator]: async function* () {} }) }) },
        },
      },
      {
        provide: RedisService,
        useValue: (await redisHelper).RedisService,
      },
      {
        provide: EventManagerService,
        useValue: { async emit() {} },
      },
      {
        provide: ConfigsService,
        useValue: {
          async get() {
            return { commentShouldAudit: false }
          },
        },
      },
      {
        provide: CommentService,
        useValue: {
          model: { countDocuments: async () => 0, deleteMany: async () => ({}) },
        },
      },
    ],
    models: [RecentlyModel],
    async pourData(modelMap) {
      model = modelMap.get(RecentlyModel)!.model as ReturnModelType<typeof RecentlyModel>
    },
  })

  beforeEach(() => {
    app = proxy.app
  })

  // --- Backward compatibility ---

  test('POST /recently without type defaults to text', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: authPassHeader,
      payload: { content: 'hello world' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.type).toBe(RecentlyTypeEnum.Text)
    expect(body.metadata).toBeUndefined()
  })

  test('POST /recently with type=text requires content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: authPassHeader,
      payload: { type: 'text' },
    })
    expect(res.statusCode).toBe(422)
  })

  // --- Book type ---

  test('POST /recently with type=book and metadata', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: authPassHeader,
      payload: {
        type: 'book',
        content: 'Great read!',
        metadata: {
          url: 'https://example.com/book',
          title: 'DDIA',
          author: 'Martin Kleppmann',
          rating: 9.5,
        },
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.type).toBe(RecentlyTypeEnum.Book)
    expect(body.metadata.title).toBe('DDIA')
    expect(body.metadata.author).toBe('Martin Kleppmann')
  })

  test('POST /recently with type=book allows empty content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: authPassHeader,
      payload: {
        type: 'book',
        metadata: {
          url: 'https://example.com/book2',
          title: 'Clean Code',
          author: 'Robert C. Martin',
        },
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.content).toBe('')
  })

  test('POST /recently with type=book rejects missing metadata', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: authPassHeader,
      payload: { type: 'book', content: 'no metadata' },
    })
    expect(res.statusCode).toBe(422)
  })

  // --- Link type ---

  test('POST /recently with type=link and metadata', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: authPassHeader,
      payload: {
        type: 'link',
        content: 'Interesting article',
        metadata: {
          url: 'https://vercel.com/blog/rsc',
          title: 'Understanding RSC',
          description: 'A deep dive into React Server Components',
        },
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.type).toBe(RecentlyTypeEnum.Link)
    expect(body.metadata.url).toBe('https://vercel.com/blog/rsc')
  })

  // --- Update ---

  test('PUT /recently/:id updates type and metadata', async () => {
    const created = await model.create({
      content: 'original',
      type: RecentlyTypeEnum.Text,
    })

    const res = await app.inject({
      method: 'PUT',
      url: `${apiRoutePrefix}/recently/${created._id}`,
      headers: authPassHeader,
      payload: {
        type: 'music',
        content: 'Updated to music',
        metadata: {
          url: 'https://music.163.com/song?id=123',
          title: 'Sunny Day',
          artist: 'Jay Chou',
        },
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.type).toBe(RecentlyTypeEnum.Music)
    expect(body.metadata.artist).toBe('Jay Chou')
  })

  // --- Invalid metadata ---

  test('POST /recently with invalid metadata url rejects', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: authPassHeader,
      payload: {
        type: 'github',
        metadata: {
          url: 'not-a-url',
          owner: 'vercel',
          repo: 'next.js',
        },
      },
    })
    expect(res.statusCode).toBe(422)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/innei/git/innei-repo/mx-core && pnpm test -- apps/core/test/src/modules/recently/recently.controller.e2e-spec.ts`

Expected: All tests pass

- [ ] **Step 3: Fix any test failures**

Adjust mocks or assertions based on actual behavior. Common issues:
- Status code 201 vs 200 for POST (check if interceptor returns 201)
- Response shape may be wrapped by `ResponseInterceptor`

- [ ] **Step 4: Commit**

```bash
git add apps/core/test/src/modules/recently/recently.controller.e2e-spec.ts
git commit -m "test(recently): add E2E tests for typed metadata CRUD"
```

---

## Chunk 5: Lint & Final Verification

### Task 7: Lint and typecheck modified files

- [ ] **Step 1: Run lint on changed files**

Run: `cd /Users/innei/git/innei-repo/mx-core && pnpm lint`

Expected: No new errors

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/innei/git/innei-repo/mx-core && pnpm test`

Expected: All tests pass, no regressions

- [ ] **Step 3: Final commit if lint fixes needed**

```bash
git add -u
git commit -m "chore(recently): lint fixes"
```
