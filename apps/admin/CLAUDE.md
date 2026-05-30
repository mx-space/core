# CLAUDE.md — apps/admin

Guidance for Claude Code when working in the admin app inside the mx-core monorepo.

## Project Overview

This is the MX Space admin dashboard — a React 19 SPA (package `@mx-admin/admin`).
It lives at `apps/admin` within the mx-core monorepo and is built locally during the
core build/release; it is no longer downloaded from GitHub releases. The built output
(`apps/admin/dist`) is served by the sibling backend app `apps/core` under the route
`/proxy/qaqdmin`. Built with Base UI primitives, React Router (HashRouter), TanStack
Query, Sonner, and a Tailwind v4 layer.

## Development Commands

Run from the monorepo root (the workspace install is governed by the root):

```bash
pnpm -C apps/admin dev        # Start Vite dev server (opens browser automatically)
pnpm -C apps/admin build      # Production build → apps/admin/dist
pnpm -C apps/admin lint       # oxlint
pnpm -C apps/admin lint:fix   # oxlint --fix
pnpm -C apps/admin typecheck  # tsc --noEmit
```

Equivalently, target the package directly: `pnpm --filter @mx-admin/admin run build`.

Scope checks to changed files only — never run lint/typecheck/build over the whole
tree just to verify a small edit. One-off file typecheck:
`pnpm -C apps/admin exec tsc --noEmit --pretty false`.

Env vars live in `apps/admin/.env` (see `apps/admin/.env.example`). `VITE_APP_BASE_API`
is the mx-core API endpoint. All vars are optional and fall back to empty/same-origin,
so a build with empty env will not crash.

## Architecture Overview

### Technology Stack

- **React 19** + TSX, react-compiler enabled via Babel (`@rolldown/plugin-babel`)
- **Base UI** (`@base-ui/react`) — headless primitives; UI wrappers live in `apps/admin/src/ui/`
- **React Router 7** (`HashRouter`) — `apps/admin/src/routes.tsx` maps route → lazy view
- **Tailwind v4** via `@tailwindcss/vite` (`@import 'tailwindcss'` in `src/index.css`)
- **TanStack Query** — created in `apps/admin/src/query-client.ts`, mounted in `providers.tsx`
- **Sonner** — toast layer mounted alongside the query provider
- **Socket.IO** — `src/socket/SocketBridge` hangs off the authenticated shell
- **better-auth** + passkey for login; auth gate in `App.tsx` (`checkLogged` query) wraps
  everything except `/setup`, `/setup-api`, `/login`

### Entry & Shell

`main.tsx` → `App.tsx` (mounts providers, `HashRouter`, auth gate, installs theme tokens
via `installThemeTokens`) → admin shell (nav chrome + `SocketBridge` + routes). All views
in `routes.tsx` are `lazy()`-loaded and wrapped in `<Suspense>`; add new pages by
registering a lazy import there.

### Path Aliases

```typescript
import { something } from '~/utils/...'  // ~ → apps/admin/src
```

### API Layer (`apps/admin/src/api/`)

API services use the fetch-based helpers in `apps/admin/src/api/http.ts`.

When using TanStack Query, extract arrays with:
```typescript
select: (res: any) => Array.isArray(res) ? res : res?.data ?? []
```

**Error Classes:**
- `BusinessError` — application-level errors (4xx responses)
- `SystemError` — network/server errors (5xx responses, network failures)

### Responsive Breakpoints

- `phone:` — max-width: 768px
- `tablet:` — max-width: 1023px
- `desktop:` — min-width: 1024px

## Code Style Rules

### Validation

After modifying code, run focused type checking and linting on the changed files only.
Run a production build before reporting completion for broad application changes.

### Gray Scale Colors

All gray colors MUST use `neutral` instead of `gray` to match the Vercel-style design:
- Good: `text-neutral-500`, `bg-neutral-800`, `border-neutral-200`
- Bad: `text-gray-500`, `bg-gray-800`, `border-gray-200`

### Typography

Do NOT use arbitrary font sizes (e.g. `text-[11px]`, `text-[13px]`). Use standard
Tailwind classes:

| Purpose | Class | Size | Use Case |
|---------|-------|------|----------|
| Page title | `text-2xl` | 24px | Main page titles |
| Section title | `text-xl` | 20px | Section headers |
| Card/Modal title | `text-lg` | 18px | Card titles, modal headers |
| Secondary title | `text-base` | 16px | Sub-headings, stats |
| Body text | `text-sm` | 14px | List items, form labels, buttons |
| Metadata | `text-xs` | 12px | Timestamps, badges, descriptions |

## Layout Conventions

New admin views must follow the master-detail / content-layout convention. The reusable
shells live in `apps/admin/src/ui/layout/`:

- `content-layout.tsx` — list+detail pages (comments, drafts, topics)
- `page-layout.tsx` — page shell with header
- companion pieces in the same dir (`header-back-button.tsx`, `sidebar-*`, `resize-handle.tsx`)

## Configuration Files

- `apps/admin/vite.config.mts` — Vite + react-compiler + Tailwind + checker; `base` uses
  `VITE_APP_PUBLIC_URL` in production (empty = relative paths, the safe default); the html
  plugin injects `WEB_URL`/`GATEWAY`/`BASE_API` into `window.injectData`
- `apps/admin/src/theme.ts` — CSS token installation for the shell
- `apps/admin/src/index.css` — global stylesheet + Tailwind layer
- `apps/admin/src/constants/env.ts` — resolves API/web/gateway URLs (injected env first,
  then `VITE_APP_*`)

## Release

Two channels publish the dashboard (full detail in `../../docs/admin-monorepo-migration.md`):

- **With a core release** (`v*` tag): `release.yml` builds admin, bundles it into the
  server zip + Docker image, and publishes it to Cloudflare R2.
- **Independently** (admin-only fix, no core release): run
  `../../scripts/release-admin.sh [patch|minor|major]` — bumps `package.json`, tags
  `admin-v*`, and `admin-release.yml` builds + publishes to R2.

The version baseline is `8.x`+ (above the retired GitHub channel) so a freshly bundled
build supersedes any copy previously downloaded into the server's data directory.

## AI Agent Chat (post pi-ai migration)

The AI agent chat surface lives under `apps/admin/src/features/write/components/agent/`
and `apps/admin/src/api/ai-agent.ts`. After the pi-ai migration:

- **Transport** — `apps/admin/src/api/ai-agent.ts` consumes the
  JSON-framed `AiAgentSseEvent` union via the shared TypeBox schema imported
  from `@mx-space/api-client` (originating in
  `packages/api-client/models/ai-agent-sse.ts`). Each SSE line is a single
  `data: <json>\n\n` event — there is no `event:` prefix line. The transport
  parses each frame and dispatches typed events to the session manager.
- **Session manager** — buffers a draft `AssistantMessage` per turn,
  accumulating text/thinking blocks by `contentIndex`. Tool-call blocks are
  ONLY committed on `toolcall_end`; partial `toolcall_delta` is dropped on
  abort or network drop.
- **Multi-block rendering** — `MessageBubble` renders text, thinking, and
  toolcall blocks in monotonic `contentIndex` order. Toolcall events for
  haklex (`insert_node`/`replace_node`) wire back to the lexical editor via
  a callback prop, NOT global state.
- **Network drop** — the transport surfaces a `connection lost` UI without
  crashing. Covered by `apps/admin/src/features/write/components/agent/*.test.tsx`
  (jsdom vitest integration tests + a 50-frame interleaved fixture).
- **Provider config** — `AIProviderDrawer` exposes 3 provider types
  (`OpenAICompatible`, `Anthropic`, `Generic`), with a model `Combobox`
  sourced from `GET /api/ai/registry/models` (10-minute stale, build-hash
  cache key). Unknown legacy localStorage values (`openai`, `openrouter`)
  are rewritten to `openai-compatible` on app boot by
  `apps/admin/src/bootstrap/migrate-legacy-provider-type.ts`. The
  `contextWindow` and `maxTokens` numeric inputs only render when the typed
  model id is NOT in the registry (case-insensitive trim match).

See `apps/core/CLAUDE.md` for the server-side wire-format invariants.

## Related Projects (within the monorepo)

- **apps/core** — backend API server (NestJS), the sibling workspace app. Serves the built
  admin under `/proxy/qaqdmin` and reads it from disk at `<assetRoot>/index.html`.
- **Shiroi** — Next.js blog frontend, located at `../../Shiroi` (relative to repo root).
- **haklex** — rich editor packages (`@haklex/*`), consumed as published dependencies.

### Rich Editor Integration

Rich editor work is integrated as ordinary React components.
