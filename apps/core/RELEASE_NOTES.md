## TL;DR

Major AI subsystem rewrite on `@earendil-works/pi-ai`, plus a `Map` Lexical node, S3-backed uploads, and a redesigned admin comments inbox.

## Breaking Changes

- **AI agent conversations**: the `ai_agent_conversations` table is dropped and recreated with a session-scoped shape — `{ id, sessionId, model, providerId, messages, createdAt, updatedAt }`. Legacy columns (`refId`, `refType`, `title`, `reviewState`, `diffState`, `messageCount`) and existing rows are not preserved. The article-scoped "conversations for this post" admin UX is removed. **Migration**: run the bundled `mx-migrate` job as a pre-deploy step with both `mx-core` replicas stopped or in cutover; the admin agent chat endpoint (`/api/ai/agent/*`) is unavailable for the cutover window (≤ 5 minutes). No data path is provided to recover historical conversations.
- **AI provider type collapsed to three values**: `AIProviderType` now exposes only `OpenAICompatible`, `Anthropic`, `Generic`. Legacy `OpenAI` / `OpenRouter` rows in the jsonb config are rewritten to `openai-compatible` automatically. **Migration**: no action required for stored config; verify provider rows in the admin AI panel after deploy and confirm endpoints resolve to the expected pi `providerId` (openrouter.ai → openrouter, api.deepseek.com → deepseek, api.openai.com → openai, api.anthropic.com → anthropic).
- **`@mx-space/api-client` public surface trimmed**: `AiAgentSseEvent` is no longer exported from `@mx-space/api-client`. It moved to the new neutral `@mx-space/ai` workspace package, consumed directly by the admin. **Migration**: public consumers (Shiroi / Yohaku) are unaffected because the type was admin-only; bump `@mx-space/api-client` to 5.3.0 to pick up the trimmed type surface.

## Highlights

The AI runtime is now a single `PiRuntimeAdapter` over `@earendil-works/pi-ai`, replacing the previous OpenAI / Anthropic / ai-sdk stack. Retries, provider routing, and gateway prompt caching are delegated to pi's hosted layer. Structured output validation moved off Zod to TypeBox with byte-pinned regression coverage against the historical decisions, and a new `GET /api/ai/registry/models` endpoint feeds the admin model picker with provider-aware suggestions. Public SSE wire bytes (`/ai/summary`, `/ai/insights`, `/ai/translation`) are preserved exactly, including the cache-hit synthetic `done` frame.

Translation tasks now stream through a Redis-backed leader / follower with cross-pod fan-out: a `TaskQueueEmitter` throttles progress, a `RoomSubsService` heart-beats per-admin subscriptions, and `p-limit` caps concurrent strategy calls while abort cancels orphans cleanly. Cost forwarding flows through every layer — strategy, executor, summary and insights — and recomputes parent group totals on each emit, so admin dashboards see live spend without polling.

Content gains a new `Map` Lexical node with admin authoring affordances, and the helper service now backs file uploads with S3 instead of local disk. The admin `/comments` surface was rewritten end to end: tabbed inbox, R3 row layout, threaded reply stream, and a fresh meta sidebar. The shared `@mx-space/ai` package decouples server SSE contracts from `@mx-space/api-client`, removing a long-standing reverse dependency from admin onto the public client lib.

## Changes

### Features

- Map Lexical node with admin authoring + S3-backed file uploads. ([45b4a47](https://github.com/mx-space/core/commit/45b4a4760f76d8be008a6e0cbe055be27f6b6f24))
- AI runtime migrated to `@earendil-works/pi-ai`; legacy OpenAI / Anthropic / ai-sdk dependencies removed. (spec1 series)
- `ai_agent_conversations` rewritten as session-scoped pi schema with `streamMessage` accumulator + abort persistence. ([1189565](https://github.com/mx-space/core/commit/1189565c7419ff74c557ba96371ef7e4cfacd11e), [676041b](https://github.com/mx-space/core/commit/676041bf30b6dd00a0e8e93157e1bf860280b842))
- Admin agent chat SSE switched to JSON-frame protocol with monotonic `contentIndex`, 15s heartbeats, and reply-end guards. ([4f83662](https://github.com/mx-space/core/commit/4f836620fd94ca5e2458be4bf9a91f8405caa978))
- `GET /api/ai/registry/models` returns per-provider model metadata (context window, max tokens, cached-input pricing) with 5-minute SWR cache. ([815de31](https://github.com/mx-space/core/commit/815de31c45e8af6a759fc6787d0e3905faf41f87))
- AI provider type reduced to three values with jsonb config migration. ([501ff20](https://github.com/mx-space/core/commit/501ff207e14480706040c87af398003d973c51fd))
- Prompt schemas ported to TypeBox with byte-pinned regression fixture suite. ([98c44f3](https://github.com/mx-space/core/commit/98c44f3e3e28e0e626cc038b7103b8a3f1f7f37c), [aa126ce](https://github.com/mx-space/core/commit/aa126ce86c16c9d4e0d84b8ab45c0b66067fbaca))
- Translation task queue: `RoomSubsService` Redis-backed subscriptions, `TaskQueueEmitter` throttled progress, `streamPusher` + `TaskStreamBuffer`, `p-limit` concurrency, abort cancels orphans. (spec2 series)
- Cost forwarding through translation strategy, summary, and insights with parent-group recompute. ([ceaa49c](https://github.com/mx-space/core/commit/ceaa49c82), [bec39a0](https://github.com/mx-space/core/commit/bec39a088), [c922764](https://github.com/mx-space/core/commit/c92276417))
- AI agent conversation title generation + admin panel refactor. ([ccddc78](https://github.com/mx-space/core/commit/ccddc78432da776f128bdc89f7a907926130ab34))
- Admin `/comments` redesign — inbox tabs, R3 rows, thread stream, meta sidebar. ([9c2345b](https://github.com/mx-space/core/commit/9c2345bda3a5d700ebb32f0f2a6bfb9143b8ccfa))
- Admin URL-driven master-detail with iOS push nav stack. ([a5b9dff](https://github.com/mx-space/core/commit/a5b9dff3a40d450b253bfc00c814d1d5d7067954))
- `@mx-space/ai` package extracted for shared `AiAgentSseEvent` contracts. ([108ccd9](https://github.com/mx-space/core/commit/108ccd95d3830d155dfc6284abc3bd3d77c04fdf))

### Bug Fixes

- Inline `Value.Check` in `callWriterStreaming` done branch to prevent silent schema drift. ([587903e](https://github.com/mx-space/core/commit/587903ec90d845ad897a9eb6b5e4e7bac93bac61))
- Resolve stale conflict markers in migration journal. ([19e2517](https://github.com/mx-space/core/commit/19e25178357fa0f4921632312b80f655841749e0))

### Other

- Bump `@haklex/*` to 0.20.0 (rich-headless + litexml). ([8671d38](https://github.com/mx-space/core/commit/8671d38f4))
- Bump major deps: commander, ejs, inquirer, p-limit, testcontainers. ([5375d20](https://github.com/mx-space/core/commit/5375d2086))

## Upgrade Notes

1. **Run the pre-deploy migration with both replicas stopped.** `ai_agent_conversations` is dropped and recreated; a hot replica reading the old schema during cutover will crash. Use the `mx-migrate` Dokploy job; the app boot guard (`assertSchemaCurrent`) refuses to start if the schema is behind.
2. **Verify AI provider rows after deploy.** Open the admin AI provider drawer and confirm each row's endpoint resolves to the expected pi `providerId`. Legacy `OpenAI` / `OpenRouter` rows are rewritten automatically; if a row shows `generic` unexpectedly, set the endpoint hostname explicitly.
3. **S3 environment variables** are required if the new file-upload pipeline is enabled — configure `S3_*` env per the helper service before invoking uploads. Existing deployments without S3 configured retain the previous behaviour for unrelated paths but cannot accept new uploads.
4. **Admin agent chat sessions are reset.** Historical conversations are not migrated; instruct admin users that prior chat history is unavailable post-cutover. Title generation now happens client-side via `generateTitle()` and is not persisted on the conversation row.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.3.1...v13.4.0
