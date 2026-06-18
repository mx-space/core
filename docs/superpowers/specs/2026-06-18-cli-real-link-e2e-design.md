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

- `packages/cli` — `@mx-space/cli`, `mxs` binary on Effect-TS
  (`@effect/cli` and `@effect/platform`). HTTP transport via
  `@mx-space/api-client`. Dev runs as `tsx src/bin/mxs.ts`; published
  runs `bin/mxs.cjs` → `dist/`.
- `apps/core` — NestJS + `@nestjs/platform-fastify`, Drizzle ORM on
  PostgreSQL 16+, Redis cache/pubsub, Better Auth with `bearer`,
  `deviceAuthorization` (`MXS_CLI_CLIENT_ID = 'mxs-cli'`),
  `apiKey`, `passkey`, `username` plugins. Email/password sign-up is
  disabled (`disableSignUp: true`).
- Existing test infra in `apps/core/test/helper/`:
  - `startPgTestContainer()` — shared `postgres:17-alpine` per Vitest run,
    runs Drizzle migrations from `src/database/migrations/`, sets env.
  - `createIsolatedPgDatabase()` — per-call `CREATE DATABASE`, migrations,
    and `DROP` cleanup, scoped to the shared container.
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

- The valuable contract is end-to-end subprocess-to-database fidelity:
  `mxs` subprocess, real HTTP socket, real Fastify/Nest app, and real
  PG/Redis. An in-process NestFactory satisfies every link of that chain.
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
flow end-to-end: it spawns `mxs auth login`, parses the `user_code` from
the JSON envelope, and calls the Better Auth device verification and
approval APIs with a pre-seeded owner session to simulate the user
approving the code in a browser. The CLI does not expose `device_code`
in JSON output, so the harness treats `user_code` as the browser-side
approval contract and leaves the device code private to the CLI
polling loop.

The CLI binary has no `signup` command (the public sign-up surface is
disabled). User creation goes through direct PG inserts into `readers`
and `accounts`, followed by the real `auth.api.signInUsername(...)`
path. This avoids assuming an unavailable Better Auth admin creation
helper while still minting a real session token through the application
auth layer. The seeded reader row is inserted with `role = 'owner'`,
because Better Auth's `before` hook forbids `role` mutation from the
wire.

### CLI subprocess invocation

Use the direct Node executable instead of `npx`, with the `tsx` loader
resolved in the e2e helper:

```ts
spawn(
  process.execPath,
  ['--import', import.meta.resolve('tsx'), BIN, ...args],
  {
    cwd: workspaceRoot,
    env: { ...process.env, ...env },
  },
)
```

This removes the dependency on `npx` being on `PATH` in the CI
environment and removes the `npx` resolution latency while preserving
CI-provided environment variables and Node/toolchain state.

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
  vitest.config.ts                     # testTimeout: 60_000, fileParallelism: true, e2e app-config alias
  tsconfig.json
  src/
    helpers/
      e2e-app.ts                       # createE2EBackend(): E2EBackend
      tmp-home.ts                      # makeTmpHome(): {path, cleanup}
      mxs.ts                           # runMxs(args, env) + parseEnvelope(stdout)
      seed-auth.ts                     # seedOwnerAndWriteProfile(backend, opts)
      device-flow.ts                   # runDeviceFlow(backend, opts) — device-flow spec only
      redis-container.ts               # startRedisTestContainer(): {uri, stop}
      core-app-config.ts               # e2e-only ~/app.config alias, env-backed PG/Redis constants
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
  siteUrl: string // http://127.0.0.1:<port>
  apiBase: string // http://127.0.0.1:<port>/api/v<API_VERSION>
  app: NestFastifyApplication
  authApi: ReturnType<typeof CreateAuth>['auth']['api']
  pgUri: string
  redisUri: string
  stop(): Promise<void> // app.close() + drop DB + stop Redis
}
export async function createE2EBackend(): Promise<E2EBackend>
```

`createE2EBackend` composes the existing helpers but does NOT reuse
`createE2EApp` directly — that one overrides `AuthGuard` and stubs
`CacheService`, both of which the real-link harness needs to skip.
Instead, a new `setupRealE2EApp` extracts the pipe / filter /
interceptor wiring from `setup-e2e.ts` and applies it to a
non-overridden `Test.createTestingModule(AppModule).compile()` call.

PG / Redis configuration is early-bound in core modules, so
`createE2EBackend` must avoid top-level value imports from `apps/core`.
The sequence is:

1. Start the isolated PG database and Redis container.
2. Write `PG_URL`, `PG_CONNECTION_STRING`, `REDIS_CONNECTION_STRING`,
   `REDIS_HOST`, `REDIS_PORT`, `JWT_SECRET`, and `SNOWFLAKE_WORKER_ID`
   into `process.env`.
3. Dynamically import `AppModule`, `fastifyApp`, pipes, filters, and
   `disposePool()` only after those env values exist.
4. Compile a non-overridden testing module that imports `AppModule`,
   create the NestFastify app, mount the same global pipes as production,
   and `listen(0, '127.0.0.1')`.
5. In `stop()`, close the Nest app, call `disposePool()` to clear the
   module-level cached PG pool/db, drop the isolated database, and stop
   Redis.

`packages/e2e/vitest.config.ts` aliases `~/app.config` to
`src/helpers/core-app-config.ts`, not to `apps/core/src/app.config.ts`
or `apps/core/src/app.config.test.ts`. The shim exports the same
constants core imports, but its `POSTGRES` and `REDIS` constants are
derived from the env values written in step 2. This avoids
`commander.parse()` side effects from production config and avoids the
core test config's hard-coded `localhost:6379` Redis target.

### `seed-auth.ts`

```ts
export interface SeededOwner {
  email: string
  password: string
  username: string
  userId: string
  bearerToken: string // Better Auth session token (bearer plugin)
  approvalHeaders: Headers // cookie-bearing owner headers for device approval
}
export async function seedOwnerAndWriteProfile(
  backend: E2EBackend,
  opts: { profile: string; tmpHome: string },
): Promise<SeededOwner>
```

Steps:

1. Directly insert a reader row with `role = 'owner'` via the backend's
   PG pool.
2. Hash the fixture password with Better Auth's password helper and
   insert the corresponding credential account row.
3. `backend.authApi.signInUsername({ body: {...}, returnHeaders: true })`
   — mint a session, preserve the `set-cookie` header as
   `approvalHeaders.cookie`, and extract the bearer token from
   `set-auth-token` or the returned session token shape.
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
   second profile to obtain owner `approvalHeaders`.
2. Spawn `mxs auth login --json --api-url <apiBase>` with the target
   profile in `MXS_PROFILE`. `--api-url` already takes precedence over
   any env source, so `MXS_API_URL` is not set.
3. Parse `user_code` from the JSON envelope on stdout. With `--json`,
   `mxs auth login` emits `verification_uri`,
   `verification_uri_complete`, `user_code`, `expires_in`, and `interval`
   under `data`; it intentionally does not emit `device_code`.
4. Use the cookie-bearing `approvalHeaders` returned by
   `seedOwnerAndWriteProfile`. A bearer header may be substituted only
   after proving Better Auth accepts bearer auth for device approval.
5. Call `deviceVerify` with query `{ user_code }`, then call
   `deviceApprove` with body `{ userCode: user_code }`. This mirrors the
   existing Better Auth device-flow contract and the public `/device`
   page.
6. Wait for the subprocess to exit; return the full stdio.

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

`runMxs` uses `spawn(process.execPath, ['--import',
import.meta.resolve('tsx'), BIN, ...args], { cwd: workspaceRoot, env: {
...process.env, ...env } })`.
`BIN` is resolved from `packages/cli/src/bin/mxs.ts` via
`fileURLToPath(import.meta.resolve(...))`.

### `redis-container.ts`

```ts
export async function startRedisTestContainer(): Promise<{
  uri: string // redis://host:port
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
      profile: 'post-crud',
      tmpHome: tmpHome.path,
    })
    env = {
      XDG_CONFIG_HOME: tmpHome.path,
      MXS_PROFILE: 'post-crud',
    }
  }, 60_000)

  afterAll(async () => {
    await backend.stop()
    cleanupHome()
  })

  it('creates → lists → gets → updates → deletes a post', async () => {
    const categoryName = `E2E ${Date.now()}`
    const category = await runMxs(
      [
        '--json',
        'category',
        'create',
        '--name',
        categoryName,
        '--slug',
        `e2e-${Date.now()}`,
      ],
      env,
    )
    expect(category.code).toBe(0)

    const created = await runMxs(
      [
        '--json',
        'post',
        'create',
        '--title',
        'hello e2e',
        '--slug',
        'hello-e2e',
        '--category',
        categoryName,
        '--format',
        'markdown',
        '--content',
        'first body',
      ],
      env,
    )
    expect(created.code).toBe(0)
    const id = (parseEnvelope(created.stdout).data as { id: string }).id

    const listed = await runMxs(['--json', 'post', 'list'], env)
    expect(
      (parseEnvelope(listed.stdout).data as { items: any[] }).items.map(
        (p) => p.id,
      ),
    ).toContain(id)

    const got = await runMxs(['--json', 'post', 'get', id], env)
    expect(getPayload(parseEnvelope(got.stdout).data)).toMatchObject({
      title: 'hello e2e',
    })

    const updated = await runMxs(
      ['--json', 'post', 'update', id, '--title', 'hello revised'],
      env,
    )
    expect(updated.code).toBe(0)

    const revised = await runMxs(['--json', 'post', 'get', id], env)
    expect(getPayload(parseEnvelope(revised.stdout).data)).toMatchObject({
      title: 'hello revised',
    })

    const deleted = await runMxs(
      ['--json', 'post', 'delete', id, '--force'],
      env,
    )
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
2. **Early-bound core configuration** — core imports read `~/app.config`
   at module evaluation time, and `postgres.provider.ts` caches the
   first pool/db. The e2e harness must enforce the sequence documented in
   `e2e-app.ts`: env first, dynamic imports second, `disposePool()` in
   cleanup. Any top-level value import from `apps/core` in an e2e helper
   is a correctness bug.
3. **Device-flow approval headers** — the Better Auth approval path is
   confirmed as `deviceVerify({ query: { user_code } })` followed by
   `deviceApprove({ body: { userCode } })`; the remaining implementation
   choice is whether to use cookie headers from `returnHeaders: true` or
   a verified bearer-compatible header. The helper must not assume bearer
   approval until that path is proven.
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

## Implementation notes (fidelity gaps)

These deviations from production were necessary at implementation time
and are intentional. They live in code with single-line comments at the
relevant sites:

- **`~/app.config` is aliased** to `packages/e2e/src/helpers/core-app-config.ts`
  via the vitest config. Production `apps/core/src/app.config.ts` reads
  YAML from `~/.config/mx-server`, which isn't available under CI. The
  alias mirrors the same exports but reads everything from env, so the
  harness can drive PG / Redis / JWT secrets through `seedProcessEnv`.
- **`~/utils/schedule.util` is mocked** in
  `packages/e2e/src/helpers/setup.ts` to make notify-manager batching
  synchronous. The real manager schedules through real microtasks, which
  races with vitest's hook scheduling. The mock keeps observable HTTP
  behaviour identical while removing the timing variable.
- **Redis container has a CI shortcut**: `startRedisTestContainer` honors
  `REDIS_VERIFY_URL` exactly the way `pg-testcontainer.ts` honors
  `PG_VERIFY_URL`. When the e2e job runs against the GH Actions
  `redis` service, no testcontainer is started; local runs without the
  env still spin a real `redis:7-alpine` container.

## Phase 2 — Coverage expansion

After the MVP four-file harness lands, the suite expands to cover every
non-MVP CLI surface and every output mode the renderer supports. The
expansion is split into structural axes — one for **business CRUD per
resource**, one for **output-format contract**, one for **skill
rendering**, one for **help rendering**, plus narrow files for
**AI management** and **file upload via local filesystem**.

### Scope decisions

| Axis | Decision |
| --- | --- |
| Matrix shape | Per-resource CRUD file (default mode only) + a dedicated `format-matrix` file that runs the five modes against representative commands. CRUD specs do not loop over modes. |
| AI coverage | Management-only — `list / get / by-article / edit / delete`. The generation pipeline (`regen / run / refresh`) is owned by `apps/core` faux e2e and is out of scope here. |
| File coverage | The server stores files on local disk (`STATIC_FILE_DIR`); no S3 stub is needed. Override the path to a tmp directory at backend boot. |
| Skill coverage | Every `mxs skill` verb is exercised once per declared mode (`readable / llm / xml`). |
| Help coverage | The custom-rendered surface (root + every group) is fully covered. Verb-level help, which `@effect/cli` renders, gets a sampled drift check (5 verbs). |

### New file layout

```
packages/e2e/test/
  resources/
    note-crud.test.ts
    page-crud.test.ts
    category-crud.test.ts
    comment-moderate.test.ts
    project-crud.test.ts
    snippet-crud.test.ts
    topic-crud.test.ts
    config-rw.test.ts                  # `config get`/`set`/`list`, not real CRUD
  ai/
    mgmt.test.ts                       # ai {summary,translate,insights} list/get/edit/delete + ai translate entries
  file/
    upload-flow.test.ts                # upload → list → rename → delete, asserting STATIC_FILE_DIR contents
  skill/
    list-output.test.ts                # mxs skill list × {readable,llm,xml}
    get-output.test.ts                 # mxs skill get <slug> × {readable,llm,xml}
    all-output.test.ts                 # mxs skill all × {readable,llm,xml}
    search-output.test.ts              # mxs skill search <kw> × {readable,llm,xml}
  help/
    root-help.test.ts                  # mxs / mxs --help (custom renderer)
    group-help.test.ts                 # mxs <group> / mxs <group> --help for each registered group
    verb-help-sample.test.ts           # mxs post create --help / mxs ai summary regen --help / etc — sampled drift check
  output/
    format-matrix.test.ts              # representative commands × {json,pretty-json,readable,llm,xml} + fallback contract
```

Adds ~16 files to the existing 4, ~20 total. Estimated CI wall-time at
~25s per file with 4 parallel workers: ~8–12 minutes for the e2e job.

### Mode contract — what `runAcrossModes` enforces

The CLI renderer (see `services/Renderer/service.ts`) follows three
unconditional rules:

1. **JSON family** (`--json`, `--output json`, `--output pretty-json`)
   — bypasses the view entirely. Always emits a well-formed JSON
   document to stdout.
2. **`readable`** — every view declares it; always renders. Color is
   off when stdout is not a TTY (the e2e harness's piped stdio).
3. **`llm` / `xml`** — render only if the view's `modes` set declares
   the mode. Otherwise the renderer writes
   `unsupported --output value for <kind>: <mode>` to stderr, emits no
   stdout, and the process exits 0.

`runAcrossModes(args, env, supports, assertions)` runs the same base
command five times, one per mode, and:

- For modes flagged `supports.<mode> = true`: runs the user-provided
  assertion against parsed stdout.
- For modes flagged `false`: asserts stderr contains
  `unsupported --output value for` and stdout is empty.

The format-matrix file uses this against a small representative set —
`auth status` (no llm/xml — `emitView` path), `post list` (View with
declared modes), `skill list` (View declaring readable/llm/xml),
`category list` (typed View) — to pin the renderer contract as the
living documentation of which view declares what.

### New helpers

#### `seed-ai-artifact.ts`

```ts
export async function seedAiFixture(
  backend: E2EBackend,
): Promise<{
  articleId: string
  summaryId: string
  translationId: string
  translationEntryId: string
  insightId: string
}>
```

Inserts one post row, one summary row, one translation row with one
entry, and one insight row directly via `backend.pgPool`. Exact column
names follow `apps/core/src/database/schema/ai-*.ts` — confirmed at
implementation time. Management commands then have stable artifacts to
list / get / edit / delete against.

#### `with-static-file-tmp.ts`

```ts
export function overrideStaticFileDir(path: string): void
```

Sets `process.env.STATIC_FILE_DIR` and `process.env.STATIC_FILE_TRASH_DIR`
to a tmp directory **before** `createE2EBackend` triggers the dynamic
import of `~/constants/path.constant`. The file-upload spec asserts
both the wire response (`mxs file upload <local-path>` returns a name +
url) and the on-disk presence of the bytes under the overridden path.

#### `assert-view.ts` — `runAcrossModes`

```ts
export interface ModeSupport {
  json?: boolean        // default true
  prettyJson?: boolean  // default true
  readable?: boolean    // default true
  llm?: boolean         // default false — view must declare it
  xml?: boolean         // default false
}

export interface ModeAssertions {
  json?: (env: { ok: boolean; data: unknown }) => void
  prettyJson?: (parsed: unknown) => void
  readable?: (raw: string) => void
  llm?: (raw: string) => void
  xml?: (raw: string) => void
}

export async function runAcrossModes(
  baseArgs: readonly string[],
  env: Record<string, string>,
  supports: ModeSupport,
  assertions: ModeAssertions,
): Promise<void>
```

Internally invokes `runMxs` five times, one per mode, with the right
flag injection:

| Mode | Flag injection |
| --- | --- |
| json | `[...baseArgs, '--json']` |
| pretty-json | `[...baseArgs, '--output', 'pretty-json']` |
| readable | `baseArgs` (default) |
| llm | `[...baseArgs, '--output', 'llm']` |
| xml | `[...baseArgs, '--output', 'xml']` |

For unsupported modes, asserts the stderr unsupported-warning pattern
and zero stdout. For supported modes, runs the per-mode assertion fn.

#### `runMxs` extension

Adds an optional `mode?: OutputMode` parameter. When provided, the flag
is injected automatically — eliminating manual `--output <mode>`
duplication across resource specs.

### Phase 2 risks

1. **AI mgmt schema drift** — `seed-ai-artifact.ts` writes directly to
   the AI tables. Column names (snake_case in PG) must mirror the
   Drizzle schema. Schema drift breaks fixtures silently; mitigated by
   sourcing column names from the schema files at implementation time
   and adding a smoke check that asserts the fixture inserts before
   running the management commands.
2. **`STATIC_FILE_DIR` evaluation timing** — if `~/constants/path.constant`
   reads the env at module-load and is imported anywhere before the
   override, the wrong path locks in. The helper must set env in the
   same beforeAll step that precedes `createE2EBackend`, and no e2e
   helper may transitively import the path module at the top level.
3. **Skill content drift** — `skills/*.md` content changes ship with
   every release; `@haklex/rich-litexml` chapters ship independently.
   Assertions must use structural contracts — slug presence, mode
   separator shape (`\t` for skill-list llm, `\n\n---\n\n` for skill-all
   llm, `<chapter>` root for xml) — never literal body matching.
4. **Help false positives** — group / verb lists are generated from the
   help registry. Future additions extend the rendered output. Specs
   must use containment assertions, not exact-equals, against the
   group / verb sections.
5. **CI wall-time scaling** — moving from 4 to ~20 spec files multiplies
   container spin-up cost. Cap with `vitest --pool=forks
   --poolOptions.forks.maxForks=4` to stay within a 2 vCPU runner; the
   per-worker base PG container is reused via `PG_VERIFY_URL`, so DB
   isolation comes only from `createIsolatedPgDatabase`.
6. **Format-matrix redundancy** — the JSON family and readable modes
   are kind-agnostic in the renderer. Validating them on four different
   commands tests the same code path repeatedly. The format-matrix
   file should run the kind-agnostic checks once (on `post list`), and
   reserve the multi-command sweep for the `llm`/`xml` declarations
   that actually differ per view.

### Phase 2 open issues (resolved at implementation time)

- **`mxs ai task` surface** — the ROADMAP lists `mxs ai tokens` for a
  later milestone, but task listing / cancellation surfaces are
  unclear at spec time. AI mgmt spec assumes only the four
  resources (summary, translate, insights, translate entries) with
  `list / get / by-article / edit / delete` verbs and confirms each
  exists before scoping the spec body.
- **`mxs ai translate entries` surface stability** — assertions stay on
  the envelope shape (`{ok:true, data:{items:[...]}}`) rather than the
  inner entry fields, so v0.13.x churn doesn't immediately break the
  spec.
- **Config CRUD verbs** — `mxs config` is read/write, not full CRUD.
  Spec file named `config-rw.test.ts` accordingly.

## Future work

- AI generation pipeline coverage (`regen / run / refresh`) using an
  in-process pi faux adapter, gated behind a separate label or matrix
  flag.
- `pnpm dev` boot-health CI job — start production entrypoint, assert
  one curl request, SIGTERM.
- Bundled binary smoke — single spec that runs `node bin/mxs.cjs` against
  a freshly-built `dist/`.
- Shared Redis container with per-file key prefix once file count > 30.
- `CREATE DATABASE … TEMPLATE` to skip per-file migration once file
  count > 30.
