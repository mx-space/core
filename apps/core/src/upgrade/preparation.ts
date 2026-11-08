import { isDeepStrictEqual } from 'node:util'

import { defaultKeyHasher } from '@better-auth/api-key'
import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import { symmetricEncrypt } from 'better-auth/crypto'
import type { Pool } from 'pg'

import { backfillAiMetrics } from '../database/app-migrations/20261108-ai-metrics-coverage'
import { HASHED_API_KEY_CONFIG_ID } from '../modules/auth/auth.constant'
import { visitConfigSecrets } from '../modules/configs/configs.secret-paths'
import {
  canonicalConfigRows,
  normalizeLegacyConfig,
} from '../modules/configs/legacy-config.util'
import { SecretCodec } from '../utils/secret-codec'
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
  const codec = new SecretCodec({ ...config, v2: true })
  const ids = new SnowflakeGenerator({ workerId: 1023 })
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
    const rows = (
      await client.query(
        'SELECT id, name, value FROM options ORDER BY name FOR UPDATE',
      )
    ).rows
    const raw = Object.fromEntries(rows.map((row) => [row.name, row.value]))
    for (const key of [
      'ai',
      'membership',
      'thirdPartyServiceIntegration',
      'imageGenerationOptions',
      'ttsOptions',
    ]) {
      if (
        key in raw &&
        (!raw[key] || typeof raw[key] !== 'object' || Array.isArray(raw[key]))
      )
        throw new UpgradeError('CONFIG_SHAPE_UNSUPPORTED', key)
    }
    const plaintext = Object.fromEntries(
      rows.map((row) => [
        row.name,
        visitConfigSecrets(row.value, row.name, (secret, path) =>
          codec.decrypt(secret, path),
        ),
      ]),
    )
    const canonical = canonicalConfigRows(normalizeLegacyConfig(plaintext))
    const names = new Set(rows.map((row) => row.name))
    if (names.has('imageGenerationOptions') || names.has('ttsOptions'))
      names.add('ai')
    names.delete('imageGenerationOptions')
    names.delete('ttsOptions')
    for (const name of names) {
      const value = canonical[name] ?? plaintext[name]
      const encrypted = visitConfigSecrets(value, name, (secret, path) => {
        const previous = path
          .split('.')
          .reduce<any>((node, part) => node?.[part], raw)
        return typeof previous === 'string' &&
          codec.isEncryptedString(previous) &&
          codec.decrypt(previous, path) === secret
          ? codec.encrypt(previous, path)
          : codec.encrypt(secret, path)
      })
      if (isDeepStrictEqual(encrypted, raw[name])) continue
      await client.query(
        'INSERT INTO options (id, name, value) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET value = excluded.value',
        [ids.nextId(), name, JSON.stringify(encrypted)],
      )
      changed++
    }
    changed +=
      (
        await client.query(
          "DELETE FROM options WHERE name IN ('imageGenerationOptions', 'ttsOptions')",
        )
      ).rowCount ?? 0
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
