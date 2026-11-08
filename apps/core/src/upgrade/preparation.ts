import { defaultKeyHasher } from '@better-auth/api-key'
import { symmetricEncrypt } from 'better-auth/crypto'
import type { Pool } from 'pg'

import { backfillAiMetrics } from '../database/app-migrations/20261108-ai-metrics-coverage'
import { HASHED_API_KEY_CONFIG_ID } from '../modules/auth/auth.constant'
import { CONFIG_FORMAT_MIGRATION_ID } from '../shared/config-format'
import { SecretCodec } from '../utils/secret-codec'
import { migrateConfiguration } from './config-migration'
import { unwrapOAuthToken } from './oauth-token'
import {
  CONFIG_UPGRADE_LOCK,
  oauthKey,
  PREPARED_MIGRATION_ID,
  readUpgradeState,
  type UpgradeConfig,
} from './readiness'

export class UpgradeError extends Error {
  constructor(
    public readonly code: string,
    public readonly path?: string,
  ) {
    super(path ? `${code} (${path})` : code)
  }
}

export async function prepareUpgrade(
  pool: Pool,
  config: UpgradeConfig,
  options: { allReplicasV2: boolean; dryRun?: boolean },
) {
  if (!options.allReplicasV2)
    throw new UpgradeError('REPLICA_CONFIRMATION_REQUIRED')
  const client = await pool.connect()
  const codec = new SecretCodec(config)
  let changed = 0
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout = '10s'")
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      CONFIG_UPGRADE_LOCK,
    ])
    const before = await readUpgradeState(client, config)
    const allowed = new Set([
      'CREDENTIALS_NEED_PREPARATION',
      'LEGACY_CONFIG',
      'METRICS_INCOMPLETE',
      'PREPARATION_MARKER_MISSING',
    ])
    const blocking = before.issues.find((issue) => !allowed.has(issue.code))
    if (blocking) throw new UpgradeError(blocking.code, blocking.path)
    changed += await migrateConfiguration(client, codec)
    for (const table of ['snippets', 'webhooks']) {
      for (const row of (
        await client.query(`SELECT id, secret FROM ${table} FOR UPDATE`)
      ).rows) {
        if (!row.secret) continue
        const secret = codec.encrypt(row.secret, `${table}.${row.id}.secret`)
        if (secret === row.secret) continue
        await client.query(`UPDATE ${table} SET secret = $1 WHERE id = $2`, [
          secret,
          row.id,
        ])
        changed++
      }
    }
    for (const row of (
      await client.query(
        'SELECT id, key, config_id, user_id, reference_id, start FROM api_keys FOR UPDATE',
      )
    ).rows) {
      if (row.config_id === HASHED_API_KEY_CONFIG_ID) continue
      await client.query(
        'UPDATE api_keys SET key = $1, config_id = $2, reference_id = $3, start = $4 WHERE id = $5',
        [
          await defaultKeyHasher(row.key),
          HASHED_API_KEY_CONFIG_ID,
          row.reference_id || row.user_id,
          row.start || row.key.slice(0, 6),
          row.id,
        ],
      )
      changed++
    }
    for (const row of (
      await client.query(
        'SELECT id, access_token, refresh_token FROM accounts FOR UPDATE',
      )
    ).rows) {
      for (const field of ['access_token', 'refresh_token']) {
        const token = row[field]
        if (!token || token.startsWith('$ba$')) continue // Authenticated by readUpgradeState.
        const encrypted = await symmetricEncrypt({
          key: oauthKey(config.jwtSecret),
          data: await unwrapOAuthToken(token, config.jwtSecret),
        })
        await client.query(`UPDATE accounts SET ${field} = $1 WHERE id = $2`, [
          encrypted,
          row.id,
        ])
        changed++
      }
    }
    changed += await backfillAiMetrics(client)
    const after = await readUpgradeState(client, config)
    const residual = after.issues.find(
      (issue) => issue.code !== 'PREPARATION_MARKER_MISSING',
    )
    if (residual) throw new UpgradeError(residual.code, residual.path)
    if (!after.prepared) {
      await client.query(
        'INSERT INTO _app_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
        [PREPARED_MIGRATION_ID],
      )
    }
    await client.query(
      'INSERT INTO _app_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
      [CONFIG_FORMAT_MIGRATION_ID],
    )
    await client.query(options.dryRun ? 'ROLLBACK' : 'COMMIT')
    return {
      status: options.dryRun ? 'would-be-ready' : 'prepared',
      dryRun: !!options.dryRun,
      changed,
      requiresRestart: !options.dryRun,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error instanceof UpgradeError
      ? error
      : new UpgradeError('UPGRADE_PREPARATION_FAILED')
  } finally {
    client.release()
  }
}
