# AI Task Queue — Realtime Push, Concurrent Translation, Admin Streaming UI — Design

Date: 2026-05-30
Status: Approved (pending user spec review)
Owner: Innei
Scope: apps/core (task-queue processor, ai-translation), apps/admin (AI task list/detail views, socket bridge)
Depends on: `2026-05-30-ai-sdk-migration-to-pi-design.md` (must land first; pi partial-JSON streaming enables the lexical typewriter UI)

## Summary

Make AI task execution visible in the admin in real time, and parallelise
per-language translation within a single Translation task. Today the
admin polls `/api/ai/tasks` every 5 seconds and never sees the
streaming content of an in-flight translation; the per-task translation
loop runs languages strictly sequentially. After this spec:

- The task queue emits lifecycle, progress, log, stream, and result
  events through the existing `EventManagerService` → `AdminEventsGateway`
  path. The admin subscribes per-task / per-list / per-group and
  receives diff patches.
- A subscription gate (cross-pod via Redis SET) suppresses emit when
  no admin is connected to the relevant room.
- Translation tasks run target languages concurrently behind a
  `p-limit` semaphore (default cap 3, configurable).
- The admin task detail page renders a live "stream" panel: markdown
  translations stream as plain text deltas; lexical translations
  render per-segment progress via pi's partial-JSON tool-call stream.
- Batch / All translation tasks expose their group tree in the admin
  with each child task's live status.
- Task tokens are extended to also store `usage.cost` (per pi),
  surfaced in the admin.

## Motivation

The current task experience is split between optimistic polling and
opaque server work. The admin AI task list refetches every 5 s and the
detail view refetches every 5 s as well. Inside a Translation task the
strategy synchronously walks `languages.length` iterations; with a
typical 4-language batch translation taking ≈ 30 seconds total, the
admin lags 5 s behind every state transition. The streaming token
log already exists in Redis but is invisible to the admin.

Adding per-language concurrency cuts wall-clock to roughly
`ceil(N_lang / 3) × per-lang cost`, a 1.5–2× win on the default 4-lang
matrix and bigger on the `all-languages` configuration. Adding live
events removes the 5 s polling floor and lets the admin render
streaming translation content directly.

This work was originally one big spec until the team chose to migrate
the AI SDK to `@earendil-works/pi-ai` first (spec 1) so the lexical
strategy can stream structured output via partial-JSON tool calls.
This spec assumes spec 1 has landed.

## Non-Goals

- Migrating the runtime SDK — done in spec 1.
- Front-end design overhaul of the AI tasks route — only the new
  panels (live stream, sub-task tree) and live-patch behaviour are
  added; the existing list/detail shells remain.
- Replacing polling everywhere — list/detail polling is retained as
  fallback, with the interval lengthened from 5 s to 30 s.
- Persisting full streamed content into Postgres — streams are
  ephemeral, only the final task `result` is stored as today.
- Pi adoption of pi-agent-core for stateful flows — task queue stays
  mx-native.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  TaskQueueService / TaskQueueProcessor                       │
│  - Existing Redis-backed queue (Lua scripts, group index)    │
│  - Lang concurrency via p-limit at strategy call site        │
│  - Emits events through EventManagerService                  │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  EventManagerService (existing)                              │
│  - emit(BusinessEvents.AI_TASK_UPDATE, payload,              │
│         { scope: TO_ADMIN, gateway.rooms })                  │
│  - AdminEventsGateway → @socket.io/redis-emitter             │
│    broadcasts to room                                        │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Subscription gate (NEW)                                     │
│  - Redis SET "task-queue:room-subs:<room>" with 5-min TTL    │
│  - Pod refreshes its membership on heartbeat (60 s)          │
│  - emit() checks `EXISTS subs:<room>` (O(1)) before flush    │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Admin SocketBridge (existing /admin namespace)              │
│  - subscribe('ai-task:subscribe',   { taskId? | groupId? | all? })  │
│  - subscribe('ai-task:unsubscribe', { taskId? | groupId? | all? })  │
│  - on 'message' AI_TASK_UPDATE: setQueryData diff patch      │
└──────────────────────────────────────────────────────────────┘
```

### Event payload

A single `BusinessEvents.AI_TASK_UPDATE` event covers every phase. The
admin discriminates on `phase`.

```ts
type AiTaskUpdatePhase =
  | 'created'
  | 'started'
  | 'progress'
  | 'log'
  | 'status'
  | 'stream'
  | 'result';

interface AiTaskUpdatePayload {
  id: string;
  type: string;          // ai:translation / ai:summary / ...
  groupId?: string;      // present on sub-tasks
  phase: AiTaskUpdatePhase;
  patch: {
    status?: TaskStatus;
    progress?: number;
    progressMessage?: string;
    completedItems?: number;
    totalItems?: number;
    tokensGenerated?: number;
    cost?: number;                // USD; sourced from pi usage.cost.total
    startedAt?: number;
    completedAt?: number;
    error?: string;
  };
  log?: { timestamp: number; level: 'info' | 'warn' | 'error'; message: string };
  stream?: {
    lang?: string;              // target language for translation streams
    segmentId?: string;         // lexical strategy: pi tool-call partial parse
    chunk?: string;             // markdown strategy: text delta
    partial?: Record<string, unknown>; // lexical strategy: partial tool args
    done?: boolean;             // final stream marker (per lang or per segment)
  };
  result?: unknown;             // only on phase=result
}
```

### Emit routing (per phase)

| phase | trigger | rooms |
|-------|---------|-------|
| created | `TaskQueueService.createTask` | `ai-task:list` + (if groupId) `ai-task:group:${groupId}` |
| started / status / result | `updateStatus` / `setResult` | `ai-task:list` + `ai-task:detail:${id}` + (if groupId) `ai-task:group:${groupId}` |
| progress | `updateProgress` (throttled) | `ai-task:detail:${id}` + (if groupId) `ai-task:group:${groupId}` |
| log | `appendLog` | `ai-task:detail:${id}` |
| stream | translation strategy push hook | `ai-task:detail:${id}` |

### Throttling (worker-side)

- `status` / `created` / `result`: never throttled.
- `progress`: emit when (now − lastEmit ≥ 1000 ms) OR
  (progress − lastEmitProgress ≥ 5 percentage points).
- `log`: emit immediately. The Redis-side `maxLogs: 100` ltrim already
  caps log volume per task.
- `stream`: worker-side buffer; flush every 200 ms or once 80 chars
  accumulate (whichever first). On `done` flush immediately.

### Subscription gate (cross-pod)

The admin emits a `socket.io` `ai-task:subscribe` event upon mounting
the relevant view; `ai-task:unsubscribe` on unmount. On the server:

- The admin gateway stores its socket membership in a Redis SET
  `task-queue:room-subs:<room>` with a 5-minute TTL on each pod's
  presence flag. Each pod refreshes membership every 60 s while at
  least one local socket holds the room.
- `EventManagerService.emit(...)` gets a new helper
  `emitToAdminRoom(event, data, room)` that does a single
  `EXISTS task-queue:room-subs:<room>` (O(1)) before broadcasting.
  Skip when no subscriber across all pods.

This is genuinely cross-pod: with 2 Dokploy replicas, pod A handling
the task and pod B holding the admin socket, pod A still emits because
the Redis SET is shared.

### Per-language concurrency for Translation

The current `executeTranslationTask` walks
`for (let i = 0; i < languages.length; i++)`. Replace with `p-limit`:

```ts
import pLimit from 'p-limit';

const concurrency = aiConfig.translationLangConcurrency ?? 3;
const limit = pLimit(concurrency);
let done = 0;
let failedCount = 0;
const translations: ... = [];

await Promise.all(languages.map((lang) => limit(async () => {
  this.checkAborted(context);
  await context.appendLog('info', `Translating to ${lang}`);
  try {
    const result = await this.generateTranslation(
      payload.refId, lang,
      context.incrementTokens, context.signal,
      // NEW: per-lang stream pusher closed over the worker-side buffer
      (event) => streamBuffer.push(lang, event),
    );
    translations.push({ translationId: result.id, lang: result.lang, title: result.title });
  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    failedCount++;
    await context.appendLog('error', `Failed to translate to ${lang}: ${error.message}`);
  }
  const cur = ++done;
  await context.updateProgress(
    Math.round((cur / languages.length) * 100),
    `Translated ${cur}/${languages.length}`,
    cur, languages.length,
  );
})));
```

`PartialFailed` / `Failed` semantics are preserved exactly. The
concurrency cap is added to `apps/core/src/app.config.ts` under the
existing `ai` section as `translationLangConcurrency: number` with a
default of 3 and a small validation range (1–10).

Token counting (`context.incrementTokens`) already uses Redis HINCRBY
so it is concurrency-safe.

### Translation streaming

After spec 1 lands, both strategies expose a `push` callback for
streaming. The TaskQueueProcessor injects a per-task stream buffer
into the strategy:

- **Markdown strategy**: pi `generateTextStream` deltas already flow
  into the existing `push({ type: 'token', data: chunk.text })` call.
  The buffer accumulates per language, flushes a `stream` event with
  `{ lang, chunk: accumulated }` on the 200 ms / 80-char rule.
- **Lexical strategy**: pi `streamStructured` (added in spec 1) emits
  `{ partial, delta, done?, final? }`. Buffer per language; on each
  flush, send `{ lang, partial: latestPartialObject }` so the admin
  can diff segment-by-segment. On `done`, send
  `{ lang, partial: final, done: true }`.

### Sub-task tree

Batch (`TranslationBatch`) and All (`TranslationAll`) tasks already
create child Translation tasks with `groupId = parent.taskId` and the
queue maintains `index:group:<groupId>`. The detail page extension:

- When a task has `subTaskStats` (existing), the detail view renders a
  "Children" list showing each child's `type / status / progress /
  tokensGenerated / cost` (cost via spec 1).
- The list subscribes to `ai-task:group:${groupId}` so updates from
  any child arrive on a single channel. The existing
  `ai-task:detail:${childId}` subscription is only used for the
  focused child.
- Children are sorted by `createdAt`; status badge animates on update.

### Cost capture

Spec 1 surfaces `usage.cost.total` on every adapter call. To wire it
through:

- `TaskQueueService` gains a column-level field `totalCost` on the
  task hash (Redis HINCRBYFLOAT keyed `cost`, in cents to avoid
  float drift — `Math.round(usd * 100)`).
- A new `context.incrementCost(amountUsd: number)` helper mirrors
  `context.incrementTokens` and is invoked by translation, summary,
  insights, writer services after every adapter call.
- The progress payload includes `cost` (USD as float, computed
  client-side from cents) so the admin can render it next to token
  count.

Persistence: the task hash already has a `tokensGenerated` field;
`cost` is added in the same Redis HSET. No SQL migration.

## Admin UI extensions

The existing master-detail shell stays. New pieces:

| Surface | Component | Behaviour |
|---------|-----------|-----------|
| Task list page | `AiTasksRouteContext` | Replace `refetchInterval: 5000` with `refetchInterval: 30000`. Subscribe to `ai-task:list` on mount, unsubscribe on unmount. Apply diff patches via `queryClient.setQueryData` instead of `invalidateQueries`. |
| Task detail page | `AiTaskDetailRoute` | Same `refetchInterval` change. Subscribe to `ai-task:detail:${id}` on mount; on Translation/Batch/All also subscribe to `ai-task:group:${id}` for sub-task fanout. |
| Task detail — new section | `TaskStreamPanel` (NEW) | Per-language live stream cards. For markdown: monospace typewriter. For lexical: per-segment list with each segment fading in as it lands. Auto-scrolls to bottom unless user scrolled up. |
| Task detail — children | `SubTaskList` (NEW) | Tree-style list under the existing timeline section for Batch/All tasks. Each row shows child status, progress, tokens, cost, with a click-through to its detail page. |
| Task detail — header | `TaskCostBadge` (NEW) | Cost in USD next to tokens. Hidden when cost is 0 (pi registry miss). |

The SocketBridge gains an `AI_TASK_UPDATE` case that fans out by
phase: patch the query cache for `ai-task` keys, and dispatch a custom
DOM event `mx-admin:ai-task-stream` carrying the `stream` payload so
the detail panel can append without re-rendering the whole tree.

### Detail page subscription lifecycle

```
mount → emit('ai-task:subscribe', { taskId })
      → if isBatchOrAll → emit('ai-task:subscribe', { groupId: taskId })
unmount → reciprocal unsubscribes
visibilitychange→hidden → unsubscribe (free emit budget)
visibilitychange→visible → resubscribe + invalidateQueries (catch up)
```

## Backend changes summary

- `apps/core/src/constants/business-event.constant.ts`: add
  `AI_TASK_UPDATE = 'AI_TASK_UPDATE'`.
- `apps/core/src/processors/task-queue/`:
  - `task-queue.service.ts`: inject `EventManagerService`; add
    helper `emit(phase, ...)` that builds the payload, routes to
    rooms, and applies the worker-side throttle. Add
    `incrementCost`.
  - New file `task-queue.stream-buffer.ts`: per-task buffer that
    coalesces stream chunks for emit. Holds per-language sub-buffers.
  - `task-queue.processor.ts`: pass the stream buffer into the
    handler context so strategies can push.
  - New file `task-queue.room-subs.ts`: Redis SET membership manager
    with TTL refresh.
- `apps/core/src/processors/gateway/admin/events.gateway.ts`: add
  `@SubscribeMessage('ai-task:subscribe' / 'ai-task:unsubscribe')`
  handlers that wire into the room-subs manager.
- `apps/core/src/processors/helper/helper.event.service.ts`: add
  `emitToAdminRoom(event, data, room)` that consults the gate before
  broadcasting.
- `apps/core/src/modules/ai/ai-translation/ai-translation.service.ts`:
  rewrite `executeTranslationTask` to use `p-limit`; thread the
  per-lang push callback through `generateTranslation`.
- `apps/core/src/modules/ai/ai-translation/strategies/*`: forward the
  per-lang push to pi via the strategy's existing `push` option.
- `apps/core/src/modules/ai/ai-summary/`, `ai-insights/`,
  `ai-writer/`: call `context.incrementCost(...)` after every
  adapter invocation.
- `apps/core/src/app.config.ts`: add
  `ai.translationLangConcurrency: number` (default 3, range 1–10).

## Admin changes summary

- `apps/admin/src/socket/types.ts`: add `AI_TASK_UPDATE`.
- `apps/admin/src/socket/SocketBridge.tsx`: handle the event;
  perform `setQueryData` for `aiTasksQueryKey`-derived caches; emit
  the DOM event for stream payloads.
- `apps/admin/src/features/ai/components/`:
  - Lengthen `refetchInterval` to 30 s in
    `AiRouteViewContent.tsx` and `AiTaskDetailRoute.tsx`.
  - New `TaskStreamPanel.tsx` consuming the DOM event.
  - New `SubTaskList.tsx` consuming `subTaskStats` and child events.
  - New `TaskCostBadge.tsx`.
  - Add subscribe/unsubscribe effects on mount in detail / list.

## Open Questions

Resolve during writing-plans:

- Exact stream chunk size: 200 ms × 80 chars is a starting estimate;
  validate against real OpenAI / Anthropic streaming pacing on the
  faux test harness from spec 1.
- Whether the existing `MasterDetailShell` Suspense boundary needs a
  tweak to keep the stream panel mounted while the detail content
  swaps under URL changes.
- Whether `subTaskStats` recomputation cost (current implementation
  scans the whole group on every `getTask`) should move behind a
  cache when the new event flow makes per-update reads more frequent.
- Lexical streaming UX for very long documents — confirm the partial
  object diff strategy (whole-payload re-send vs JSON Patch) on a
  real 200-segment article before locking in the format.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Stream event volume during concurrent multi-language translation overwhelms socket bandwidth | The 200 ms / 80-char worker buffer caps emit rate. The subscription gate suppresses emits with no listener. The throttle constants live in `task-queue.constants.ts` and can be tuned without a redeploy. |
| Multi-pod subscription accuracy lag (Redis SET TTL) | TTL is 5 minutes with 60 s refresh; a 60 s missed-emit window during pod failover is acceptable. Polling fallback (30 s) covers the gap from the admin perspective. |
| `p-limit` import increases lock contention on a single AI provider's rate limit | The default cap of 3 is well below all major providers' per-key limits; admin can lower to 1 via `ai.translationLangConcurrency` for rate-limited deployments. |
| Token cost rounding drift (HINCRBYFLOAT precision) | Store in integer cents via HINCRBY; convert to USD float in the API layer. |
| Admin user navigates away mid-stream and leaves the room sub TTL set | `visibilitychange` listener unsubscribes; otherwise the TTL expires within 5 minutes anyway. |

## Implementation Plan (one PR after spec 1)

1. Add dep: `pnpm -C apps/core add p-limit`.
2. Add `AI_TASK_UPDATE` to `BusinessEvents`.
3. Implement `task-queue.room-subs.ts` (Redis SET TTL membership +
   `has(room)` check).
4. Extend `EventManagerService` with `emitToAdminRoom(event, data,
   room)` that gates on `room-subs.has(room)`.
5. Add `ai-task:subscribe` / `ai-task:unsubscribe` handlers to
   `AdminEventsGateway`.
6. Implement `task-queue.stream-buffer.ts` and pass through the
   processor context.
7. Wire `TaskQueueService` to emit lifecycle/progress/log/status/
   result phases with the throttle constants.
8. Add `incrementCost` helper and Redis HSET field; surface it via
   `getTask`.
9. Rewrite `executeTranslationTask` for `p-limit` concurrency; pass
   the per-lang push callback through `generateTranslation` →
   strategies.
10. Add `ai.translationLangConcurrency` to `app.config.ts`.
11. Update `apps/admin/src/socket/types.ts` and `SocketBridge.tsx`.
12. Lengthen polling intervals; add subscribe/unsubscribe effects.
13. Add `TaskStreamPanel`, `SubTaskList`, `TaskCostBadge` admin
    components.
14. Add faux-provider integration tests using the helper from spec
    1: assert the event sequence for a 2-lang Translation task,
    a Batch task with 2 children, and a streamed lexical task.
15. Update docs:
    - `apps/core/CLAUDE.md` AI task queue section.
    - `apps/admin/CLAUDE.md` AI route section (live updates).

## Rollback

Single PR per spec; `git revert`. The Redis SET membership keys
expire automatically; no manual cleanup needed. The `cost` Redis
HSET field on existing tasks is additive and ignored if the field
is absent. Polling resumes at the lengthened 30 s interval if the
socket subscription path is reverted — the admin remains functional.
