# @mx-space/push-protocol

Versioned, privacy-preserving push protocol shared between [`apps/core`](../../apps/core) (mx-core server) and [`apps/push-relay`](../../apps/push-relay) (the independently deployed APNs relay). Both sides import this package so the wire format can never drift.

> [!NOTE]
> This package is private to the monorepo and consumed as TypeScript source via workspace exports.

## Contents

### Protocol (`src/protocol.ts`)

- **Event schemas** — CloudEvents 1.0-shaped Zod schemas. v1 projections carry resource identifiers only; comment text, author, email, IP address, and user agent never enter the protocol.
  - `comment.created.v1` — Space admin comment review (`resource_id`, `resource_type`)
  - `content.published.v1` — Yohaku reader content broadcast (`resource_id`, `resource_type`: `post` | `note` | `recently`)
  - `comment.replied.v1` — Yohaku reader reply routing (`resource_id`, `resource_type`, `recipient_reader_id` for signed fan-out; not an APNs display field)
- **Preferences** — strict `PushPreferencesSchema` (`content_post`, `content_note`, `content_recently`, `comment_replied`) and `DEFAULT_PUSH_PREFERENCES` (all `true`).
- **Relay DTOs** — registration, claim, and activation request/response schemas.
- **Authorization helpers** — Installation/Source authorization-header builders.

### Signature (`src/signature.ts`)

HMAC-SHA256 v1 request signatures over a canonical payload:

```
v1\n{timestamp}\n{delivery}\n{sha256(body)}
```

- Header-name constants (`PUSH_SIGNATURE_HEADERS`)
- `signPushRequest` / `verifyPushRequestSignature` with `timingSafeEqual` comparison
- 5-minute replay-window freshness check (`isPushTimestampFresh`)

## Usage

```ts
// apps/core — dispatching side
import {
  COMMENT_CREATED_EVENT,
  signPushRequest,
  sourceAuthorization,
} from '@mx-space/push-protocol'

// apps/push-relay — receiving side
import {
  PushEventSchema,
  RegisterInstallationSchema,
  verifyPushRequestSignature,
} from '@mx-space/push-protocol'
```

## Development

| Command | Description |
|---------|-------------|
| `pnpm test` | Run the vitest suite (strict privacy projection, sign/verify round-trip, freshness boundary) |
| `pnpm build` | Build with tsdown |
| `pnpm typecheck` | TypeScript type checking |
