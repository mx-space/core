# @mx-space/ai

Shared AI contracts for mx-space — the single source of truth for wire formats exchanged between the server ([`apps/core`](../../apps/core)) and its clients ([`apps/admin`](../../apps/admin)).

> [!NOTE]
> This package is private to the monorepo and consumed as TypeScript source via workspace exports.

## Contents

Currently the package contains one contract:

- **AI agent SSE events** (`src/ai-agent-sse.ts`) — a TypeBox union, `AiAgentSseEvent`, describing the server-sent event frames streamed by the AI agent: `text`, `thinking`, `toolcall`, `done`, and `error`. Exports `AiAgentSseEventSchema` (runtime validation) and the `AiAgentSseEvent` type.

## Usage

```ts
// apps/core — server emits JSON-framed SSE
import type { AiAgentSseEvent } from '@mx-space/ai'

// apps/admin — client transport parses the same union
import type { AiAgentSseEvent } from '@mx-space/ai'
```

Both sides import the same schema so neither defines the shape locally — a change here is a breaking change for server and client simultaneously, by design.

## Development

| Command | Description |
|---------|-------------|
| `pnpm build` | Build with tsdown (ESM + d.ts) |
| `pnpm typecheck` | TypeScript type checking |
