# Publish AI resources: per-resource sync / async

Date: 2026-09-29
Status: approved, executing inline

## Intent

The 2026-08-31 revision-tree refactor (`16627f3d1`) replaced event-driven AI
auto-generation with an explicit `aiResources` list on each publish job, but
every resource in that list blocks publication until it is ready, and the
leftover `enableAutoGenerateTranslation` setting still drives two automatic
behaviours. The author wants publication to stay explicit while choosing,
per resource, whether the article waits for it.

## Decisions

1. Explicit selection at publish time is the only way article AI resources
   are generated. `enableAutoGenerateTranslation` is removed together with
   everything it drives:
   - translation-entry auto-generation on category / topic / note mood &
     weather / post tag changes;
   - `scheduleRegenerationForStaleTranslations` and its callers.
   Both remain available through the existing manual endpoints
   (`POST /translation-entry/generate`, `POST /ai/translation/task*`).
2. Each resource carries a mode:
   - `sync` — created and awaited before the article goes live (current
     behaviour; a failure keeps the article unpublished);
   - `async` — created after the article goes live, never awaited; a failure
     only fails that AI task.
3. Admin publish dialog uses one three-state control per resource:
   `不生成 | 上线前 | 上线后`. The full choice per resource is remembered in
   browser storage and pre-filled next time. Unavailable resources keep their
   remembered choice but are disabled and never submitted. The dialog shows a
   summary of what waits and what follows; the completion toast lists
   background resources and links to the AI task list.
4. CLI: `mxs draft publish <id> --ai summary:sync,insights:async,translation`.
   A resource without a mode is `async`; unknown names or modes fail with the
   valid values. Without `--ai` nothing is generated.

## Interface

`POST /publish-jobs` body:

```ts
aiResources: Array<{ resource: 'insights' | 'summary' | 'translation' | 'tts'; mode: 'sync' | 'async' }>
```

A legacy `string[]` is accepted and normalised to `mode: 'sync'`; duplicates
keep the first occurrence. Stored task payloads use the object form; the
executor normalises legacy payloads on retry the same way.

`PublishTaskResult.resources` keeps `resource → taskId`; the payload already
records each resource's mode for the progress dock.

## Execution order (`PublishService.execute`)

1. Commit snapshot (unchanged).
2. Create and await `sync` resources (unchanged semantics).
3. Set published / commit publication pointer (unchanged).
4. Create `async` resources without waiting; record task ids; log and skip a
   resource whose task creation throws.
5. Abort cancels only `sync` tasks.

`online-update` follows the same order.

## Config migration

Loading a stored `ai` config that still contains
`enableAutoGenerateTranslation` must not fail; verify the config loader's
unknown-key behaviour and strip the key if it rejects it.

## Tests

- core publish service: sync ready before publish; async created after
  publish and not awaited; async failure leaves the article published; abort
  cancels only sync tasks; legacy `string[]` → sync.
- core translation: remove / update specs for the deleted handlers and stale
  regeneration.
- CLI: `--ai` parser (valid list, missing mode → async, unknown resource or
  mode → error).
- admin: pure helpers for remembered choices and submit payload.
