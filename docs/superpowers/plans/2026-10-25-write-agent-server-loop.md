# Write Agent server loop — phase 1 plan

Spec: https://claude.ai/artifact/7tZYmKTy5HTtpiSKzLz4BU (Claude Docs, "Write Agent 服务端循环与双向 WS 架构")

Phase 1 only: the agent loop runs in core, browser-only tools run in admin over `/ws/admin`, two server tools (`search_articles`, `read_article`). Workspace file changes are injected only at turn start (user decision: no mid-turn injection). Collab is out of scope.

## Global constraints

- WS envelope stays `@mx-space/ws-client` `{v:1, event, payload, id}`; channel = event prefix `agent.`.
- `agent.*` handlers call one replaceable access check; never assume the connection is the owner.
- One run per connection-bound turn; disconnect or `agent.cancel` aborts it. No client tool timeout.
- `messages` column keeps admin UI bubbles + review state. New nullable `transcript` jsonb holds `{ messages: PiMessage[], known: Record<path, string> }`, written only by core.
- No full document injection. Known-file versions come from bash tool results; at turn start, a file whose current content differs from the known version gets a `<system-reminder>` with a unified diff. `/selection.xml` is attached in full the first time.
- Old SSE `POST /ai/agent/chat` and the admin SSE transport are deleted.

## Tasks

1. Shared protocol types in `packages/ai/src/agent-ws.ts` (event names, payloads, server event union). Test: type-level usage compiles via core/admin tests.
2. DB: `transcript` column on `ai_agent_conversations` (schema + expand-only migration).
3. Core `ai-agent-vfs.ts`: known-version bookkeeping + reminder builder (unified diff, attach rule). Unit tests.
4. Core server tools `search_articles` / `read_article` (`ai-agent-server-tools.ts`). Unit tests with fake services.
5. Core run loop `ai-agent-run.service.ts`: transcript load/seed, reminders, model calls, server tool execution, client tool round trip, cancel, persistence. Faux-provider e2e tests.
6. Gateway wiring: `agent.run` / `agent.tool.result` / `agent.cancel` handlers on `AdminEventsGateway` delegating to a registry the AI module fills; disconnect aborts runs. Test via the run service sink contract.
7. Remove SSE chat proxy (controller route, schema, `streamChat`, its e2e) and keep conversation CRUD.
8. Admin document workspace: read/write tracking per command, `/selection.xml` file, `touchedFiles()` snapshot API. Unit tests.
9. Admin server runner `server-agent-runner.ts`: WS events → haklex store (bubbles, tool rows, thinking), client tool execution, review batches, `agent.tool.result`. Unit tests with a fake socket.
10. Admin wiring: `AgentLoopCapture` uses the server runner; `use-write-agent` drops the SSE provider; session manager exposes `ensureConversation()`; delete `llm-provider.ts` / `agent-transport.ts`.
11. Lint/typecheck changed files; whole-branch review.
