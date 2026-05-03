#!/usr/bin/env node
/**
 * Mongo → PostgreSQL data migration CLI.
 *
 * Usage:
 *   tsx scripts/migrate-mongo-to-postgres.ts --mode dry-run
 *   tsx scripts/migrate-mongo-to-postgres.ts --mode apply
 *
 * Environment variables:
 *   MONGO_URI              source MongoDB connection string
 *   PG_URL / PG_*          target PostgreSQL settings (see app.config)
 *   SNOWFLAKE_WORKER_ID    worker id for migration-generated rows; reserve 900-999
 *
 * The dry-run mode reads the source database, allocates Snowflake IDs in memory,
 * resolves all references to validate they will succeed, and emits the same
 * report that apply mode would produce — but writes nothing to PostgreSQL.
 */
import process from 'node:process'

const cliArgs = process.argv.slice(2)
const mode = cliArgs.includes('--mode')
  ? (cliArgs[cliArgs.indexOf('--mode') + 1] as 'dry-run' | 'apply')
  : 'dry-run'

if (mode !== 'dry-run' && mode !== 'apply') {
  console.error(`unknown mode "${mode}" (expected dry-run | apply)`)
  process.exit(2)
}

// Strip migration-only flags before app.config's commander sees them.
process.argv = [process.argv[0], process.argv[1]]

const mongoUri =
  process.env.MONGO_URI ||
  process.env.DB_CONNECTION_STRING ||
  'mongodb://127.0.0.1:27017/mx-space'

const pgUrl =
  process.env.PG_URL ||
  process.env.PG_CONNECTION_STRING ||
  `postgres://${process.env.PG_USER ?? 'mx'}:${process.env.PG_PASSWORD ?? 'mx'}@${process.env.PG_HOST ?? '127.0.0.1'}:${process.env.PG_PORT ?? 5432}/${process.env.PG_DATABASE ?? 'mx_core'}`

async function main() {
  const path = (await import('node:path')).default
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { migrate } = await import('drizzle-orm/node-postgres/migrator')
  const { MongoClient } = await import('mongodb')
  const { Pool } = await import('pg')
  const { formatReport, runMigration } =
    await import('../src/migration/postgres-data-migration/runner.js')

  const summarizeUrl = (raw: string): string => {
    try {
      const u = new URL(raw)
      const target = u.pathname.replace(/^\//, '') || '(default)'
      return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}/${target}`
    } catch {
      return '(unparsable URL — connection details elided)'
    }
  }

  console.log(`Mongo → PostgreSQL migration (${mode})`)
  console.log(`  mongo: ${summarizeUrl(mongoUri)}`)
  console.log(`  pg:    ${summarizeUrl(pgUrl)}`)

  const mongo = new MongoClient(mongoUri)
  await mongo.connect()
  const mongoDb = mongo.db()

  const pool = new Pool({ connectionString: pgUrl })
  const pg = drizzle(pool, { casing: 'snake_case' })

  if (mode === 'apply') {
    const migrationsFolder = path.resolve(
      import.meta.dirname,
      '..',
      'src',
      'database',
      'migrations',
    )
    console.log(`  applying schema migrations from ${migrationsFolder}`)
    await migrate(pg, { migrationsFolder })
  }

  try {
    const report = await runMigration({
      mode,
      mongo: mongoDb,
      pg,
      workerId: Number(process.env.SNOWFLAKE_WORKER_ID ?? 900),
    })
    console.log('\n' + formatReport(report))
    if (report.missingRefs.length > 0) {
      console.warn(
        `\n⚠️  ${report.missingRefs.length} missing references — review before proceeding to apply mode.`,
      )
      process.exitCode = 1
    } else {
      console.log('\n✅ Migration finished without missing references.')
    }
  } finally {
    await mongo.close()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('migration failed:', err)
  process.exit(1)
})
