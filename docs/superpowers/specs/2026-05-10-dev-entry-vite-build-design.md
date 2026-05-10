# Dev entry consolidation & Vite build replacement

**Date:** 2026-05-10
**Scope:** `apps/core/` only
**Status:** Draft, awaiting review

## Goals

1. **One process for `pnpm dev`.** Today, `predev` spawns `vite-node src/migrate.ts` to run schema + app-data migrations, then `dev` spawns `nodemon` → `vite-node src/main.ts`. Two cold starts. Collapse to one.
2. **Move app-data migrations into the main app's lifecycle.** They are already idempotent (advisory lock + `_app_migrations` ledger), so wiring them into Nest boot makes a separate Nest context unnecessary in dev — and the same module can be reused by the standalone CLI for prod.
3. **Replace `tsdown` with `vite build` (rolldown under the hood).** Single bundler for dev (vite-node) and prod (vite build). Remove `tsdown` devDep + config.

## Non-goals

- Migration content / lock semantics / ledger schema — unchanged.
- The `m.up({ app, logger })` migration API surface — unchanged.
- Production docker compose flow (`mx-migrate` service still runs `node migrate.mjs` chaining schema + app-data) — unchanged.
- Test setup, vitest config, testcontainer flow — unchanged.

## Architecture

### A. App-migrations as a Nest service

**New files:**

- `src/database/app-migrations/app-migrations.service.ts`
  - Injects `PG_DB_TOKEN` (`AppDatabase`) and `PG_POOL_TOKEN` (`pg.Pool`).
  - Exposes `async run(app: INestApplication): Promise<void>`.
  - Body is the inner block of the current `runAppMigrations()` (everything after `NestFactory.createApplicationContext` and before `app.close()`): advisory lock via `withAdvisoryLock(pool, APP_MIGRATION_LOCK_KEY, ...)`, query ledger, sort registry, iterate, run pending `m.up({ app, logger })`, insert ledger row.
- `src/database/app-migrations/app-migrations.module.ts`
  - `@Module({ providers: [AppMigrationsService], exports: [AppMigrationsService] })`.

**Wiring:**

- `app.module.ts` — `AppMigrationsModule` added to `imports`. The service is registered in DI graph in every mode; running it is a separate explicit call.
- `bootstrap.ts` — between `NestFactory.create` and `app.listen`, gate on `isDev && !isTest` and call `await app.get(AppMigrationsService).run(app)`. This is the only path that triggers app migrations during dev/main boot.

**Standalone CLI (`src/app-migrate.ts`):**

- Body slimmed: still boots its own Nest application context (`NestFactory.createApplicationContext(AppModule.register(false))`), but instead of duplicating the loop, calls `app.get(AppMigrationsService).run(app)` then closes.
- Exported `runAppMigrations()` keeps its name and signature for the migrate.ts chain (no caller change).
- CLI guard (`isCliEntry()`) preserved.

### B. Schema migration entry

`src/migrate.ts` changes:

- Lift the existing `runSchemaMigrations()` and `main()` so `runSchemaMigrations` is exported (it already exists as a top-level function). The chained `main()` (schema → dynamic-import app-migrate) is wrapped in a CLI guard mirroring `app-migrate.ts`:

  ```ts
  function isCliEntry(): boolean { /* same as app-migrate.ts */ }

  if (isCliEntry()) {
    main()
      .then(() => process.exit(0))
      .catch((err) => { console.error('[migrate] failed:', err); process.exit(1) })
  }
  ```

- This means `node migrate.mjs` (docker `mx-migrate`) and `pnpm migrate` continue to run both phases. Importing the module from `dev.ts` does **not** trigger the chain.

### C. Dev entry

**New file: `src/dev.ts`**

```ts
import 'dotenv-expand/config'

import cluster from 'node:cluster'

async function main() {
  // Workers re-execute this script on cluster.fork; gate migrations on primary.
  if (cluster.isPrimary) {
    const { runSchemaMigrations } = await import('./migrate')
    await runSchemaMigrations()
  }
  const { startMain } = await import('./main')
  await startMain()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[dev] fatal:', err)
  process.exit(1)
})
```

App migrations are NOT run from `dev.ts` directly — they fire inside `bootstrap.ts` via `AppMigrationsService.run(app)` once the Nest app is created. That keeps the migration work inside the live DI graph and avoids a second Nest boot.

**`src/main.ts` refactor:**

- Existing top-level `main()` becomes `export async function startMain()`.
- Add `isCliEntry()` guard so `node main.mjs` (prod via pm2 ecosystem) keeps booting on import.

### D. Package.json scripts

```diff
- "dev": "npm run start",
- "predev": "cross-env NODE_ENV=development npm run migrate",
+ "dev": "cross-env NODE_ENV=development nodemon --watch src --ext ts,json --exec \"vite-node src/dev.ts\"",
- "start": "cross-env NODE_ENV=development nodemon --watch src --ext ts,json --exec \"vite-node src/main.ts\"",
- "start:debug": "cross-env NODE_ENV=development nodemon --watch src --ext ts,json --exec \"node --inspect --import vite-node/register src/main.ts\"",
+ "start:debug": "cross-env NODE_ENV=development nodemon --watch src --ext ts,json --exec \"node --inspect --import vite-node/register src/dev.ts\"",
- "start:cluster": "cross-env NODE_ENV=development nodemon --watch src --ext ts,json --exec \"vite-node src/main.ts -- --cluster --cluster_workers 2\"",
+ "start:cluster": "cross-env NODE_ENV=development nodemon --watch src --ext ts,json --exec \"vite-node src/dev.ts -- --cluster --cluster_workers 2\"",
```

`migrate`, `migrate:app`, `start:prod`, `prod`, `prod:pm2`, `prod:stop`, `prod:debug`, `test`, `lint`, `bundle` semantics preserved (only `bundle` switches to vite — see §E).

`dev:encrypt` now points at `npm run dev` (preserving today's `npm run start -- --encrypt_*` shape).

### E. Vite build (`tsdown` → `vite build`)

**New file: `apps/core/build.config.ts`** (separate from `vite.config.ts` so vite-node dev keeps its own config):

```ts
import swc from 'unplugin-swc'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  // esbuild can not emit ts decorator metadata
  esbuild: false,
  plugins: [swc.vite(), tsconfigPaths()],
  ssr: {
    // Inline every dependency; matches tsdown's `noExternal: () => true`
    noExternal: true,
    target: 'node',
  },
  build: {
    outDir: 'out',
    emptyOutDir: true,
    target: 'node22',
    sourcemap: true,
    minify: false,
    ssr: true,
    rolldownOptions: {
      input: {
        main: 'src/main.ts',
        migrate: 'src/migrate.ts',
        'app-migrate': 'src/app-migrate.ts',
      },
      output: {
        format: 'esm',
        entryFileNames: '[name].mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
      },
      external: [
        // Native modules — installed at runtime by `requireDepsWithInstall`,
        // must NOT be bundled.
        'sharp',
      ],
    },
  },
})
```

**`package.json`:**

- `bundle` → `vite build --config build.config.ts`
- `prebuild` keeps `rimraf dist` (`emptyOutDir: true` already clears `out/`).
- Drop `tsdown` from `devDependencies`.
- Drop `tsdown.config.ts`.

**Output parity check:** `out/main.mjs`, `out/migrate.mjs`, `out/app-migrate.mjs` — same filenames as today's tsdown output. `ecosystem.config.cjs` references `./main.mjs`; docker compose references `migrate.mjs`. Both still resolve.

## Cluster + worker semantics

| Mode | Primary | Worker (after `cluster.fork`) |
|---|---|---|
| `pnpm dev` (cluster off) | runs schema migrations → `startMain` → `bootstrap` → `AppMigrationsService.run` (isDev) → listen | n/a |
| `pnpm start:cluster` | runs schema migrations → `startMain` → `Cluster.register` forks N workers → primary idles | re-executes `dev.ts` from top → `cluster.isPrimary === false` so skips schema → `startMain` → `Cluster.register` sees worker → calls `bootstrap` → `AppMigrationsService.run` (isDev). Advisory lock + ledger ensure only one worker actually applies; others observe ledger and no-op. |
| `node main.mjs` (prod) | `isCliEntry()` triggers `startMain` → `bootstrap` → `isDev` is false, **skips** `AppMigrationsService.run` → listen | same — workers also skip; app migrations were applied by `mx-migrate` service |

## Risks & mitigations

1. **vite 8 SSR multi-entry inlining edge cases.** `ssr.noExternal: true` + `build.ssr: true` + multiple entries via `rolldownOptions.input` is supported but less travelled than single-entry. Verify on first build that all three entries emit and that `main.mjs` boots locally with `NODE_ENV=production node out/main.mjs`. Fallback: run with `noExternal` on a per-package allowlist if a particular dep mis-bundles.
2. **Decorator metadata.** Required by Nest DI. `unplugin-swc` is already wired into `vite.config.ts` (dev/test) and reused in `build.config.ts`; this is the same path that works today for `vite-node`.
3. **Native modules.** `sharp` (and any future `pg-native` etc.) must be `external`. `requireDepsWithInstall('sharp')` resolves at runtime against `node_modules`, so leaving sharp external preserves current behaviour. If `vite build` complains about other native deps, add them to the `external` array.
4. **CJS interop / shims.** tsdown emits `shims: true` (mainly `__dirname` / `require`). After switch, audit for top-level `__dirname` / `require` usage and replace with `import.meta.url` / `createRequire`. Most modules are already ESM-clean; `ecosystem.config.cjs` is bypass'd because pm2 reads it directly.
5. **`initializeApp()` called twice in dev** (no-op idempotent — `mkdirSync(..., { recursive: true })`, env writes, `globalThis` assigns), once by `app-migrate.ts`'s legacy path if used standalone, once by `bootstrap.ts`. In dev's new path it's only called once via `bootstrap` → not via `app-migrate.ts`. Existing `app-migrate.ts` CLI keeps calling it itself; safe.
6. **Test mode.** `bootstrap.ts` gates `AppMigrationsService.run` on `isDev && !isTest`. Vitest sets `NODE_ENV=development` so `isDev` is true; `isTest` provides the second guard so the dev-only run does not fire under vitest.

## Migration steps (overview, not implementation)

1. Add `AppMigrationsModule` + `AppMigrationsService`; register in `AppModule`.
2. Refactor `app-migrate.ts` to delegate to the service; verify CLI still works (`pnpm migrate:app`).
3. Refactor `migrate.ts` to expose `runSchemaMigrations` (already exported) and gate the chain on `isCliEntry()`. Verify `pnpm migrate` still chains schema + app-data.
4. Refactor `main.ts`: rename `main()` → exported `startMain()`, add `isCliEntry()` guard. Verify production entry (`node out/main.mjs`) still boots.
5. Add `bootstrap.ts` call to `AppMigrationsService.run(app)` under `isDev && !isTest`.
6. Add `src/dev.ts`. Update package.json scripts (`dev`, `start:debug`, `start:cluster`, drop `predev`, retarget `start`).
7. Add `apps/core/build.config.ts`. Update `bundle` script. Drop `tsdown.config.ts` and the `tsdown` devDep.
8. Verify locally: `pnpm dev`, `pnpm start:cluster`, `pnpm migrate`, `pnpm migrate:app`, `pnpm bundle && NODE_ENV=production node out/main.mjs`.
9. Verify in a docker-compose run that `mx-migrate` (`node migrate.mjs`) still completes.

## Open questions

None outstanding. Implementation plan is the next step.
