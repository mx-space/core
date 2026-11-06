# Editor agent: session state owned by the server

Status: approved 2026-11-07. Source document: Ryugi `document/agent-session-state` (https://ryugi.innei.dev/a/G7Xx3y0tF7TvHIw35VKYB). "Owner" marks decisions the project owner made; "builder call" marks defaults chosen during design that the owner reviewed on approval.

## 1. Intent

The server already keeps the full transcript of a run, and the admin WebSocket is a stateful connection. Today:

- every `agent.run`, `agent.steer` and bash `agent.tool.result` resends all system text, all tool schemas and full file contents the server already holds;
- the database stores each conversation twice: UI bubbles in `messages` (client overwrites the whole array, review state embedded, 32 MB body limit) and the model history in `transcript` (server writes during a run). They drift; an empty transcript is rebuilt from bubbles and loses tool records; runs without a `conversationId` keep history only in connection memory.

This project makes the **server transcript the single source of truth** and makes the **transport send only deltas**. Agent conversation data is disposable (owner): discard all existing data, delete every old code path, keep no compatibility layer.

## 2. Goals, non-goals, anti-goals

| Goals | Non-goals | Anti-goals |
|---|---|---|
| Within one connection, unchanged system text / tools are sent once; files are sent as patches | Context compaction or folding old tool results (owner: not needed) | Any code path kept only for compatibility |
| Rebuilt table stores `transcript` and `review_state` only; no `messages` | Resuming a run after a WS disconnect (owner: keep aborting) | The transcript content the model sees differs from today |
| The server creates conversations; delete the connection-memory path, bubble backfill, REST creation and messages sync | Keeping old conversations; old/new admin ↔ server compatibility (owner: neither) | A patch baseline mismatch leading the server to hold wrong file content |

## 3. Constraints

- Dokploy rolling deploy with 2 replicas; schema migrations run as a release-phase step. **This project is an explicit exception to expand-contract (owner):** during the tens-of-seconds cutover, agent requests from old pods/old pages may fail. Acceptable.
- New admin does not support old servers; old pages do not support the new server (owner).
- core ships this as a **breaking major version** (owner). Release notes must state: AI agent conversations are wiped; admin and server must run the same version.
- A WS connection is pinned to one pod, so per-connection in-memory caches are valid; nothing is shared across connections.
- `transcript` stays `json`, not `jsonb` (jsonb reorders keys and breaks provider prompt-cache prefixes). `review_state` follows the same rule.

## 4. Decisions

| Topic | Decision | By |
|---|---|---|
| Source of truth | Server transcript; UI derived from it | Owner |
| Review state | Separate `review_state` column, updated in small writes when it changes | Owner |
| System / tools dedup | Content-hash references, cached per connection; miss → `CONTEXT_MISSING` | Owner |
| File dedup | Base hash + patch; mismatch → NACK, client resends full content; shared by run, steer and tool result | Owner (sharing across all three: builder call) |
| Conversation creation | Server creates the row on `agent.run`, returns the id in the ack | Owner |
| History load | Server projects the transcript into compact bubbles | Owner |
| Selection pins, error bubbles | Not persisted | Owner |
| Old conversations | Discarded; table rebuilt | Owner |
| Compatibility | None; one release; old code deleted | Owner |
| Disconnect during a run | Abort the run; transcript kept | Owner |
| Context compaction | Not done | Owner |

## 5. Design

```mermaid
sequenceDiagram
  participant C as Admin client
  participant S as AiAgentWsHandler
  participant R as AiAgentRunService
  participant DB as ai_agent_conversations
  C->>S: agent.run {systemHash, toolsHash, files: hash/patch, conversationId?}
  alt cache miss / baseline mismatch
    S-->>C: ack {ok:false, code: CONTEXT_MISSING | FILE_BASE_MISMATCH}
    C->>S: agent.run (full content resent)
  end
  S->>DB: create row if conversationId is null
  S-->>C: ack {ok:true, conversationId}
  S->>R: run(resolved full payload)
  R->>DB: save transcript
  R-->>C: agent.event / agent.tool.call
  C->>S: agent.tool.result (request; files as patches)
  R-->>C: agent.done
  C->>DB: PUT review-state (when review state changes)
```

### 5.1 Data model and migration

One migration drops and recreates the table under the same name. Illustrative SQL; generate the real one with `drizzle-kit generate`, using the existing `pkText`, `createdAt`, `updatedAt` helpers and the rule names from `apps/core/scripts/lint-migrations.ts`:

```sql
-- migration-lint:allow=drop-table reason=agent conversations are disposable; owner chose to discard all data
DROP TABLE IF EXISTS "ai_agent_conversations";
CREATE TABLE "ai_agent_conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "model" text NOT NULL,
  "provider_id" text NOT NULL,
  "title" text,
  "transcript" json NOT NULL,
  "review_state" json,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "ai_agent_conversation_session_idx" ON "ai_agent_conversations" ("session_id");
```

- Schema lives in `packages/db-schema/src/schema/ai.ts`.
- `model`, `provider_id` become NOT NULL: rows are only created at run time, when both are known (builder call).
- `transcript` becomes NOT NULL, initialised to `{ messages: [], known: {} }` (builder call).
- `review_state` shape (builder call; avoids changing haklex's `ReviewBatch` type):

```ts
interface StoredReviewState {
  reviewState: AgentStoreReviewState // from @haklex/rich-agent-core, unchanged
  anchors: Record<string, string>    // batchId -> toolCallId that produced the batch
}
```

### 5.2 WS protocol (`packages/ai/src/agent-ws.ts`)

```ts
type AgentFileFrame =
  | { path: string; attach?: boolean; content: string }                  // full
  | { path: string; attach?: boolean; baseHash: string; patch: string }  // patch
  | { path: string; attach?: boolean; hash: string }                     // unchanged

interface AgentRunPayload {
  runId: string
  sessionId: string
  conversationId: string | null
  model: string
  providerId: string
  user: string
  systemHash: string
  system?: string[]          // only when the server has not cached it
  toolsHash: string
  tools?: AgentToolSchema[]  // same
  files: AgentFileFrame[]
}
// agent.steer: { runId, user, files: AgentFileFrame[] }
// agent.tool.result: becomes a request (acked), files?: AgentFileFrame[]

// acks
{ ok: true, conversationId }                                    // run accepted
{ ok: false, code: 'CONTEXT_MISSING', missing: ('system' | 'tools')[] }
{ ok: false, code: 'FILE_BASE_MISMATCH', paths: string[] }
```

- **Hashing:** SHA-256 hex. System / tools hash `JSON.stringify(value)`; files hash the content string. Browser uses `crypto.subtle`, server uses `node:crypto`; both use one serialisation function exported from `packages/ai` (builder call).
- **Server cache:** one `Map<hash, value>` per connection. When full content arrives, store it under the server-computed hash; if that differs from the client's hash, reply `VALIDATION_FAILED`. Cleared with the connection.
- **File baseline:** per connection and per conversation, the server keeps `baseline: Record<path, content>` = the last full content the client reported. This is distinct from the run's `known` (what the model has seen); never mix them. Patches are unified patches from the `diff` package (core already depends on `diff@9.0.0`; add the same version to admin). Server applies `applyPatch(baseline[path], patch)`; failure also yields `FILE_BASE_MISMATCH`.
- **Client mirror:** the client keeps the same baseline per conversation and updates it only after an ok ack. Clear it whenever the socket leaves `open`; the first frame after reconnect sends full content. On NACK, resend full content for the listed paths, retry once, then treat the run as failed.
- **ws-client:** on a failed ack it currently keeps only `code`; change it to surface the whole ack (`missing`, `paths`) to callers.
- **No legacy payload:** `systemHash` and `toolsHash` are required; the old shape gets `VALIDATION_FAILED`.

### 5.3 Conversation creation and runs

- `handleRun`: when `conversationId` is null, create the row (sessionId, model, providerId, empty transcript) first, then take the Redis run lock; the ack returns the new id.
- `AiAgentRunService.openTranscript`: read `transcript` only. Delete the connection-memory branch, the rebuild-from-bubbles branch, and `bubblesToHistory`, `toPiMessages`, `withoutPendingUser`.
- Delete `ConnectionState.memory`.
- Client: delete `startCreation`, REST creation inside `ensureConversation`, epoch and pending-creation state in `useAgentSessionManager`. `createWriteAgentRuntime` stops calling `ensureConversation`; it takes `conversationId` from the run ack, writes it back as the active session, and inserts the new conversation into the session list.
- A new document has no id before its first save, so the first run's `sessionId` is a random UUID. Once the document id exists, the client calls `PATCH /ai/agent/conversations/:id` to set `sessionId` to `<kind>:<id>`, then reloads the list for the new id. This replaces the existing `adoptInMemory` branch (builder call).
- Title: after the conversation's first `agent.done` with status `complete`, if it has no title, the client calls the existing `POST /ai/agent/conversations/:id/title`. Server `generateTitle` reads the first user message from the transcript and strips the leading `<system-reminder>`.

### 5.4 History projection (server)

`GET /ai/agent/conversations/:id` returns `{ ...meta, bubbles, reviewState, anchors }`. `bubbles` = `projectTranscriptToBubbles(transcript.messages, anchors)` in a new `ai-agent-history.projection.ts`. The output type `AgentHistoryBubble` lives in `packages/ai`, structurally identical to `@haklex/rich-agent-core`'s `ChatBubble`; core does not depend on haklex (builder call).

| Transcript element | Projected to |
|---|---|
| user | user bubble, with the leading `<system-reminder>…</system-reminder>\n\n` stripped (the format is produced by `appendUser`, so it strips deterministically) |
| assistant thinking block | thinking bubble (`steps` split on blank lines, as in the live stream) |
| assistant text block | assistant bubble; `usage` of every call in the turn is summed onto the turn's last assistant bubble |
| assistant toolCall + matching toolResult | tool_call_group item. Status from `isError`; missing result → error. Keep full `result` when ≤ 4 KB, or when it parses as an edit operation containing `op` (used by reapply), or when the tool name is in `FULL_RESULT_TOOLS` exported from `packages/ai` (dynamic component cards parse `readDynamicDraft` / `readDynamicReceipt`). Otherwise send `resultPreview` (first 80 chars) and `truncated: true` (threshold: builder call) |
| batch in `anchors` | diff_review bubble, inserted after the tool_call_group holding its anchor toolCallId |

Client hydration fills each item's `description` via the local toolMap's `describeCall`. Selection pins and error bubbles are not restored (owner).

### 5.5 Review state persistence

- New `PUT /ai/agent/conversations/:id/review-state`, body `StoredReviewState`; body limit stays 32 MB because batches embed document snapshots.
- Client: `onOperationsChanged` gains a `toolCallId` argument (`ServerAgentRunner.runClientTool` already holds it); `AgentLoopCapture` records it in `anchors` when it creates a batch. Upload review state debounced when it changes.
- Delete `withEmbeddedReviewState` and `REVIEW_STATE_SENTINEL`.

### 5.6 Endpoint and code removal (all in one release)

| Endpoint / code | Action |
|---|---|
| `POST /ai/agent/conversations` | Delete |
| `PATCH` / `PUT /ai/agent/conversations/:id/messages` | Delete |
| `GET /conversations`, `PATCH /conversations/:id`, `DELETE`, `POST …/title` | Keep; responses no longer include messages |
| `GET /conversations/:id` | Returns projected bubbles + reviewState + anchors |
| `PUT /conversations/:id/review-state` | New |
| admin `api/ai-agent.ts` | Delete create / append / replace |
| admin `useAgentSessionManager` | Delete messages sync, `withEmbeddedReviewState`, `REVIEW_STATE_SENTINEL`, creation-race state. Keep: session list, switching and hydration, review-state sync, title trigger, sessionId re-keying |

## 6. Test checklist

- [ ] Protocol: the first run sends full content; the second sends hashes only and the server resolves the same system / tools.
- [ ] `CONTEXT_MISSING`: after the cache is cleared, the client resends once and succeeds.
- [ ] File patches: with a matching baseline the server reconstructs content byte-identical to the client's; a mismatch yields a NACK and the resend succeeds; after reconnect the first frame is full content.
- [ ] `tool.result` as a request: bash touched files go through patches.
- [ ] Creation: a run with a null `conversationId` creates a row and returns its id in the ack; concurrent runs on one conversation are still blocked by the lock.
- [ ] Projection: one case each for thinking, text, tool call, usage, reminder stripping, large-result truncation, full `op` results, `FULL_RESULT_TOOLS`, diff_review placement.
- [ ] The old payload shape (no hashes) is rejected with `VALIDATION_FAILED`.
- [ ] Migration passes `lint:migrations` (with the allow annotation); after a local `migrate`, the `assertSchemaCurrent` boot guard passes.

## 7. Left to the builder

- Which file in `packages/ai` holds the hash serialiser and patch helpers.
- Whether the client baseline mirror lives in the runner or the runtime layer, as long as it updates only after an ok ack and clears on disconnect.
- The exact debounce for review-state uploads.
- Test file layout.

## 8. Artifacts used

- Whiteboard `whiteboard/editor-agent-pipeline` (https://ryugi.innei.dev/a/cZdDsbJj3tUeYOQUYy0wE): map of the current pipeline that this design starts from. No decisions were made on it.
- Document `document/agent-session-state` (https://ryugi.innei.dev/a/G7Xx3y0tF7TvHIw35VKYB): two rounds of questions plus the builder check; every answer is recorded in section 4.
