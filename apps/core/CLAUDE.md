# CLAUDE.md — apps/core

Guidance for Claude Code when working in the core backend app (`apps/core`)
inside the mx-core monorepo. This complements the repo-root `CLAUDE.md`; rules
there still apply (API response envelope, case-normalization, migration
authoring, etc.).

## AI Module — Pi runtime architecture

The AI subsystem (`apps/core/src/modules/ai/`) was migrated off `ai`/`openai`/
`@anthropic-ai/sdk` and onto `@earendil-works/pi-ai` in a single atomic PR.
The runtime, prompt-validation, and SSE-wire-format expectations below are
load-bearing — drifting any of them silently breaks Shiro/Yohaku consumers or
admin chat.

### Runtime — `modules/ai/runtime/`

- `pi-runtime.adapter.ts` is the **single** `IModelRuntime` implementation.
  No `OpenAICompatibleRuntime` / `AnthropicRuntime` / `withRetry` /
  `buildAiSdkDefaultHeaders` / `withGatewayPromptCache` survives — all routed
  through pi's hosted retry + provider-routing layer.
- `ai-provider.factory.ts` resolves a `pi providerId` from
  `AIProviderConfig.endpoint` hostname (openrouter.ai → `openrouter`,
  api.deepseek.com → `deepseek`, api.openai.com → `openai`,
  api.anthropic.com → `anthropic`), falling back by `type`
  (Anthropic → `anthropic`, OpenAICompatible → `openai`, Generic → `openai-compat`).
  Empty endpoint + Generic ⇒ Combobox disabled in admin (free-text mode).
- `AIProviderType` is a frozen 3-value enum after step-3a: `OpenAICompatible`,
  `Anthropic`, `Generic`. Legacy `OpenAI` / `OpenRouter` rows in jsonb config
  are rewritten to `openai-compatible` by the data migration; localStorage on
  the admin side is rewritten by `apps/admin/src/bootstrap/migrate-legacy-provider-type.ts`.
- `IModelRuntime.generateStructured<T extends TSchema>` takes a **TypeBox**
  schema — the legacy Zod overload was deleted in step-7. Call sites use
  `Value.Check` / `Value.Errors` instead of `schema.parse`.

### Prompts — `modules/ai/ai.prompts.ts`

- Every prompt schema is a TypeBox `Type.Object({...}, { additionalProperties: false })`.
- `ai-prompts-schema.regression.spec.ts` pins byte-identical pass/fail
  decisions against ~50 canned LLM outputs vs the historical Zod port. Do not
  add a schema without extending the fixture suite.
- Validation lint gate: every `validate: false` (passed into pi's
  structured-output call) MUST be paired with a `Value.Check(schema, value)`
  within 30 lines — checked by CI.

### Tool conversion — `json-schema-to-typebox.ts`

- Converts haklex `@haklex/document-tools` JSON-Schema tool definitions into
  TypeBox at runtime for chat tool-calls. Unsupported keywords degrade to
  `Type.Unsafe<unknown>({...rawSchema})` with a warn log — chat must NEVER
  crash on a tool schema it can't translate.

### SSE wire protocols

Two distinct SSE protocols live side-by-side; both are byte-pinned.

1. **Public streaming endpoints** (`/ai/summary`, `/ai/insights`,
   `/ai/translation`) — frame shape preserved from the pre-migration era:
   - `event: token\ndata: <raw-text>\n\n`
   - `event: done\n\n`
   - `event: error\ndata: <JSON.stringify({message})>\n\n`
   - Token frames carry **raw text strings**, NOT JSON. Cached-hydrate
     responses bypass `transformResponseCase` to keep wire bytes identical to
     a fresh stream; `@HTTPDecorators.RawResponse` opts the whole pipeline
     out of envelope + casing.
   - `incrementTokens` is called exactly once on `done`; aborts and errors
     never increment. Faux e2e fixtures live in `apps/core/test/fixtures/`.

2. **Admin agent chat** (`POST /ai/agent/chat`) — JSON-framed
   `AiAgentSseEvent` union, schema declared once in the neutral
   `@mx-space/ai` package (`packages/ai/src/ai-agent-sse.ts`, TypeBox) and
   imported by both the controller and `apps/admin`'s transport. The server
   imports the schema directly from `@mx-space/ai` (no reverse dependency on
   the client lib); `@mx-space/api-client` re-exports it for external
   consumers (Shiro/Yohaku). Drift fails tsc.
   - Frames: `text_start | text_delta | text_end | thinking_start |
     thinking_delta | thinking_end | toolcall_start | toolcall_delta |
     toolcall_end | done | error`. Each frame carries a monotonic
     `contentIndex` so the admin renderer can interleave blocks.
   - Wire format is one `data: <json>\n\n` line per event (no `event:` line).
   - 15-second heartbeat (`: ping\n\n`) prevents idle-proxy drops; cleared
     on stream end/abort.
   - Reply guard: every write checks `reply.raw.writableEnded` first.
     Fastify `request.raw.on('aborted')` mirrors `reply.raw.on('close')`.

### Inflight leader/follower — `modules/ai/ai-inflight/`

- `AiInFlightService` uses a Redis lock per `(feature, hash)` key. Leader
  produces token/done/error frames into a Redis Stream; followers attach via
  `XREAD BLOCK` and replay frames byte-identical to the leader's output.
- Stream entries are `type` + `data` fields where `data` is JSON-encoded.
  Error frames use `JSON.stringify({ message })`. Done frames carry
  `{ resultId }`. Token frames carry the raw string.
- Cache-hit path emits a single synthetic `done` event referencing the
  already-persisted `resultId`; admin chat hydrates without re-streaming.

### Conversations — `modules/ai/ai-agent/`

- `ai_agent_conversations` table was destructively rewritten in step-9 to
  `{ id, sessionId, model, providerId, messages, createdAt, updatedAt }`.
  The legacy columns `refId`, `refType`, `title`, `reviewState`,
  `diffState`, `messageCount` are gone; no migration data path exists.
- The article-scoped "conversations for this post" admin UX is removed.
  Titles are no longer persisted — clients call `generateTitle()` and store
  the result themselves.

### Model registry — `GET /api/ai/registry/models`

- New endpoint added in step-14. Returns `{ providerId, models: [{ id,
  contextWindow, maxTokens, cachedInputPerMillion }] }` (snake_case on the
  wire). 5-minute in-memory cache with stale-while-revalidate; `@Auth()`
  admin-only. Admin's `AIProviderDrawer` resolves Combobox suggestions from
  this endpoint and only shows `contextWindow` / `maxTokens` inputs when the
  selected model is NOT in the registry (case-insensitive trim match).

### Tests

- Faux suite (`test/src/modules/ai/*.faux.e2e.spec.ts`,
  `ai.controller.faux.e2e.spec.ts`) uses an in-process pi adapter stand-in.
  No real network. Run via `pnpm -C apps/core test`.
- Live suites (`*.live.e2e-spec.ts`) gated by `RUN_LIVE_TESTS=1` and the
  `SMOKE_*` env vars. Three modes — `test:live:local` (LM Studio @
  localhost:1234), `test:live:mix` (LMS + OpenRouter), `test:live:deepseek-mix`.
- Wire-byte assertions: `apps/core/test/fixtures/ai-agent-sse/*.json`
  contain canned frame fixtures. Any deviation = roll back; the wire IS the
  contract.

## See also

- Spec: `docs/superpowers/specs/2026-05-30-ai-sdk-migration-to-pi-design.md`
- Plan: `docs/superpowers/plans/2026-05-30-ai-sdk-migration-to-pi-implementation.md`
- Admin AI surface: `apps/admin/CLAUDE.md`
