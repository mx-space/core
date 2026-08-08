# @mx-space/e2e

End-to-end test harness for the mx-space CLI ↔ server contract. Boots a **real** in-process NestJS core server backed by throwaway PostgreSQL and Redis containers, seeds an owner, then drives the **real** `mxs` CLI binary as a subprocess against it.

## How it works

Each test file follows the same lifecycle:

1. **Containers** — `createE2EBackend()` starts a `postgres:17-alpine` testcontainer (per-worker isolated database, migrated from `apps/core/src/database/migrations`) and a per-backend `redis:7-alpine` testcontainer.
2. **Env seeding** — `PG_*` / `REDIS_*` / `MIGRATIONS_DIR` / `JWT_SECRET` are written into `process.env` *before* `apps/core`'s `AppModule` is dynamically imported, so no frozen config defaults leak in.
3. **Server** — `@nestjs/testing` compiles `AppModule`; Fastify listens on an ephemeral loopback port in dev mode (no `/api/vN` prefix).
4. **Auth** — an owner is inserted directly into PostgreSQL (Better Auth credential rows), a bearer token is minted via `signInUsername`, and a CLI profile is written under a temporary `$XDG_CONFIG_HOME`.
5. **CLI** — tests spawn `packages/cli/src/bin/mxs.ts` via `tsx` with mode flags and assert on the parsed `{ ok, data }` envelope. `runAcrossModes()` walks all five output modes (`json`, `pretty-json`, `readable`, `llm`, `xml`).

## Running

```bash
# From the repo root
pnpm e2e

# Or from this package
pnpm -C packages/e2e run test
```

Requires Docker (testcontainers). No environment variables are strictly required — all are seeded with `??=` defaults. Set `PG_VERIFY_URL` to reuse an external PostgreSQL instead of starting a container.

> [!NOTE]
> Hook and test timeouts are 120s; CI runs with 2 retries and 2 workers.

## Layout

```
src/
├── helpers/    # backend boot, PG/Redis containers, CLI subprocess, auth seeding, fixtures
└── fixtures/   # canonical owner credentials
test/
├── auth-device-flow.test.ts, auth-login-state.test.ts, post-crud.test.ts, profile-switch.test.ts
├── ai/         # AI artifact management
├── file/       # upload flow
├── help/       # help output contracts
├── output/     # output-mode format matrix
├── resources/  # category / comment / config / note / page / project / snippet / topic CRUD
└── skill/      # skill list / get / search output
```
