# Comment Reader Ref Design

## Summary

Refactor comment author identity to use `readerId` as the source of truth for logged-in commenters, including `owner`. Logged-in comments and replies should use explicit `reader` routes and accept only text/content fields at write time. Anonymous comments should use explicit `guest` routes, remain snapshot-based, and become gated by a new `allowGuestComment` setting.

This change also removes the comment `source` field from the active model. Historical comments that were originally posted by logged-in readers should be migrated by matching comment `mail + source` against Better Auth `readers + accounts` data. Before running that migration, the comments collection must be dumped to provide a regression baseline and rollback aid.

## Motivation

The current comment flow mixes anonymous and logged-in writes into the same endpoints, and the old owner-specific endpoints still route through legacy validation. This keeps redundant identity data in comments, makes the write API inconsistent for logged-in users, and prevents comment identity from reflecting later reader profile updates.

Using `readerId` directly for logged-in comments solves the model mismatch:
- logged-in `reader` and `owner` comments become dynamic identity references
- anonymous comments preserve their historical snapshot semantics
- legacy `source` becomes unnecessary after migration

## Design Decisions

1. Use existing `readerId` rather than introducing a new generic author reference model.
2. Keep anonymous comments as embedded snapshots rather than creating guest identity documents.
3. Treat `owner` exactly like any other logged-in reader for comment identity purposes.
4. Add `allowGuestComment` to gate all anonymous create and reply operations.
5. Require a pre-migration dump of the comments collection before any write migration runs.
6. For historical migration, only rewrite comments when `mail + source` resolves to exactly one reader; zero-match or multi-match records are skipped.
7. Replace mixed write endpoints with explicit guest and reader routes; remove owner-specific write routes.

## Data Model

### Comment Identity Rules

- Logged-in comments:
  - persist `readerId`
  - do not rely on stored `author`, `mail`, `avatar`, `url`, or `source` as identity truth
- Anonymous comments:
  - persist `author`, `mail`, optional `avatar`, optional `url`
  - have no `readerId`

### CommentModel Changes

- Remove `source` from active comment schema/model/DTOs.
- Keep `author`, `mail`, `avatar`, and `url` on the model for anonymous comments and legacy data compatibility.
- Continue storing `readerId` for reader-linked comments.

### Config Changes

Add `commentOptions.allowGuestComment: boolean` with default `true`.

Behavior:
- `true`: anonymous comments and replies remain allowed
- `false`: anonymous comments and replies are rejected
- logged-in `reader` and `owner` comments are always allowed unless `disableComment` blocks the whole site

## API Changes

### Write Routes

- Anonymous comment: `POST /comments/guest/:id`
- Anonymous reply: `POST /comments/guest/reply/:id`
- Logged-in comment: `POST /comments/reader/:id`
- Logged-in reply: `POST /comments/reader/reply/:id`

Remove or fully retire:
- `POST /comments/:id`
- `POST /comments/reply/:id`
- `POST /comments/owner/comment/:id`
- `POST /comments/owner/reply/:id`

### Logged-in Create/Reply Input

`/comments/reader/*` accepts only content fields:

```ts
{
  text: string
  isWhispers?: boolean
  anchor?: CommentAnchorInput
}
```

Replies omit `anchor` if the current API keeps that restriction.

### Anonymous Create/Reply Input

`/comments/guest/*` continues to require:

```ts
{
  author: string
  mail: string
  text: string
  url?: string
  avatar?: string
  isWhispers?: boolean
  anchor?: CommentAnchorInput
}
```

If `allowGuestComment` is `false`, `/comments/guest/*` requests fail before anonymous DTO validation is used for persistence.

## Request Handling

### Controller

Controller write handling should become route-based instead of context-splitting within a single endpoint:

- `/comments/guest/:id` and `/comments/guest/reply/:id`
  - validate with anonymous DTO
  - reject when `allowGuestComment` is `false`
  - keep anonymous-only checks such as owner-name conflict validation
- `/comments/reader/:id` and `/comments/reader/reply/:id`
  - require a valid logged-in reader or owner context
  - validate with logged-in DTO
  - never require `author` or `mail`
- owner comments should use the same reader routes rather than dedicated owner-only endpoints

### Service

`assignReaderToComment` should stop copying `author/mail/avatar` from reader data into the comment payload. Its job becomes:
- resolve `readerId`
- verify the reader exists
- return reader metadata for response assembly if needed

Create/reply persistence should write `readerId` for logged-in users and should not write `source`.

## Response Assembly

Comment reads should prefer dynamic reader identity when `readerId` is present:

- attach `reader` payload to comment responses as today
- derive display-facing `author`, `avatar`, and any reader-backed URL from the linked reader/owner profile at read time
- fall back to stored comment snapshot fields only when `readerId` is absent

This preserves compatibility for consumers that still expect `author/avatar` while allowing profile updates to reflect on logged-in comments.

## Migration

### Precondition: Dump Comments Collection

Before migration runs, dump the full comments collection. This dump is required for:
- regression comparison after migration
- rollback support if matching logic produces unexpected results
- sampling unmatched records for manual verification

The implementation plan should include an explicit command and output path for this dump.

### Historical Reader Linking

Migration scans comments where:
- `readerId` is missing
- `mail` exists
- `source` exists

For each candidate comment:
1. find readers with `readers.email == comment.mail`
2. join matching `accounts` by `accounts.userId == readers._id`
3. keep only matches where `accounts.provider == comment.source` or `accounts.providerId == comment.source`

Outcomes:
- exactly 1 match:
  - set `readerId`
  - unset `author`, `mail`, `avatar`, `url`, `source`
- 0 matches:
  - skip
- more than 1 match:
  - skip

Comments that already have `readerId` are ignored.

### Safety Rules

- Migration must be idempotent.
- Migration must not rewrite anonymous comments without a unique reader match.
- Migration must not remove anonymous snapshot fields from unmatched comments.

## Backward Compatibility

- Historical anonymous comments remain readable with existing snapshot data.
- Historical logged-in comments that cannot be matched remain unchanged.
- Existing consumers that expect `author/avatar` continue to work if response assembly fills those fields from `reader` when available.

## Testing

### Comment Write Behavior

- `POST /comments/reader/:id` accepts text-only payload
- `POST /comments/reader/reply/:id` accepts text-only payload
- logged-in owner uses the same `reader` routes with text-only payload
- `POST /comments/guest/:id` and `/comments/guest/reply/:id` succeed when `allowGuestComment=true`
- `POST /comments/guest/:id` and `/comments/guest/reply/:id` fail when `allowGuestComment=false`

### Identity Read Behavior

- comments with `readerId` expose dynamic reader-backed identity
- comments without `readerId` expose stored snapshot identity

### Migration

- unique `mail + source` match writes `readerId` and unsets redundant fields
- zero match skips without mutation
- multi match skips without mutation
- existing `readerId` comments are untouched
- migration remains safe for mixed string/ObjectId user references where applicable
