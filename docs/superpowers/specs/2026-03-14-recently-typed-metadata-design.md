# Recently Typed Metadata Design

## Summary

Extend the `RecentlyModel` to support typed content beyond plain Markdown text. Each recently entry can carry a `type` field and a strongly-typed `metadata` object, enabling rich content cards (books, media, music, GitHub repos, links, academic papers, code challenges) in the thinking page UI.

## Motivation

The current recently module only stores a `content: string` (Markdown). Users want to share structured content — a book they finished, a TV show, a song, a GitHub repo — with automatically fetched metadata rendered as rich cards.

## Design Decisions

1. **Type tag + metadata object** — chosen over pure-content (frontmatter in Markdown) and separate-collection approaches for flexibility without model sprawl.
2. **Strong-typed metadata per type** — Zod discriminated union validates metadata shape per type. Consistent with project's existing Zod validation patterns.
3. **Frontend-first data fetching** — Shiroi already has a link card plugin system with adapters (GitHub, TMDB, Bangumi, Netease Music, etc.). Frontend fetches metadata and submits to backend for storage. Backend metadata fetching to be added later.
4. **Single unified API** — `POST /recently` accepts `{ content, type?, metadata? }`. No separate resolve endpoint.
5. **Images as URLs only** — no upload support; metadata stores external image URLs.
6. **`content` optionality** — `type: 'text'` requires `content` (min 1 char). All other types allow `content` to be empty or omitted (user may share a card with no commentary).
7. **`ref`/`refType` coexistence** — no constraint between `ref`/`refType` (internal association) and `metadata` (external link data). They serve different purposes and may coexist freely.

## Data Model

### New Fields on RecentlyModel

```typescript
@prop({ type: String, enum: Object.values(RecentlyTypeEnum), default: RecentlyTypeEnum.Text })
type: RecentlyTypeEnum

@prop({ type: () => mongoose.Schema.Types.Mixed })
metadata?: RecentlyMetadata
```

### Type Enum

```typescript
enum RecentlyTypeEnum {
  Text = 'text',
  Book = 'book',
  Media = 'media',      // movies, TV shows, anime (TMDB, Bangumi)
  Music = 'music',       // songs (Netease, QQ Music)
  Github = 'github',     // repos, PRs, issues
  Link = 'link',         // generic OG-based link cards
  Academic = 'academic', // papers (arXiv)
  Code = 'code',         // coding challenges (LeetCode)
}
```

### Metadata Schemas (Zod)

```typescript
const BookMeta = z.object({
  url: z.string().url(),
  title: z.string(),
  author: z.string(),
  cover: z.string().url().optional(),
  rating: z.number().min(0).max(10).optional(),
  isbn: z.string().optional(),
})

const MediaMeta = z.object({
  url: z.string().url(),
  title: z.string(),
  originalTitle: z.string().optional(),
  cover: z.string().url().optional(),
  rating: z.number().min(0).max(10).optional(),
  description: z.string().optional(),
  genre: z.string().optional(),
})

const MusicMeta = z.object({
  url: z.string().url(),
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  cover: z.string().url().optional(),
  source: z.string().optional(),
})

const GithubMeta = z.object({
  url: z.string().url(),
  owner: z.string(),
  repo: z.string(),
  description: z.string().optional(),
  stars: z.number().optional(),
  language: z.string().optional(),
  languageColor: z.string().optional(),
})

const LinkMeta = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().url().optional(),
})

const AcademicMeta = z.object({
  url: z.string().url(),
  title: z.string(),
  authors: z.array(z.string()).optional(),
  arxivId: z.string().optional(),
})

const CodeMeta = z.object({
  url: z.string().url(),
  title: z.string(),
  difficulty: z.string().optional(),
  tags: z.array(z.string()).optional(),
  platform: z.string().optional(),
})
```

### Validation Strategy

Use `z.preprocess` to default `type` to `'text'` when omitted, then apply `z.discriminatedUnion`:

```typescript
const RecentlyInputSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object' && !val.type) {
      return { ...val, type: 'text' }
    }
    return val
  },
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('text'),
      content: z.string().min(1),
      ref: zMongoId.optional(),
      refType: z.string().optional(),
    }),
    z.object({
      type: z.literal('book'),
      content: z.string().optional().default(''),
      metadata: BookMeta,
      ref: zMongoId.optional(),
      refType: z.string().optional(),
    }),
    z.object({
      type: z.literal('media'),
      content: z.string().optional().default(''),
      metadata: MediaMeta,
      ref: zMongoId.optional(),
      refType: z.string().optional(),
    }),
    z.object({
      type: z.literal('music'),
      content: z.string().optional().default(''),
      metadata: MusicMeta,
      ref: zMongoId.optional(),
      refType: z.string().optional(),
    }),
    z.object({
      type: z.literal('github'),
      content: z.string().optional().default(''),
      metadata: GithubMeta,
      ref: zMongoId.optional(),
      refType: z.string().optional(),
    }),
    z.object({
      type: z.literal('link'),
      content: z.string().optional().default(''),
      metadata: LinkMeta,
      ref: zMongoId.optional(),
      refType: z.string().optional(),
    }),
    z.object({
      type: z.literal('academic'),
      content: z.string().optional().default(''),
      metadata: AcademicMeta,
      ref: zMongoId.optional(),
      refType: z.string().optional(),
    }),
    z.object({
      type: z.literal('code'),
      content: z.string().optional().default(''),
      metadata: CodeMeta,
      ref: zMongoId.optional(),
      refType: z.string().optional(),
    }),
  ]),
)
```

This ensures:
- `{ content: "hello" }` (no type) → preprocessed to `{ content: "hello", type: "text" }` → valid
- `{ type: "book", metadata: {...} }` (no content) → content defaults to `''` → valid
- `{ type: "text" }` (no content) → fails validation (content required for text)

## API Changes

### POST /recently (create)

Request body extended:

```json
{
  "content": "终于读完了这本书...",
  "type": "book",
  "metadata": {
    "url": "https://book.douban.com/subject/...",
    "title": "Designing Data-Intensive Applications",
    "author": "Martin Kleppmann",
    "cover": "https://...",
    "rating": 9.7
  },
  "ref": "optional-internal-ref-id",
  "refType": "optional-ref-type"
}
```

- `type` defaults to `'text'` when omitted (backward compatible via preprocess)
- `metadata` validated against the corresponding type's Zod schema
- `ref`/`refType` (internal resource association) coexists with `metadata` (external link data)

### PUT /recently/:id (update)

Uses the same `RecentlyInputSchema` for body validation. The controller must switch from `@Body() body: RecentlyModel` to the Zod DTO.

### GET responses

All GET endpoints return `type` and `metadata` in the response. Historical entries without `type` default to `'text'` via Mongoose default.

### WebSocket events

`RECENTLY_CREATE`, `RECENTLY_UPDATE`, `RECENTLY_DELETE` event payloads will naturally include `type` and `metadata` fields since the full document is emitted.

## Service Layer Changes

### `create()` method

Must pass `type` and `metadata` to `this.model.create()`:

```typescript
const res = await this.model.create({
  content: model.content,
  type: model.type,
  metadata: model.metadata,
  ref: model.refId as unknown as RecentlyModel['ref'],
  refType: model.refType,
})
```

### `update()` method

Must pass `type` and `metadata` in update payload:

```typescript
await this.model.updateOne(
  { _id: id },
  {
    content: body.content,
    type: body.type,
    metadata: body.metadata,
    modified: new Date(),
  },
)
```

## API Client Changes

### packages/api-client/models/recently.ts

```typescript
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

## Backward Compatibility

- No migration needed. Existing documents without `type` field are treated as `type: 'text'` via Mongoose default.
- All existing API consumers continue to work — `type` and `metadata` are additive fields.
- The `ref`/`refType` mechanism for internal resource association is preserved.
- Omitting `type` in POST body is handled by `z.preprocess`, defaulting to `'text'`.

## Testing

- Unit tests for each metadata Zod schema validation (valid and invalid inputs)
- Unit test: omitting `type` defaults to `'text'` (backward compat)
- Unit test: non-text types accept empty `content`
- E2E test: create recently with each type, verify stored metadata
- E2E test: create recently without type, verify defaults to 'text'
- E2E test: update recently type and metadata

## Future Work

- Backend metadata fetching: accept only URL, auto-resolve metadata via adapters (port from Shiroi's link card plugin system)
- MongoDB index on `type` field if filtering by type is needed
- Additional type support as needed
