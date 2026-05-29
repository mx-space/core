# AI SDK Migration to @earendil-works/pi-ai — Design

Date: 2026-05-30
Status: Approved (post-scoping pass)
Owner: Innei
Scope: apps/core (mx-core backend), apps/admin (admin SPA — AI provider form + chat UI), packages/db-schema (shared Drizzle schemas)
Scoping report: 6-agent workflow at wf_23f2d17e-176 (2026-05-30) — 53 files, 20 ordered steps

## Summary

Replace the self-rolled AI runtime layer in `apps/core/src/modules/ai/runtime/`
(OpenAI SDK + Anthropic SDK direct calls behind a custom `IModelRuntime`
interface) with a single `PiRuntimeAdapter` backed by
`@earendil-works/pi-ai`. The migration unlocks partial-JSON tool call
streaming, cross-provider cost tracking, unified cache control, context
overflow detection, and a faux provider for fast hermetic tests — all of
which the current runtime lacks. The migration is a big-bang cut in a
single PR; downstream UI/feature work (lexical streaming UI, task queue
realtime push, admin cost display) lands in spec 2.

The `IModelRuntime` interface is kept so that ai/ module callers
(translation strategies, summary/insights/writer services, ai-agent
chat) require minimal call-site changes. The adapter expands the
interface with two new entry points (`streamStructured`, `streamMessage`)
to surface pi-ai's richer event stream where the existing surface is
insufficient.

## Motivation

The current runtime layer is a thin wrapper over `openai` and
`@anthropic-ai/sdk` direct clients (`OpenAICompatibleRuntime` ≈ 340
lines, `AnthropicRuntime` ≈ 250 lines), with `generateStructured`
implemented as a hand-rolled tool-call trick and `generateTextStream`
yielding bare `{ text }` chunks. The runtime:

- Has no partial JSON tool call streaming → blocks lexical translation
  from showing per-segment progress in the admin UI.
- Has no cost tracking — only token counts via `incrementTokens` Redis
  HINCRBY.
- Has no cross-provider cache-control abstraction; mx relies on
  provider-specific HTTP header tweaks (`buildAiSdkDefaultHeaders` +
  vercel-gateway-only `withGatewayPromptCache`).
- Has no context overflow detection; an oversized lexical doc retries
  blindly under `withRetry`.
- Is awkward to test offline — the live test suites
  (`test:live:local` / `test:live:mix` / `test:live:deepseek-mix`)
  need real API keys and do not run in CI.

`@earendil-works/pi-ai` (v0.77.0, MIT, Node ≥ 22.19, ESM-only, daily
commits, 57k stars on the parent `pi` monorepo) supplies all four
capabilities first-class and exposes 17 providers under a single
`stream(model, context, options)` / `complete(...)` surface with a
typed `AssistantMessageEventStream`. mx-core already meets every
prerequisite (`"type": "module"` in `apps/core/package.json`, Node 22
target).

## Non-Goals

These follow in subsequent specs and are explicitly excluded here:

- Lexical translation partial-JSON streaming UI (admin per-segment
  typewriter) — spec 2.
- Task queue realtime push, concurrent multi-language translation,
  sub-task tree visualisation — spec 2.
- Persisting `usage.cost` totals in the database and rendering them in
  admin lists or task detail pages — spec 2.
- Cross-provider cache-control rollout on the translation/summary/
  insights call sites — spec 2 (the adapter exposes the option,
  callers opt in later).
- Migrating business-side Zod schemas (DTOs, response views, validation
  pipe, repository row types) to TypeBox — out of scope; potential
  future spec 3.
- Adopting `@earendil-works/pi-agent-core` for stateful agent
  workflows — out of scope; mx has its own task queue.
- Image generation, Codex/Copilot OAuth providers — not used today,
  not added.

## Architecture

```
business caller
  (ai-translation / ai-summary / ai-insights / ai-writer / ai-agent)
        │
        ▼  IModelRuntime (kept; expanded)
        │   • generateText
        │   • generateStructured<TSchema extends TSchema>(schema, ...)   // TypeBox
        │   • generateTextStream
        │   • streamStructured     // NEW — emits { partial, delta, done? }
        │   • streamMessage        // NEW — emits pi AssistantMessageEvent
        ▼
PiRuntimeAdapter (new, replaces OpenAICompatibleRuntime + AnthropicRuntime)
        │
        ├─ Model resolve: pi getModel hit → Model<Api>; miss → custom Model literal
        ├─ Event translation: pi AssistantMessageEvent → TextStreamChunk (legacy path)
        └─ Cost capture: usage.cost passthrough
        ▼
@earendil-works/pi-ai
        │
        └─ stream / complete / streamSimple / completeSimple
                │
                ▼
        17 providers (only openai-completions + anthropic-messages activated by mx)
```

### Interface changes on `IModelRuntime`

```ts
import type { TSchema, Static } from '@earendil-works/pi-ai'; // re-export of typebox

export interface IModelRuntime {
  readonly providerInfo: RuntimeProviderInfo;

  generateText: (options: GenerateTextOptions) => Promise<GenerateTextResult>;
  generateTextStream?: (
    options: GenerateTextStreamOptions,
  ) => AsyncIterable<TextStreamChunk>;

  // signature change: Zod → TypeBox
  generateStructured: <T extends TSchema>(
    options: GenerateStructuredOptions<T>,
  ) => Promise<GenerateStructuredResult<Static<T>>>;

  // NEW: progressive partial-JSON tool call streaming
  streamStructured?: <T extends TSchema>(
    options: GenerateStructuredOptions<T>,
  ) => AsyncIterable<{
    partial: Partial<Static<T>>;
    delta?: string;
    done?: boolean;
    final?: Static<T>;
  }>;

  // NEW: pi-native event stream for ai-agent SSE
  streamMessage?: (options: StreamMessageOptions) => AssistantMessageEventStream;

  listModels?: () => Promise<ModelInfo[]>;
}
```

`streamStructured` and `streamMessage` are defined in spec 1 but only
`streamMessage` is wired up (ai-agent). `streamStructured` is reserved
for spec 2 (lexical translation UI) — it lives in the interface so
spec 2 can land additively without touching the adapter again.

### `PiRuntimeAdapter` internals

Responsibilities:

1. **Model resolve** — Given `(providerType, endpoint, apiKey, modelId,
   contextWindow?, maxTokens?)` produce a pi `Model<Api>`:
   - Map mx `AIProviderType` to a pi API key:
     - `OpenAICompatible` → `openai-completions`
     - `Anthropic` → `anthropic-messages`
     - `Generic` → `openai-completions` (escape hatch; behaves
       identically to `OpenAICompatible` at the adapter level —
       differentiated only in the admin form).
   - Derive pi `providerId` from endpoint hostname (e.g.
     `openrouter.ai` → `openrouter`, `api.deepseek.com` → `deepseek`).
   - Try `getModel(providerId, modelId)`. On hit, use the registry
     entry verbatim. On miss, build a custom `Model<Api>` literal with
     zero costs, `contextWindow` from admin (default 128_000),
     `maxTokens` from admin (default 8192), and `compat: undefined`
     so pi auto-detects from the `baseUrl`.
2. **`generateText`** — Build a single-turn `Context` (one user
   message), call `complete(model, context, { temperature, maxTokens,
   maxRetries, signal })`. Return `{ text, usage }` shaped as today.
3. **`generateStructured`** — Wrap the input TypeBox schema as a pi
   `Tool` whose `parameters` is the schema, with a hard-coded tool
   name `structured_output`. Force the model to call the tool via the
   provider's tool-choice mechanism (pi delegates this; the
   openai-completions adapter inside pi already supports it through
   the same trick mx uses today). Loop on intermediate thinking
   responses up to `maxIterations = 5`, identical to the current
   safeguard. **Accept an optional `validate: boolean` (default `true`)
   on the options.** When `validate: false`, the adapter skips
   `validateToolCall` and returns the raw `arguments` object so
   callers that need to post-process before validation (e.g.
   `base-translation-strategy.callWriter` which runs
   `normalizeChunkTranslationResponse` before its own `schema.parse`)
   can preserve their existing pipeline. Return
   `{ output: parsed, usage }`.
4. **`generateTextStream`** — Call pi `stream(...)`, consume only the
   `text_delta` events, yield `{ text: event.delta }`. Surface
   `error` events as thrown errors with the original `errorMessage`.
   Preserve the existing dev-only `console.debug` log line.
5. **`streamMessage`** — Call pi `stream(...)`, return its
   `AssistantMessageEventStream` verbatim. Used by `AiAgentChatService`.
6. **`streamStructured`** — Reserved (throws "not yet wired" until
   spec 2 enables it). Defined now so that the interface is stable.
7. **Cost capture** — Every adapter method that has a `usage` result
   exposes `usage.cost.total` on the returned object. Callers may
   ignore it today; spec 2 picks it up.
8. **Retries** — Use pi's `maxRetries` option; remove the custom
   `withRetry` from `BaseRuntime` (delete the file).
9. **Abort / overflow** — Pass `signal` through; surface aborted
   messages via the standard event-stream `{ type: 'error', reason:
   'aborted' }` path. Adapter exposes `isContextOverflow(message,
   contextWindow)` (re-exported from pi) for callers that need it
   (no caller wires it up in spec 1).

### Provider config

`AIProviderType` enum is reduced from 4 values to 3:

```ts
enum AIProviderType {
  OpenAICompatible = 'openai-compatible',
  Anthropic = 'anthropic',
  Generic = 'generic',
}
```

mx-core retains the existing `aiProvider` table columns
(`providerType`, `endpoint`, `apiKey`, `model`). The migration:

- Adds two nullable columns: `contextWindow int`, `maxTokens int`.
- Adds one `UPDATE` in the migration body collapsing existing
  `OpenAI` and `OpenRouter` enum values into `OpenAICompatible`
  (`OpenAI` keeps the default OpenAI endpoint, `OpenRouter` keeps the
  OpenRouter endpoint).
- Generic stays as a reserved future expansion slot (no caller
  surface today).

Admin form changes (`apps/admin` AI settings view):

- `providerType` select shows the 3 simplified options.
- `model` field renders the pi registry as a `Combobox`:
  `getModels(piProviderId)` for the dropdown, with a free-text fallback
  for unknown models.
- `contextWindow` / `maxTokens` numeric inputs appear only when the
  selected `model` misses the pi registry. If the model is in the
  registry, the registry-supplied values are shown read-only.

### ai-agent chat SSE protocol

The controller (`apps/core/src/modules/ai/ai-agent/ai-agent.controller.ts`)
emits a richer event protocol over `text/event-stream`. Frame format
remains `data: {json}\n\n` per SSE spec.

```ts
type AiAgentSseEvent =
  | { type: 'text_start';     contentIndex: number }
  | { type: 'text_delta';     contentIndex: number; delta: string }
  | { type: 'text_end';       contentIndex: number }
  | { type: 'thinking_start'; contentIndex: number }
  | { type: 'thinking_delta'; contentIndex: number; delta: string }
  | { type: 'thinking_end';   contentIndex: number }
  | { type: 'toolcall_start'; contentIndex: number; name?: string }
  | { type: 'toolcall_delta'; contentIndex: number; partialArgs: Record<string, unknown> }
  | { type: 'toolcall_end';   contentIndex: number; toolCall: { id: string; name: string; arguments: Record<string, unknown> } }
  | { type: 'done';           message: AssistantMessage }
  | { type: 'error';          reason: 'error' | 'aborted'; message: string };
```

Front-end consumes the events by `contentIndex` (pi can interleave
text/thinking/toolcall blocks). Each block is rendered as it streams.

The admin chat UI (`apps/admin/src/features/ai/` agent route) gains
three components:

- `ThinkingBlock` — collapsed by default, labelled
  `Thought for {duration}s`; expands to a monospace pre that
  accumulates `thinking_delta`.
- `ToolCallCard` — card showing `name`, partial JSON arguments
  (JSON5-highlighted, updates on every `toolcall_delta`), finalised
  arguments after `toolcall_end`.
- `MessageBubble` — refactored to render a list of blocks instead of a
  single text body. Each block is keyed by `contentIndex`.

`TypingIndicator` updates to a context-aware status: `Thinking…` while
a `thinking_*` block is open, `Calling {toolName}…` while a
`toolcall_*` block is open, default dots when only a `text_*` block
is open.

### `ai_agent_conversations` schema

Existing data is dropped (approved). The replacement schema stores
pi-native `Message[]`, with `model` and `provider_id` retained as
explicit columns so the existing `generateTitle` flow (which reads
the conversation's `model`/`providerId`) continues to work
unchanged:

```sql
DROP TABLE ai_agent_conversations;

CREATE TABLE ai_agent_conversations (
  id           BIGINT PRIMARY KEY,
  session_id   VARCHAR     NOT NULL,
  model        VARCHAR,
  provider_id  VARCHAR,
  messages     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_agent_conversation_session_idx
  ON ai_agent_conversations (session_id);
```

`messages` stores the pi union `(UserMessage | AssistantMessage |
ToolResultMessage)[]` directly. Continuation requests deserialize the
column and pass the array as `Context.messages` to pi without
transformation.

The removed columns (`ref_id`, `ref_type`, `title`, `review_state`,
`diff_state`, `message_count`) are dropped outright. The
corresponding `@OnEvent(POST_DELETE | NOTE_DELETE | PAGE_DELETE)`
cascade in `ai-agent-conversation.service.ts` is removed in the same
PR. Orphan conversations after an article delete are accepted as a
known data debt; a follow-up `ref_links(refType, refId, sessionId)`
join table may be added later if cascade semantics are needed
again.

Because the new and old schemas are incompatible and rolling
deploys run two replicas briefly, mx-core's admin chat endpoint
becomes unavailable for the duration of the cutover (≤ 5 minutes,
acceptable per discussion).

### `ai-inflight` integration

`AiInFlightService` currently streams `AiStreamEvent` (`token | done |
error`) through a Redis Stream (XADD/XREAD) for the public-site SSE
leader/follower pattern. The leader hook now sources events from pi
via `streamMessage` and maps `text_delta` to `{ type: 'token', data:
event.delta }`; the `done` and `error` envelopes are unchanged so
follower-side parsing keeps working.

### TypeBox schema rewrite scope

All Zod schemas that flow into `generateStructured` are rewritten as
TypeBox. The list is bounded:

- `apps/core/src/modules/ai/ai.prompts.ts` — 11 schemas confirmed by
  the scoping pass:
  - `summary` (L323)
  - `writer.titleAndSlug` (L409)
  - `writer.slug` (L439)
  - `comment.score` (L456)
  - `comment.spam` (L474)
  - `translationChunk` (L559, factory `buildTranslationChunkSchema`
    — preserve dynamic key shape, with explicit
    `additionalProperties: false` on both outer `translations`
    object and every inner group)
  - `translationReviewer` (L204)
  - `translationEditor` (L230)
  - `fieldTranslation` (L619)
  - `insights` (also referenced from `ai-insights.service.ts`)
  - `translation` (L502) — **first verify whether any caller of
    `AI_PROMPTS.translation.schema` exists. The scoping pass
    flagged it as likely dead code (only the streamText path
    consumes the prompt; the schema is unreferenced). Drop instead
    of port if no caller survives.**

Result-side validation moves from `schema.parse(raw)` to pi's
`validateToolCall(tools, toolCall)` for tool-call shaped outputs. The
adapter constructs the tool internally so callers do not see the
tool-call indirection; they receive the validated, typed `Static<T>`
value as today.

**Exception — `callWriter` / `callEditor` in
`base-translation-strategy.ts`.** Those two call sites run
`normalizeChunkTranslationResponse` (or its editor equivalent) on
`result.output` and then call `schema.parse(normalised)` themselves.
Because the model raw output frequently fails strict validation
before normalisation (and normalisation is what makes it valid),
those callers pass `validate: false` to the adapter, receive the raw
tool-call arguments, run normalisation, and then validate using the
TypeBox schema directly via pi's `validateToolCall` helper (or
inline TypeBox `Value.Check` if the helper is too tool-specific).
All other callers use the default `validate: true` path.

Every other Zod usage in `ai/` (DTOs, response views, repository row
types, internal type helpers) stays Zod. The 104 Zod imports are not
all migrated — only the ~10 prompt schemas.

## Testing Strategy

Two layers:

1. **Faux-based tests (new, CI-mandatory).** Uses pi's
   `registerFauxProvider` from `apps/core/test/helper/faux-ai.helper.ts`
   (new). The helper exposes `withFauxAi(setup)` that returns a faux
   provider registration plus a teardown. Coverage:
   - `PiRuntimeAdapter` unit tests: `generateText`,
     `generateStructured`, `generateTextStream`, `streamMessage`,
     model resolve hit vs miss, cost capture, abort propagation.
   - `ai-translation` faux e2e: markdown strategy happy path,
     lexical strategy happy path with the existing
     `normalizeChunkTranslationResponse` post-processing path.
   - `ai-summary` / `ai-insights` / `ai-writer` faux e2e: one happy
     path each, covering `onToken` token-counting + `incrementTokens`
     side effects.
   - `ai-agent` SSE faux e2e: text + thinking + toolcall happy path,
     plus an aborted-mid-stream path producing a stored partial
     assistant message.
2. **Live tests (kept).** The existing `RUN_LIVE_TESTS=1` scripts
   (`test:live:local`, `test:live:mix`, `test:live:deepseek-mix`)
   run against real providers. They become the regression net for pi
   version upgrades and provider behaviour drift.

The live suites are not run in CI (require secrets); the faux suite
becomes the CI gate.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| pi's `compat` auto-detect misses a third-party OpenAI-compatible endpoint mx-core users rely on | Surface a `compat` override JSON field in the admin form; admin can set the pi `OpenAICompletionsCompat` flags explicitly. |
| TypeBox schema rewrite drops a Zod-only refinement (`.refine`, `.transform`) | Audit each migrated schema by comparing input/output samples from existing live test snapshots; add TypeBox `Hooks` or pre/post `Value.Convert` where needed. |
| ai-agent chat unavailable during rolling-deploy cutover (drop+create schema) | Communicate maintenance window in advance; window is bounded by the Drizzle migration release-phase runtime (well under 5 min). |
| pi maintainer bus factor (single maintainer) | MIT licensed; mirror `@earendil-works/pi-ai` source as a git submodule fallback inside `apps/core/vendor/pi-ai/` (not bundled by default — only used if the npm package becomes unmaintained). |
| Bundle / dep weight (pi pulls `@aws-sdk/client-bedrock-runtime`, `@google/genai`, `@mistralai/mistralai`) | mx-core runs as a server process without bundling; the extra ≈ 30 MB on disk is acceptable. |
| Pi version churn (0.x, breaking changes possible) | Pin exact version in `package.json`; bumps land in their own PRs with the faux + live suites green. |

## Implementation Plan (one PR)

1. Add dep: `pnpm -C apps/core add @earendil-works/pi-ai`.
2. Update `IModelRuntime` (`runtime/model-runtime.interface.ts`):
   change `generateStructured` schema generic to TypeBox; add
   optional `streamStructured` and `streamMessage` signatures.
3. Implement `PiRuntimeAdapter`
   (`runtime/pi-runtime.adapter.ts` — new file). Cover all paths in
   the Architecture section. Inline the model-resolve helper.
4. Update `RuntimeFactory` to construct `PiRuntimeAdapter` for all
   three enum values. `OpenAICompatible` maps to
   `openai-completions` API; `Anthropic` maps to `anthropic-messages`;
   `Generic` also maps to `openai-completions` (it is an escape
   hatch for users on OpenAI-compatible endpoints that mx does not
   want to advertise on the main path — e.g. niche self-hosted
   gateways). No caller surface in spec 1 actively selects
   `Generic`; the value exists for forward compatibility and admin
   UI clarity.
5. Reduce `AIProviderType` enum to three values.
6. Delete `runtime/openai-compatible.runtime.ts`,
   `runtime/anthropic.runtime.ts`, `runtime/base.runtime.ts`,
   `runtime/ai-sdk-attribution.ts`. Update `runtime/index.ts`
   exports. Remove `openai` and `@anthropic-ai/sdk` from
   `apps/core/package.json`.
7. Rewrite `apps/core/src/modules/ai/ai.prompts.ts` `.schema` fields
   as TypeBox (≈ 11 schemas, see list above). Update call sites in:
   - `apps/core/src/modules/ai/ai-translation/strategies/base-translation-strategy.ts`
     (callWriter / callEditor — pass `validate: false`, keep
     normalisation pipeline)
   - `apps/core/src/modules/ai/ai-translation/strategies/markdown-translation.strategy.ts`
   - `apps/core/src/modules/ai/ai-translation/translation-entry.service.ts`
     (field translation paths — no `signal` today, must remain
     optional)
   - `apps/core/src/modules/ai/ai-translation/reviewer.service.ts`
   - `apps/core/src/modules/ai/ai-summary/ai-summary.service.ts`
   - `apps/core/src/modules/ai/ai-insights/ai-insights.service.ts`
   - `apps/core/src/modules/ai/ai-insights/ai-insights-translation.service.ts`
   - `apps/core/src/modules/ai/ai-writer/ai-writer.service.ts`
   - `apps/core/src/modules/ai/ai.controller.ts`
     (test endpoints — must honour `maxRetries: 0`)
   - **`apps/core/src/modules/comment/comment.spam-filter.ts`**
     (consumes `AI_PROMPTS.comment.{score,spam}` from outside the
     ai/ module — easy to miss; the scoping pass flagged it)
8. Migrate `AiAgentChatService` to call `streamMessage`. Update
   `ai-agent.controller.ts` to emit the new SSE event protocol.
   **Critical:** wire `reply.raw.on('close', () => controller.abort())`
   and pass the controller signal into `streamChat(...)` so a
   disconnected admin client stops pi from consuming further
   provider tokens. Add a JSON-Schema → TypeBox conversion shim at
   the chat service boundary (`ChatProxyDto.tools.parameters` is
   loose JSON Schema today; pi's `Tool.parameters` requires
   TypeBox).
9. Drop+recreate `ai_agent_conversations` table via a Drizzle SQL
   migration (`apps/core/src/database/migrations/`); the table is
   defined in `packages/db-schema/src/schema/ai.ts`. Update
   `ai-agent-conversation.repository.ts`,
   `ai-agent-conversation.service.ts`,
   `ai-agent-conversation.types.ts`, and `ai-agent.schema.ts` to
   the new `{id, sessionId, model, providerId, messages, timestamps}`
   shape (model/providerId retained for `generateTitle`). Remove the
   `@OnEvent(POST_DELETE | NOTE_DELETE | PAGE_DELETE)` cascade and
   the `listByRef` / `deleteForRef` methods; rename `list()` to
   `listBySession()`. Audit `packages/mongo-pg-cli/src/steps.ts` for
   stale references and update or remove.
10. Wire `AiInFlightService` to source events from pi
    `streamMessage`; map `text_delta` to legacy
    `{ type: 'token' }` stream events; keep `done` / `error`
    envelopes for follower compatibility.
11. Update admin AI settings form
    (`apps/admin/src/features/settings/components/ai/` —
    `AIConfigEditor.tsx`, `AIProviderDrawer.tsx`,
    `apps/admin/src/features/settings/types/settings.ts`,
    `apps/admin/src/features/settings/constants.ts`,
    `apps/admin/src/features/settings/utils/settings.ts`,
    `apps/admin/src/api/ai.ts`): collapse providerType select to 3
    options, add pi model registry combobox sourced from a new
    `GET /api/ai/registry/models?providerId=...` endpoint
    (server-mediated so version drift between admin and pi can be
    centrally controlled), conditionally show `contextWindow` /
    `maxTokens` inputs only on registry-miss.
12. Add `ThinkingBlock`, `ToolCallCard`, context-aware
    `TypingIndicator`; refactor `MessageBubble` to multi-block
    rendering in admin chat UI under
    `apps/admin/src/features/write/components/agent/` (not
    `features/ai/`; the original spec brief had the dir wrong).
    Also rewrite `agent-transport.ts` — bypass
    `@haklex/rich-agent-core`'s `TransportAdapter` and consume the
    new `AiAgentSseEvent` JSON frames directly so the admin can
    render thinking / tool-call blocks without re-synthesising
    OpenAI/Anthropic SSE shapes. Update
    `apps/admin/src/api/ai-agent.ts`,
    `apps/admin/src/hooks/use-agent-session-manager.ts`, and
    TanStack Query consumers under
    `apps/admin/src/features/write/` for the new conversation
    shape (sessionId, model, providerId, messages).
13. Add `apps/core/test/helper/faux-ai.helper.ts`. Author the
    faux-based test suites described in Testing Strategy.
    Additionally:
    - Delete `apps/core/test/src/modules/ai/openai-compatible.runtime.spec.ts`.
    - Rewrite `ai-provider.factory.spec.ts` against pi registry +
      the new 3-value enum.
    - Add a regression assertion in the
      `ai-inflight.service.spec.ts` faux suite that the public
      `{type:'token'|'done'|'error'}` envelope (including the
      cached-hydrate path that emits a whole serialised model as
      a `token` payload) is preserved byte-for-byte. The
      `packages/api-client/models/ai.ts:45` contract is consumed
      by Shiroi / Yohaku and must not drift.
    - Add a minimal faux placeholder for prompt-cache behaviour
      so the public surface is locked even before spec 2 wires
      `cacheRetention` at the call sites.
14. Run live tests
    (`pnpm -C apps/core run test:live:local` + variants) end-to-end
    against OpenAI, Anthropic, OpenRouter to confirm no regression.
15. Update `apps/core/CLAUDE.md` AI module section to describe the
    new runtime layout; update `apps/admin/CLAUDE.md` AI chat UI
    section.

## Rollback

Single PR, atomic commit, `git revert` if needed. The
`ai_agent_conversation` schema change is destructive — by user
agreement existing conversation data is forfeit. Provider config
rows survive the cutover; the migration `UPDATE` is idempotent and
can be re-run on rollback if the enum is restored manually.

## Open Questions

Resolved during the scoping pass and owner review:

- ✅ Admin form path: `apps/admin/src/features/settings/components/ai/`
  (not `features/ai/`). Admin chat UI path:
  `apps/admin/src/features/write/components/agent/`.
- ✅ `ai_agent_conversations` schema keeps `model` and `provider_id`
  columns so `generateTitle` survives unchanged.
- ✅ `@OnEvent(POST/NOTE/PAGE_DELETE)` cascade is removed; orphan
  conversations accepted as data debt.
- ✅ Pi `validateToolCall` order: adapter exposes `validate: false`
  opt-out; `callWriter` / `callEditor` use it to preserve the
  existing `normalize → schema.parse` ordering.
- ✅ Pi model registry surfacing for admin: server-mediated via a
  new `GET /api/ai/registry/models` endpoint so version drift is
  centrally controlled.
- ✅ `@haklex/rich-agent-core` `TransportAdapter`: bypass it and let
  the admin render `AiAgentSseEvent` blocks directly. Avoids
  re-synthesising OpenAI/Anthropic SSE shapes.
- ✅ `ChatProxyDto.tools.parameters` JSON-Schema → TypeBox shim is
  added at the `AiAgentChatService.streamChat` boundary.
- ✅ Prompt-cache faux regression placeholder is included in this
  spec; deeper cache surface lands in spec 2.

Still to confirm during writing-plans:

- `AI_PROMPTS.translation` (`ai.prompts.ts:502`) is suspected dead
  code; grep confirmation required before deciding port-vs-delete.
- `ai-summary` / `ai-insights` test scripting — whether to script
  faux deltas or only the final assistant message (they currently
  use the non-streaming path).
- Behaviour of Drizzle Kit when dropping a table whose rows are
  still being read by the old replica during the rolling cutover.
