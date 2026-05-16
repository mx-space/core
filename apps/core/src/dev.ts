/**
 * Dev entry. Runs schema migrations in-process, then hands off to the same
 * boot path used by prod. App-data migrations fire from `bootstrap.ts` once
 * the Nest app is created (gated on `isDev && !isTest`).
 *
 * In cluster mode, workers re-execute this script after `cluster.fork`, so
 * schema migrations are gated on `cluster.isPrimary` to avoid every worker
 * acquiring the schema advisory lock at boot.
 *
 * NOTE: `await main()` at top level (rather than `main().catch(...)`) keeps
 * vite-node's dev server alive while the bootstrap chain finishes loading.
 * vite-node closes the server once the entry script's synchronous segment
 * completes; without top-level await, late `?raw` transformRequests (e.g.
 * the embedded template imports in `~/embed`) race the closure and surface
 * as `ERR_CLOSED_SERVER`.
 */
import 'dotenv-expand/config'

import cluster from 'node:cluster'

async function main() {
  if (cluster.isPrimary) {
    const { runSchemaMigrations } = await import('./migrate')
    await runSchemaMigrations()
  }
  const { startMain } = await import('./main')
  await startMain()
}

try {
  await main()
} catch (err) {
  console.error('[dev] fatal:', err)
  process.exit(1)
}
