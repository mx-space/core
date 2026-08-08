# @mx-space/db-schema

Central Drizzle ORM schema and ID layer for mx-space. Single source of truth for table definitions, the branded `EntityId` type, and the Snowflake ID generator used across the monorepo.

> [!NOTE]
> This package is private to the monorepo and consumed as TypeScript source via workspace exports.

## Exports

| Subpath | Contents |
|---------|----------|
| `@mx-space/db-schema` | Everything: schema + ID layer + `CollectionRefTypes` |
| `@mx-space/db-schema/schema` | All Drizzle table definitions |
| `@mx-space/db-schema/id` | `EntityId`, validators, `SnowflakeGenerator`, `resolveSnowflakeWorkerId` |

## Schema Modules

~50 tables organized by domain (`src/schema/`):

| Module | Tables |
|--------|--------|
| `content` | `posts`, `notes`, `pages`, `categories`, `topics`, `comments`, `drafts`, `draftHistories`, `recentlies`, `postRelatedPosts` |
| `auth` | `readers`, `ownerProfiles`, `accounts`, `sessions`, `apiKeys`, `passkeys`, `verifications`, `deviceCodes` (Better Auth; camelCase columns kept on purpose) |
| `ai` | `aiTranslations`, `translationEntries`, `aiSummaries`, `aiInsights`, `aiAgentConversations`, `aiTts`, `aiTtsBlocks`, `aiGenerationMetrics` |
| `ops` | `options`, `activities`, `analyzes`, `links`, `projects`, `says`, `snippets`, `subscribes`, `fileReferences`, `fileUsages`, `webhooks`, `webhookEvents`, `serverlessStorages`, `serverlessLogs`, `slugTrackers`, `pollVotes`, `pollVoteOptions`, `metaPresets` |
| `billing` | `memberships`, `billingWebhookEvents` (idempotency via provider + event_id unique) |
| `companion` | `companionDevices`, `companionPairings` — device IDs are public protocol IDs (UUID/ULID), not Snowflake EntityIds |
| `enrichment` | `enrichmentCache`, `enrichmentCaptures` |
| `push` | `pushRelaySources`, `pushRelayBindings`, `pushRelayDeliveries` |
| `search` | `searchDocuments` (per-ref + per-lang term-frequency store) |
| `migration` | `appMigrations`, `schemaMigrations`, `mongoIdMap`, `authIdMap`, `dataMigrationRuns` — migration-only, not for business queries |

## ID Layer

- **`EntityId`** — branded Snowflake decimal string. Validators: `isEntityIdString`, `parse`, `tryParse`, `serialize`; Zod schemas `zEntityId` / `zEntityIdOrInt`. Max value 2^63 − 1.
- **`SnowflakeGenerator`** — pure generator: 41-bit timestamp (custom epoch `1746144000000`), 10-bit worker, 12-bit sequence, with clock-drift guards.
- **`resolveSnowflakeWorkerId`** — resolves the worker ID from the configured base plus `SNOWFLAKE_WORKER_OFFSET`, with a PM2 fallback.

## Usage

```ts
// apps/core — the whole table surface in one line
export * from '@mx-space/db-schema/schema'

// ID generation (wrapped by apps/core's Nest SnowflakeService)
import { resolveSnowflakeWorkerId, SnowflakeGenerator } from '@mx-space/db-schema/id'

// api-client — polymorphic ref enum
import { CollectionRefTypes } from '@mx-space/db-schema'
```

## Development

| Command | Description |
|---------|-------------|
| `pnpm build` | Build with tsdown (three entries: index, schema, id) |
| `pnpm typecheck` | TypeScript type checking |
