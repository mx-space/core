# mxs CLI — Real-Link E2E Test Harness Design

Date: 2026-06-18
Status: Approved

## Goal

Build an end-to-end test harness that exercises the published `mxs` CLI
behaviour against a real `apps/core` NestFastifyApplication backed by real
PostgreSQL and Redis. Replace the current mock-`http`-server integration
tests in `packages/cli/test/integration/` for any flow that depends on
actual server behaviour (auth sessions, DB persistence, response envelope,
case transformation, exception filter).

Deliver an MVP first — auth device-flow, auth state commands, post CRUD,
profile switching — then expand to full CRUD coverage across the remaining
content resources. AI / file / cache paths are followups.

## Non-goals

- Testing the production `bootstrap()` path in `apps/core/src/main.ts`
  (process-level signal handling, custom logger init, startup banners). A
  separate boot-health CI job will cover that, not this harness.
- Testing the bundled CLI binary (`bin/mxs.cjs` loading `dist/`). A
  follow-up smoke spec will cover the published artefact; this harness runs
  CLI from source via `tsx src/bin/mxs.ts`.
- Mocking external services other than what mx-core already mocks for AI
  (the pi adapter substitution lives inside `apps/core/test`, not here).

## Context

- `packages/cli` — `@mx-space/cli`, `mxs` binary on Effect-TS (`@effect/cli`
  + `@effect/platform`). HTTP transport via `@mx-space/api-client`. Dev
  runs as `tsx src/bin/mxs.ts`; published runs `bin/mxs.cjs` → `dist/`.
- `apps/core` — NestJS + `@nestjs/platform-fastify`, Drizzle ORM on
  PostgreSQL 16+, Redis cache/pubsub, Better Auth with `bearer`,
  `deviceAuthorization` (`MXS_CLI_CLIENT_ID = 'mxs-cli'`),
  `apiKey`, `passkey`, `username` plugins. Email/password sign-up is
  disabled (`disableSignUp: true`).
- Existing test infra in `apps/core/test/helper/`:
  - `startPgTestContainer()` — shared `postgres:17-alpine` per Vitest run,
    runs Drizzle migrations from `src/database/migrations/`, sets env.
  - `createIsolatedPgDatabase()` — per-call `CREATE DATABASE` + migrations
    + `DROP` cleanup, scoped to the shared container.
  - `createE2EApp(module)` — wires `ResponseInterceptor`,
    `AppExceptionFilter`, `HttpCacheInterceptor`, `DbQueryInterceptor`,
    `requestCaseNormalizationPipeInstance`, `extendedZodValidationPipeInstance`
    onto a `NestFastifyApplication`. Overrides `AuthGuard` with
    `AuthTestingGuard` (which **must be turned off** for this harness).
- Existing CLI integration pattern in `packages/cli/test/integration/`:
  `spawn('npx', ['tsx', BIN, ...args])` + assert on stdout/stderr/exit
  code. The mock `node:http` server is what this harness replaces.

## Decisions

### Server boot mode — in-process NestFastify, real port

Use the existing `apps/core` Nest factory wiring with `app.listen(0, '127.0.0.1')`
and read the bound port from `app.getHttpServer().address()`. The CLI is
still spawned as a real subprocess; it sees a real HTTP socket. The
backend lives in the same Node process as Vitest.

Rationale (with a second opinion from an external model):

- The valuable contract is `mxs subprocess → real HTTP socket → real
  Fastify/Nest app → real PG/Redis`. An in-process NestFactory satisfies
  every link of that chain.
- The full `pnpm dev` entrypoint adds process fidelity (signal handlers,
  custom logger, startup banners) but not contract fidelity. Replicating
  it under Vitest costs 5–15s of boot time, log noise, lifecycle
  complexity, and flake surface for marginal coverage gain.
- Anything required for correct HTTP behaviour already lives in the
  shared app factory (`createE2EApp` mounts the same interceptors,
  filter, and pipes as production). `main.ts` is thin process
  orchestration.

A separate CI smoke job runs `pnpm dev` and asserts on a single curl
request — that covers the `main.ts` drift surface without polluting the
e2e matrix.

### Test package location — new `packages/e2e/`

A new private workspace package `packages/e2e/` owns the harness. Both
`apps/core` and `packages/cli` are devDependencies. Neither side has to
acquire a reverse devDep on the other.

### PG isolation — per-file isolated database

Each spec file calls `createIsolatedPgDatabase()` in `beforeAll` and
`drop()` in `afterAll`. The base Testcontainer (`postgres:17-alpine`) is
shared across files via the existing module-level singleton; only the
per-file database is unique. Migrations run once per fresh database.

This unlocks `vitest --fileParallelism` without cross-file DB collisions.
MVP file count (4) adds ~10s total over a shared-DB-with-truncate model;
acceptable for the isolation guarantee.

A future optimisation — `CREATE DATABASE … TEMPLATE` — can skip the
migration step on each new database once the file count grows enough to
matter.

### Redis isolation — per-file testcontainer

Each spec file starts a `redis:7-alpine` container via `testcontainers`
and stops it in `afterAll`. Same isolation rationale as PG; container
boot is ~1–2s.

A future optimisation — shared container with per-file key prefix
(`MXS_E2E_REDIS_PREFIX`) — is on the table once file count grows.

### Auth seeding — fixture-token by default, real device flow once

Most specs seed an owner user server-side and write the resulting bearer
token directly into the CLI profile directory. This skips the
device-flow interaction on every spec but still exercises real Better
Auth session verification on every CLI request.

Exactly **one** spec, `auth-device-flow.test.ts`, drives the real device
flow end-to-end: it spawns `mxs auth login`, parses the `device_code` /
`user_code` from CLI output, and calls the Better Auth `deviceVerify`
API with a pre-seeded owner session to simulate the user approving the
code in a browser.

The CLI binary has no `signup` command (the public sign-up surface is
disabled). User creation goes through `auth.api.createUser({...})` (the
server-side admin path) plus a direct `UPDATE readers SET role = 'owner'
WHERE id = ?` to elevate the seeded user, since Better Auth's `before`
hook forbids `role` mutation from the wire.

### CLI subprocess invocation

Use `spawn(process.execPath, ['--import', 'tsx', BIN, ...args], { env })`
instead of `spawn('npx', ['tsx', BIN, ...args])`. This removes the
dependency on `npx` being on `PATH` in the CI environment and removes
the `npx` resolution latency.

`XDG_CONFIG_HOME` is set to a per-spec temp directory via `makeTmpHome`
(the same helper used by `packages/cli/test/integration/_helpers.ts`)
so the developer's real `~/.config/mxs/` is never touched.

### CI strategy — independent job, PR-default

Add a `pnpm e2e` script and a dedicated GitHub Actions job parallel to
the existing `pnpm test` job. The job runs on every PR by default and
publishes its own timing / failure feedback. It does not gate the unit
test job.

Testcontainers is already known to work in `mx-core` CI (the existing
`apps/core` testcontainer pattern is on the same GH Actions runner).

## File layout

```
packages/e2e/
  package.json                         # name: @mx-space/e2e, private: true
  vitest.config.ts                     # testTimeout: 60_000, fileParallelism: true
  tsconfig.json
  src/
    helpers/
      e2e-app.ts                       # createE2EBackend(): E2EBackend
      tmp-home.ts                      # makeTmpHome(): {path, cleanup}
      mxs.ts                           # runMxs(args, env) + parseEnvelope(stdout)
      seed-auth.ts                     # seedOwnerAndWriteProfile(backend, opts)
      device-flow.ts                   # runDeviceFlow(backend, opts) — device-flow spec only
      redis-container.ts               # startRedisTestContainer(): {uri, stop}
    fixtures/
      owner.ts                         # {email, password, username}
  test/
    auth-device-flow.test.ts           # the one device-flow spec
    auth-login-state.test.ts           # auth status / whoami / logout
    post-crud.test.ts                  # create → list → get → update → delete
    profile-switch.test.ts             # mxs profile {use, ls, show}
```

MVP ships exactly these four spec files. Full-coverage phase adds
`note-crud`, `page-crud`, `category-crud`, `comment-moderate`,
`project-crud`, `snippet-crud`, `topic-crud`, etc.

## Helper API contracts

### `e2e-app.ts`

```ts
export interface E2EBackend {
  port: number
  apiBase: string                     // http://127.0.0.1:<port>/api/v<API_VERSION>
  app: NestFastifyApplication
  authApi: ReturnType<typeof CreateAuth>['auth']['api']
  pgUri: string
  redisUri: string
  stop(): Promise<void>               // app.close() + drop DB + stop Redis
}
export async function createE2EBackend(): Promise<E2EBackend>
```

`createE2EBackend` composes the existing helpers but does NOT reuse
`createE2EApp` directly — that one overrides `AuthGuard` and stubs
`CacheService`, both of which the real-link harness needs to skip.
Instead, a new `setupRealE2EApp` extracts the pipe / filter /
interceptor wiring from `setup-e2e.ts` and applies it to a
non-overridden `Test.createTestingModule(AppModule).compile()` call.
PG / Redis URIs are written into `process.env` **before** module
compilation so the `postgres.provider.ts` factory and the Redis module
pick them up at instantiation time.

### `seed-auth.ts`

```ts
export interface SeededOwner {
  email: string
  password: string
  username: string
  userId: string
  bearerToken: string                 // Better Auth session token (bearer plugin)
}
export async function seedOwnerAndWriteProfile(
  backend: E2EBackend,
  opts: { profile: string; tmpHome: string },
): Promise<SeededOwner>
```

Steps:

1. `backend.authApi.createUser({ body: {...} })` — admin path; ignores
   `disableSignUp`.
2. Direct `UPDATE readers SET role = 'owner' WHERE id = ?` via the
   backend's PG pool — the `before` hook in `auth.implement.ts` rejects
   any wire-level role mutation.
3. `backend.authApi.signInUsername({ body: {...}, asResponse: true })` —
   mint a session, extract the bearer token from the response.
4. Write `${tmpHome}/mxs/profiles/${profile}/config.json` with
   `api_url = backend.apiBase` and `api_version = API_VERSION`.
5. Write `${tmpHome}/mxs/profiles/${profile}/credentials.json` with the
   bearer token in the shape `mxs auth login` would have produced.
6. Write `${tmpHome}/mxs/current` pointing at the profile.

### `device-flow.ts`

```ts
export async function runDeviceFlow(
  backend: E2EBackend,
  opts: { profile: string; tmpHome: string },
): Promise<{ exitCode: number; stdout: string; stderr: string }>
```

Steps:

1. Pre-seed an owner via `seedOwnerAndWriteProfile` into a temporary
   second profile to obtain a bearer token capable of approving.
2. Spawn `mxs auth login --json --api-url <apiBase>` with the empty
   target profile in `MXS_PROFILE`.
3. Parse `device_code` and `user_code` from the JSON line on stdout
   (the CLI writes a `{verification_uri, user_code, ...}` envelope
   when `--json` is set, per `cli/auth/login.ts:134`).
4. Call `backend.authApi.deviceVerify({ body: { user_code }, headers: {
   Authorization: 'Bearer <approver-token>' } })` to mark the device
   code as approved.
5. Wait for the subprocess to exit; return the full stdio.

### `mxs.ts`

```ts
export interface MxsResult {
  code: number
  stdout: string
  stderr: string
}
export async function runMxs(
  args: readonly string[],
  env: Record<string, string>,
): Promise<MxsResult>

export function parseEnvelope(stdout: string): {
  ok: boolean
  data?: unknown
  code?: string
  message?: string
}
```

`runMxs` uses `spawn(process.execPath, ['--import', 'tsx', BIN, ...args])`.
`BIN` is resolved from `packages/cli/src/bin/mxs.ts` via
`fileURLToPath(import.meta.resolve(...))`.

### `redis-container.ts`

```ts
export async function startRedisTestContainer(): Promise<{
  uri: string                          // redis://host:port
  stop(): Promise<void>
}>
```

Uses `new GenericContainer('redis:7-alpine').withExposedPorts(6379).start()`.

## Spec example — `post-crud.test.ts`

```ts
describe('post crud', () => {
  let backend: E2EBackend
  let cleanupHome: () => void
  let env: Record<string, string>

  beforeAll(async () => {
    backend = await createE2EBackend()
    const tmpHome = makeTmpHome()
    cleanupHome = tmpHome.cleanup
    await seedOwnerAndWriteProfile(backend, {
      profile: 'e2e',
      tmpHome: tmpHome.path,
    })
    env = { XDG_CONFIG_HOME: tmpHome.path, MXS_PROFILE: 'e2e' }
  }, 60_000)

  afterAll(async () => {
    await backend.stop()
    cleanupHome()
  })

  it('creates → lists → gets → updates → deletes a post', async () => {
    const created = await runMxs(
      ['--json', 'post', 'create',
       '--title', 'hello e2e',
       '--slug', 'hello-e2e',
       '--text', 'first body'],
      env,
    )
    expect(created.code).toBe(0)
    const id = (parseEnvelope(created.stdout).data as { id: string }).id

    const listed = await runMxs(['--json', 'post', 'list'], env)
    expect((parseEnvelope(listed.stdout).data as { items: any[] })
      .items.map(p => p.id)).toContain(id)

    const got = await runMxs(['--json', 'post', 'get', id], env)
    expect((parseEnvelope(got.stdout).data as any).title).toBe('hello e2e')

    const updated = await runMxs(
      ['--json', 'post', 'update', id, '--title', 'hello revised'],
      env,
    )
    expect((parseEnvelope(updated.stdout).data as any).title).toBe('hello revised')

    const deleted = await runMxs(['--json', 'post', 'delete', id, '--force'], env)
    expect(deleted.code).toBe(0)
  }, 30_000)
})
```

## Risks

1. **`createE2EApp` reuse boundary** — the existing factory overrides
   `AuthGuard` and stubs Redis. The new `setupRealE2EApp` extracts the
   pipe / filter / interceptor wiring without those overrides;
   verification at implementation time that the resulting wiring matches
   `setup-e2e.ts` exactly is required.
2. **`assertSchemaCurrent` guard with isolated DB** — `setPostgresEnv` in
   `startPgTestContainer` writes the base container URI to
   `process.env.PG_URL`. The harness must re-set `process.env` to the
   isolated database URI **before** module compilation, since
   `postgres.provider.ts` reads env at factory instantiation.
3. **`deviceVerify` API shape** — Better Auth's
   `deviceAuthorization` plugin verification endpoint signature must be
   confirmed before writing `device-flow.ts`. If the API requires a
   different body shape or different auth header, the helper changes
   shape but the test still exercises the real device flow.
4. **CLI subprocess PATH** — `process.execPath` + `--import tsx`
   removes the `npx` dependency, but `tsx` must still resolve via the
   workspace's `node_modules`. CI must run `pnpm install` before
   `pnpm e2e`.
5. **Port allocation under high parallelism** — `.listen(0)` is OS-safe,
   but per-file Vitest workers + Testcontainers + Nest sockets could
   approach ulimit at 16+ workers. MVP four-file count is well within
   limits.
6. **MXS_PROFILE vs LOCAL_DEV_ENV** — running CLI from source defaults to
   the `local-dev` profile. Specs must verify that the explicit
   `MXS_PROFILE` env override beats the dev default; if it does not,
   the harness will pass `--profile` as a CLI flag instead.

## Future work

- Full CRUD coverage: `note`, `page`, `category`, `comment`, `project`,
  `snippet`, `topic`.
- AI command coverage with the in-process pi adapter stand-in.
- File upload command coverage with an S3-compatible stub
  (`localstack` or `minio` testcontainer).
- `pnpm dev` boot-health CI job — start production entrypoint, assert
  one curl request, SIGTERM.
- Bundled binary smoke — single spec that runs `node bin/mxs.cjs` against
  a freshly-built `dist/`.
- Shared Redis container with per-file key prefix once file count > 30.
- `CREATE DATABASE … TEMPLATE` to skip per-file migration once file
  count > 30.
