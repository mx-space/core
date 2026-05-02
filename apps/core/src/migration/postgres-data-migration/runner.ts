import type { Db } from 'mongodb'

import { dataMigrationRuns } from '~/database/schema'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { SnowflakeGenerator } from '~/shared/id/snowflake.service'

import { persistIdMap } from './id-map'
import { ALL_STEPS } from './steps'
import type { MigrationContext, MigrationMode, MigrationReport } from './types'

export async function runMigration(input: {
  mode: MigrationMode
  mongo: Db
  pg: AppDatabase
  workerId?: number
}): Promise<MigrationReport> {
  const ctx: MigrationContext = {
    mode: input.mode,
    mongo: input.mongo,
    pg: input.pg,
    snowflake: new SnowflakeGenerator({
      workerId: input.workerId ?? 900,
    }),
    idMap: new Map(),
    reports: {
      rowsRead: {},
      rowsLoaded: {},
      missingRefs: [],
      duplicateKeys: [],
      warnings: [],
      startedAt: new Date(),
    },
  }

  // Phase 1: allocate Snowflake IDs for every collection.
  for (const step of ALL_STEPS) {
    if (!step.allocate) continue
    await step.allocate(ctx)
  }

  // Persist id map first so resumed runs can pick up where they left off.
  if (input.mode === 'apply') {
    await persistIdMap(ctx)
  }

  // Phase 2: load rows in dependency order.
  for (const step of ALL_STEPS) {
    if (!step.load) continue
    await step.load(ctx)
  }

  ctx.reports.finishedAt = new Date()

  if (input.mode === 'apply') {
    await input.pg
      .insert(dataMigrationRuns)
      .values({
        id: ctx.snowflake.nextBigInt(),
        name: `mongo-to-pg-${ctx.reports.startedAt.toISOString()}`,
        startedAt: ctx.reports.startedAt,
        finishedAt: ctx.reports.finishedAt,
        status:
          ctx.reports.missingRefs.length > 0
            ? 'completed-with-warnings'
            : 'completed',
        error:
          ctx.reports.missingRefs.length > 0
            ? `${ctx.reports.missingRefs.length} missing refs`
            : null,
      })
      .onConflictDoNothing()
  }

  return ctx.reports
}

export function formatReport(report: MigrationReport): string {
  const sections: string[][] = []

  const header = [
    `Migration started:  ${report.startedAt.toISOString()}`,
    report.finishedAt
      ? `Migration finished: ${report.finishedAt.toISOString()}`
      : null,
  ].filter((s): s is string => Boolean(s))
  sections.push(header)

  sections.push([
    'Rows allocated:',
    ...Object.entries(report.rowsRead).map(
      ([coll, n]) => `  ${coll.padEnd(28)} ${n}`,
    ),
  ])

  sections.push([
    'Rows loaded:',
    ...Object.entries(report.rowsLoaded).map(
      ([coll, n]) => `  ${coll.padEnd(28)} ${n}`,
    ),
  ])

  if (report.missingRefs.length > 0) {
    const sample = report.missingRefs
      .slice(0, 50)
      .map((r) => `  ${r.collection}.${r.field} -> ${r.mongoId}`)
    const overflow =
      report.missingRefs.length > 50
        ? [`  …and ${report.missingRefs.length - 50} more`]
        : []
    sections.push([
      `Missing refs (${report.missingRefs.length}):`,
      ...sample,
      ...overflow,
    ])
  }

  if (report.warnings.length > 0) {
    const sample = report.warnings
      .slice(0, 50)
      .map((w) => `  ${w.collection} ${w.mongoId}: ${w.reason}`)
    sections.push([`Warnings (${report.warnings.length}):`, ...sample])
  }

  return sections.map((s) => s.join('\n')).join('\n\n')
}

// Re-export for convenience.
export { dataMigrationRuns }
export type { MigrationContext, MigrationMode, MigrationReport } from './types'
