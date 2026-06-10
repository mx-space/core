# Unified Task Queue — Design

Date: 2026-06-10
Status: Approved — implemented

## Problem

The shared Redis task queue (`apps/core/src/processors/task-queue/`) carries three
scopes today — `ai`, `enrichment`, `cron` — but the admin can only browse the `ai`
scope (`/ai/tasks`) and cron run history (`/cron-task/tasks`). Enrichment tasks
(including agent-browser screenshot captures) have no admin surface at all.

Meanwhile `TaskQueueEmitter` broadcasts every task lifecycle event — regardless of
scope — as `AI_TASK_UPDATE` to the admin room, and the admin `SocketBridge` prepends
any `created` payload into the AI task list caches. Enrichment tasks therefore leak
into the AI tasks page via socket push but vanish on refresh (the HTTP list is
scope-filtered). The queue is already unified at the infrastructure level; only the
API and UI partition it.

## Decision

Make the task queue a single, first-class admin surface:

- One server controller at `/tasks` listing every scope, with `scope` demoted from
  an access boundary to an ordinary filter field.
- One admin page at `/tasks` (top-level nav item) with scope filter chips.
- Socket event renamed `AI_TASK_UPDATE` → `TASK_UPDATE`, payload gains `scope`.
- The AI tasks page and cron run-history page are replaced by the unified page.
  Cron *definition* management stays where it is.

The socket leak bug is resolved by intent: the unified list is supposed to show
every scope.

## Server design

### Data model — unchanged

`Task.scope` remains a required field (`ai` / `enrichment` / `cron`). The Redis
`indexByScope` index stays. Creation sites pass scope explicitly:

- `AiTaskService` drops its `ScopedTaskService` wrapper and calls
  `taskQueueService.createTask({ ..., scope: 'ai' })` directly.
- `CronTaskService` likewise with `scope: 'cron'`.
- `EnrichmentService` already calls `createTask` with `scope: 'enrichment'` — unchanged.

### Unified controller — `apps/core/src/modules/task/`

```
GET    /tasks?scope=&type=&status=&page=&size=&include_sub_tasks=
GET    /tasks/:id
POST   /tasks/:id/cancel
POST   /tasks/:id/retry
DELETE /tasks/:id
DELETE /tasks?scope=&type=&status=&before=
GET    /tasks/group/:id
DELETE /tasks/group/:id
```

All routes `@Auth()`. The controller talks to `TaskQueueService` directly — no
scope verification layer, since an authenticated admin may see everything.
`scope`, `type`, `status` are optional, combinable filters; `TaskQueueService.getTasks`
already supports all three.

### Retry strategy registry

`TaskQueueProcessor.registerHandler` gains an optional hook:

```ts
buildRetryTask?: (task: Task) => CreateTaskOptions | Promise<CreateTaskOptions>
```

- The generic retry path (`POST /tasks/:id/retry`) checks the registered handler for
  the task's type. With a hook, the hook builds the new task; without one, the
  default is re-enqueue with the original payload and a fresh dedup key
  (`${type}:retry:${timestamp}`), preserving `groupId`.
- The AI translation "retry failed languages only" logic
  (`ai-task.service.ts#retryTaskWithFailedOnly`) moves into the `ai:translation`
  handler registration as its `buildRetryTask`.
- Retry remains restricted to `failed` / `partial_failed` / `cancelled` statuses.

### Deletions

- `common/controllers/base-task.controller.ts` (and its DTOs)
- `processors/task-queue/scoped-task.service.ts`
- `modules/ai/ai-task/ai-task.controller.ts` (the `/ai/tasks` routes)
- The `/cron-task/tasks` run-history endpoints on the cron controller
  (definition endpoints stay)

`AiTaskService` keeps only task-creation responsibilities (dedup key computation,
article info enrichment).

### Error codes

`AI_TASK_NOT_FOUND` / `AI_TASK_ALREADY_COMPLETED` / `AI_TASK_CANNOT_RETRY` in
`app-error-code.ts` rename to `TASK_NOT_FOUND` / `TASK_ALREADY_COMPLETED` /
`TASK_CANNOT_RETRY`. Wire error codes change accordingly; the only consumer is the
in-repo admin, shipped atomically.

### Socket event

- `BusinessEvents.AI_TASK_UPDATE` → `TASK_UPDATE` (constant and wire value).
- `EmitTaskMeta` and every broadcast payload gain `scope: string`.
- `TaskQueueEmitter` behavior is otherwise unchanged (admin-room targeting,
  progress throttling).

## Admin design

### New feature directory — `features/tasks/`

The `Task*` components under `features/ai/components/` (TaskListPane, TaskRow,
TaskDetail, TaskFilterChips, TaskTimeline, TaskLogsBlock, TaskStreamPanel,
SubTaskList, SubTaskStatsView, TaskCostBadge, etc.) move to `features/tasks/`.

- Route `/tasks` registered as a top-level sidebar nav item, alongside AI and Cron.
- Filter chips gain a scope dimension (All / AI / Enrichment / Cron) next to the
  existing status/type chips. `TaskRow` shows a scope badge.
- Detail panel dispatches on task type: `ai:*` tasks render the stream panel,
  sub-task stats, and cost badge; `enrichment:*` and `cron:*` tasks render the
  generic payload / logs / timeline blocks.

### API and cache layer

- Task API functions move from `api/ai.ts` to `api/tasks.ts`, targeting `/tasks`.
- Query keys `adminQueryKeys.ai.tasks*` → `adminQueryKeys.tasks.*`.
- `SocketBridge`: `handleAiTaskUpdate` → `handleTaskUpdate`, listens for
  `TASK_UPDATE`, patches the `tasks.*` caches. Phase routing rules (created /
  status / progress / stream / deleted) are unchanged.

### Page removals and redirects

- The AI tasks page and cron run-history page are removed.
- Cron definition pages deep-link to `/tasks?scope=cron` (optionally with `type=`)
  for run history.
- Legacy route `/ai/tasks` redirects to `/tasks` via `LegacyStaticRedirect`.
- i18n keys `ai.tasks.*` → `tasks.*`.

## Compatibility & migration

- No data migration: every task row in Redis already carries a scope, and tasks
  are TTL-bounded.
- No external consumers: `@mx-space/api-client` (used by Shiro/Yohaku) does not
  expose task endpoints; the admin ships in-repo and atomically with the server.
- Clean break — no alias endpoints, no dual event emission.

## Testing

- **core e2e**: `/tasks` listing with scope/type/status filters; generic retry
  (default re-enqueue path); AI translation retry hook (failed-languages-only);
  cancel/delete; group endpoints.
- **admin**: `SocketBridge.spec` updated for `TASK_UPDATE` and `tasks.*` query
  keys; phase-routing fixture updates; scope-chip filtering covered by component
  tests where they exist.

## Out of scope

- A dedicated enrichment management UI (refresh-by-provider, cache inspection).
- Changes to task creation flows or queue semantics (locking, recovery, dedup).
- Cron definition management UX.
