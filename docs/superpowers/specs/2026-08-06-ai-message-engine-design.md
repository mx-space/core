# AI Message Engine — append-only agent conversation for translation

Date: 2026-08-06
Status: implemented (step 1); step 2 bench pending
Scope: `apps/core/src/modules/ai/message-engine/` (generic), first consumer `ai-translation` (lexical strategy)

> 2026-08-14 更新：`ContextInjector`、`buildPrefix` 和 `seedConversation` 已被删除。当前翻译入口由 `createTranslationConversation()` 直接从 `AI_PROMPTS` 创建固定 system prompt 和首条 user message；下文相关段落仅记录原始设计。

## Motivation

Measured problems in the current translation pipeline (2026-08-06 benchmarks):

1. **Prompt cache hit rate is 7.1%.** Every writer/reviewer/editor call is an isolated
   `[system, user]` pair; nothing shares a prefix. A full review loop re-sends ~29k prompt
   tokens with ~2k cached.
2. **Prompt assembly is ad-hoc.** Four roles hand-concatenate system + user strings across
   `ai.prompts.ts` (787 lines); cross-cutting changes (style hints, glossary, source
   on/off) touch every call site.
3. **The cold-start editor loses context.** The editor re-reads the full translation map
   from scratch each pass, fixes only the segment an issue names, and misses sibling
   occurrences of the same defect (measured: reviewer flags one 内部循環, the second
   survives).
4. **Reviewer detection is view-dependent.** A 2x2 probe (3 reps per cell) showed
   deepseek's carryover detection drops from 9/9 (target-only view) to 5/9 when the
   source is paired per-segment; the loop needs per-pass control over the reviewer's view.

## Decisions (user-directed)

- One **append-only conversation** per translation job is the state. Messages are only
  appended, never rewritten; every model turn reuses the full prior prefix from the
  provider prompt cache.
- The **system prompt never changes** during the loop. All variable context
  (TARGET_LANGUAGE, style hints, document context) is injected as user-message content.
- The translation lives in a **virtual file**. The writer produces it, review rounds
  patch it, and only the final file content is written to the DB.
- **Review is a tool.** The main-thread model decides when to call it; the obligation to
  review before finishing is a system-prompt constraint, not orchestrator scripting. The
  review tool is built on a generic **sub-agent** primitive (`SubAgentSpec`: runtime
  carrying model + provider, system prompt, reasoning effort, timeout): each invocation
  runs a fresh, isolated structured call on the reviewer runtime and returns its result
  as the tool result.
- The engine is **AI-module generic** (`modules/ai/message-engine/`); translation is the
  first consumer, other features migrate later.

## Architecture

```
modules/ai/message-engine/
├── message-engine.module.ts
├── conversation/
│   └── conversation.ts       append-only Conversation over the published Message Engine;
│                             system prompt frozen at construction
├── vfs/
│   ├── virtual-fs.ts         generic in-memory FS: path → content, patch log, versioning
│   └── types.ts
├── tools/
│   ├── tool.types.ts         EngineTool { name, description, schema (TypeBox), execute }
│   └── sub-agent.ts          SubAgentSpec + invokeSubAgent (structured call w/ timeout)
└── loop/
    └── agent-loop.ts         thin harness over @earendil-works/pi-agent-core runAgentLoop
                              (arg validation, tool-error semantics, beforeToolCall
                              budget blocks come from pi; harness adds maxSteps cap and
                              mirrors messages into the Conversation)
```

### Conversation and caching

The loop drives `IModelRuntime.streamMessage` (already accepts full pi `Message[]`
including `toolResult`, plus `tools` — see `runtime/types.ts:83-95`; message round-trip
precedent in `ai-agent-chat.service.ts:229-273`). Because the conversation is append-only
and the system prompt is frozen, turn N+1's prompt is turn N's prompt plus a suffix —
the shape provider prefix caches reward. DeepSeek caches prefixes automatically at ~0.1x
input price; OpenRouter multi-provider routing can still miss (caches are per-provider),
which is accepted — provider pinning is a config-level option, not an engine concern.

### Virtual FS

Generic layer: named files with string content, `read`, `write`, `applyPatch`
(replace-by-key), and a patch journal for diagnostics. No size/GC concerns — instances
are per-job and die with the job. The translation module defines the file layout
(a segment map `id → text`, one file per job) and binds the three behaviors as tools.

### Tools (translation binding)

| Tool | Backing | Notes |
| --- | --- | --- |
| `write_translation` | vfs write | initial full draft; args schema = existing chunk schema (exact member keys, `additionalProperties: false`) |
| `patch_translation` | vfs replaceInKey | search/replace edits `{ edits: [{ id, find?, replace }] }` — `find` must occur exactly once in the segment (ambiguous/absent finds fail back to the model); omitting `find` replaces the whole segment. Constrains edits to the flagged span and prevents whole-segment rewrite churn |
| `read_translation` | vfs read | rarely needed (model has its own output in context) but cheap to provide |
| `request_review` | sub-agent | runs the reviewer sub-agent, returns `{ issues }` |

Tool args are TypeBox-validated at the boundary (same `Value.Check` discipline as today);
a failed validation returns an error tool result so the model can retry, replacing the
four-stage `parseModelJson` repair chain on the main thread.

### Reviewer sub-agent

Each `request_review` invocation spawns a fresh two-message conversation on the
**reviewer runtime** (swappable model family preserved) with the existing reviewer system
prompt. The tool executor — not the model — decides the view per invocation, encoding the
2x2 probe finding:

- invocation 1: **monolingual** (target only) — catches native-fit defects and same-kanji
  carryovers (deepseek: 9/9 vs 5/9 with source)
- invocation 2+: **bilingual** (source + target) — catches fidelity drift the monolingual
  view cannot see

Long documents are windowed at 60 segments per reviewer call inside the executor, with
the fixed 12-issue budget per window (both limits are load-bearing; see the quota
inflation negative result). Issues from all windows merge into one tool result.

### Main-thread system prompt

Composed once from contributors: translation mission + target-language partial + ruby
partial + tool usage constraints. The constraints section encodes the loop contract:

- after writing the draft, you MUST call `request_review`
- after a review returns issues, patch the file (fix every occurrence of a flagged
  pattern, not only the cited segment — the model owns the whole file and its own
  history, which is what makes the sweep natural), then call `request_review` again
- finish only when a review returns zero issues, or when told the round budget is
  exhausted

### Termination guards

The model steers; the loop enforces. `guards.ts` applies hard caps regardless of model
behavior: max review rounds (default 3), max total steps, cost ceiling. On cap breach the
loop injects a final forced-finish user message ("wrap up; no more tool calls") and the
current VFS content is taken as final — mirroring today's graceful degradation where
reviewer failure keeps writer output.

### Streaming partials

Client-facing partial pushes (`push` in the lexical strategy) hook tool execution: each
`write_translation` / `patch_translation` execution emits the updated segments. Per-turn
granularity replaces today's per-token structured partials; the public SSE wire format is
unchanged (raw token frames remain the strategy's concern, not the engine's).

## Migration

Step 1 — engine + lexical strategy on the new loop, behavior-compatible gates:
- `parseLexicalForTranslation` / block reuse / incremental path / `restoreLexicalTranslation` unchanged; only the middle (writer call + `runReviewAndEditPipeline`) is replaced
- the standalone editor prompt retires here — the editor role is structurally merged
  into the main thread, so step 1 is compatible, not byte-equivalent
- existing faux e2e + regression fixtures stay green (reviewer fixtures unchanged; editor
  fixtures replaced by tool-call conversation fixtures); `PipelineMetrics` shape
  preserved (rounds, issues, patches) for admin UI
- markdown strategy stays on the old path until lexical is proven

Step 2 — quality deltas measured against the step-1 baseline via the mxs bench:
- mono/bilingual review views (in tool executor, per above)
- reviewer Japanese checks gain an explicit generic-you (あなた) bullet

Step 3 (later, not in scope) — summary/insights adopt the prefix builder; agent chat
stays on its native pi path.

## Non-goals

Multimodal content parts, tool-call IR beyond pi's own types, human-in-the-loop,
conversation persistence, token accounting beyond existing usage/cost capture,
markdown-strategy migration, glossary config (deferred separately).

## Risks

- **Model discipline**: a translator model may under-call `request_review`. Guarded by
  the system-prompt contract plus hard caps; the bench (step 2) measures whether
  model-initiated review matches the old orchestrated loop's quality. If it regresses,
  the fallback lever is `toolChoice`-forced review turns — an executor-level switch, not
  an architecture change.
- **Conversation growth on long documents**: prompt tokens grow linearly with rounds;
  cached-price arithmetic keeps cost in the current $0.01–0.02 per article-language
  band. The 60-segment reviewer window bounds the sub-agent side.
- **Provider routing cache misses**: accepted; engine design is cache-shaped, not
  cache-dependent — correctness never relies on a hit.
