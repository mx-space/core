/**
 * Dev entry. Runs schema migrations in-process, then hands off to the same
 * boot path used by prod. App-data migrations fire from `bootstrap.ts` once
 * the Nest app is created (gated on `isDev && !isTest`).
 *
 * In cluster mode, workers re-execute this script after `cluster.fork`, so
 * schema migrations are gated on `cluster.isPrimary` to avoid every worker
 * acquiring the schema advisory lock at boot.
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

main().catch((err) => {
  console.error('[dev] fatal:', err)
  process.exit(1)
})
