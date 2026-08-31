# @mx-admin/admin

Admin dashboard for Mix Space Core — a React 19 SPA served by the core server at `/proxy/qaqdmin`.

## Tech Stack

| Component | Technology                                                     |
| --------- | -------------------------------------------------------------- |
| Framework | React 19 + Vite 8 (+ React Compiler)                           |
| Routing   | react-router 8 (HashRouter, routes generated from `src/views`) |
| State     | Jotai + Zustand + TanStack Query                               |
| UI        | Base UI primitives + Tailwind CSS v4                           |
| Editor    | Lexical (`@haklex/rich-*`), CodeMirror, Monaco, Excalidraw     |
| Auth      | Better Auth + passkeys                                         |
| Realtime  | @mx-space/ws-client                                            |

Workspace contracts: `@mx-space/ai` (agent SSE events), `@mx-space/editor` (block node types).

## Development

```bash
# From the repo root
pnpm dev:admin        # vite dev server on :9528

# Or from this directory
pnpm dev
pnpm build            # production build → dist/
pnpm test             # vitest (happy-dom)
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
```

For the full stack, run the core server alongside (`pnpm dev` at the repo root), then bridge the production-served admin to the local dev server via `http://localhost:2333/proxy/qaqdmin/dev-proxy`.

### Environment

All variables are optional (empty = safe defaults); see `.env.example`.

| Variable              | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `VITE_APP_BASE_API`   | mx-core API endpoint                                 |
| `VITE_APP_WEB_URL`    | Blog frontend origin ("view on site" links)          |
| `VITE_APP_GATEWAY`    | Socket.IO gateway (derived from API origin if empty) |
| `VITE_APP_PUBLIC_URL` | Vite `base` for production builds                    |

Runtime URL resolution precedence: server-injected `window.injectData` → build-time `VITE_APP_*` → fallbacks (see `src/constants/env.ts`).

## Relation to apps/core

The admin is built **into** the core release, not downloaded at runtime:

- The production Docker image builds `apps/admin` and bakes `dist/` into `out/admin/` with a stamped `version` file.
- The server serves it at `GET /proxy/qaqdmin` (see `apps/core/src/modules/pageproxy/`), semver-comparing the image-baked copy against a runtime-updated copy in `$DATA_DIR/admin` and serving the newer one.
- The former standalone `mx-space/mx-admin` repo is archived; see [`docs/admin-monorepo-migration.md`](../../docs/admin-monorepo-migration.md).

## Release

- **With a core release** — `apps/core/scripts/bump-admin-version.js` patch-bumps the admin version when it changed since the last server tag.
- **Independently** — `scripts/release-admin.sh [patch|minor|major]` tags `admin-v*`, triggering `admin-release.yml`, which builds, zips, and publishes the bundle to R2.
