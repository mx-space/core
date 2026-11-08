import type { Pool, PoolClient } from 'pg'

import { HASHED_API_KEY_CONFIG_ID } from '../modules/auth/auth.constant'
import { configSchemaMapping } from '../modules/configs/configs.schema'
import { visitConfigSecrets } from '../modules/configs/configs.secret-paths'
import {
  LegacyConfigConflictError,
  normalizeLegacyConfig,
} from '../modules/configs/legacy-config.util'
import { SecretCodec } from '../utils/secret-codec'
import { isEncryptedOAuth, unwrapOAuthToken } from './oauth-token'

export { oauthKey } from './oauth-token'

export const PREPARED_MIGRATION_ID = '20261108-v18-prepared'
export { CONFIG_UPGRADE_LOCK } from '../shared/config-lock'
export type UpgradeConfig = {
  key: string
  jwtSecret: string
  enable: boolean
  v2: boolean
  algorithm?: string
}
export type UpgradeIssue = { code: string; path?: string }
export type UpgradeReport = {
  target: 18
  status: 'ready' | 'needs-action' | 'error'
  installation: 'empty' | 'existing'
  prepared: boolean
  counts: {
    plaintext: number
    ecb: number
    v2: number
    legacyConfig: number
    plainApiKeys: number
    hashedApiKeys: number
    plainOAuth: number
    encryptedOAuth: number
    metricsMissing: number
  }
  issues: UpgradeIssue[]
}
export type UpgradeDatabase = Pick<Pool | PoolClient, 'query'>

export function isLegacyConfig(name: string, value: any): boolean {
  return (
    name === 'imageGenerationOptions' ||
    name === 'ttsOptions' ||
    (name === 'ai' && value?.version !== 2) ||
    (name === 'thirdPartyServiceIntegration' &&
      value &&
      typeof value === 'object' &&
      'githubToken' in value) ||
    (name === 'membership' &&
      value &&
      typeof value === 'object' &&
      ['dodoApiKey', 'dodoEnvironment', 'dodoWebhookKey'].some(
        (key) => key in value,
      ))
  )
}

/** Read-only and independent of app.config, Nest bootstrap, Redis and business modules. */
export async function readUpgradeState(
  database: UpgradeDatabase,
  config: UpgradeConfig,
): Promise<UpgradeReport> {
  const issues: UpgradeIssue[] = []
  const keyValid = /^[\da-f]{64}$/i.test(config.key)
  if (!config.key) issues.push({ code: 'FIELD_KEY_MISSING' })
  else if (!keyValid) issues.push({ code: 'FIELD_KEY_INVALID' })
  if (!config.enable) issues.push({ code: 'ENCRYPTION_DISABLED' })
  if (config.jwtSecret.length < 32) issues.push({ code: 'JWT_TOO_SHORT' })
  if (!config.v2) issues.push({ code: 'V2_WRITES_DISABLED' })
  const counts: UpgradeReport['counts'] = {
    plaintext: 0,
    ecb: 0,
    v2: 0,
    legacyConfig: 0,
    plainApiKeys: 0,
    hashedApiKeys: 0,
    plainOAuth: 0,
    encryptedOAuth: 0,
    metricsMissing: 0,
  }
  const codec = new SecretCodec({ ...config, enable: true, v2: true })
  const inspect = (secret: string, path: string) => {
    if (!secret) return secret
    if (secret.startsWith('$${mx}$$v2.')) counts.v2++
    else if (codec.isEncryptedString(secret)) counts.ecb++
    else counts.plaintext++
    if (keyValid && codec.isEncryptedString(secret)) {
      try {
        codec.decrypt(secret, path)
      } catch {
        issues.push({ code: 'SECRET_UNREADABLE', path })
      }
    }
    return secret
  }
  const options = (
    await database.query('SELECT id, name, value FROM options ORDER BY name')
  ).rows
  for (const row of options) {
    if (isLegacyConfig(row.name, row.value)) counts.legacyConfig++
    if (row.value && typeof row.value === 'object')
      visitConfigSecrets(row.value, row.name, inspect)
  }
  const knownRows = options.filter((row) => row.name in configSchemaMapping)
  for (const row of knownRows) {
    if (!row.value || typeof row.value !== 'object' || Array.isArray(row.value))
      issues.push({ code: 'CONFIG_SHAPE_UNSUPPORTED', path: row.name })
  }
  if (
    keyValid &&
    !issues.some(
      (issue) =>
        issue.code === 'SECRET_UNREADABLE' ||
        issue.code === 'CONFIG_SHAPE_UNSUPPORTED',
    )
  ) {
    try {
      const raw = Object.fromEntries(
        knownRows.map((row) => [
          row.name,
          visitConfigSecrets(row.value, row.name, (secret, path) =>
            codec.decrypt(secret, path),
          ),
        ]),
      )
      const normalized = normalizeLegacyConfig(raw)
      for (const row of knownRows) {
        if (
          !configSchemaMapping[row.name].safeParse(normalized[row.name]).success
        )
          issues.push({ code: 'CONFIG_SHAPE_UNSUPPORTED', path: row.name })
      }
    } catch (error) {
      issues.push(
        error instanceof LegacyConfigConflictError
          ? { code: error.code, path: error.path }
          : { code: 'CONFIG_SHAPE_UNSUPPORTED' },
      )
    }
  }
  for (const table of ['snippets', 'webhooks']) {
    for (const row of (await database.query(`SELECT id, secret FROM ${table}`))
      .rows) {
      if (row.secret) inspect(row.secret, `${table}.${row.id}.secret`)
    }
  }
  for (const row of (await database.query('SELECT config_id FROM api_keys'))
    .rows) {
    if (row.config_id === HASHED_API_KEY_CONFIG_ID) counts.hashedApiKeys++
    else counts.plainApiKeys++
  }
  const accounts = (
    await database.query('SELECT id, access_token, refresh_token FROM accounts')
  ).rows
  for (const row of accounts) {
    for (const field of ['access_token', 'refresh_token']) {
      const token = row[field]
      if (!token) continue
      if (!isEncryptedOAuth(token)) {
        counts.plainOAuth++
        continue
      }
      counts.encryptedOAuth++
      if (config.jwtSecret) {
        try {
          await unwrapOAuthToken(token, config.jwtSecret)
        } catch {
          issues.push({
            code: 'OAUTH_UNREADABLE',
            path: `accounts.${row.id}.${field}`,
          })
        }
      }
    }
  }
  for (const [table, type] of [
    ['ai_translations', 'translation'],
    ['ai_insights', 'insights'],
  ]) {
    const result = await database.query(
      `SELECT count(*)::int AS count FROM ${table} r WHERE NOT EXISTS (SELECT 1 FROM ai_generation_metrics m WHERE m.resource_type = $1 AND m.resource_id = r.id)`,
      [type],
    )
    counts.metricsMissing += result.rows[0].count
  }
  const prepared =
    (
      await database.query('SELECT 1 FROM _app_migrations WHERE id = $1', [
        PREPARED_MIGRATION_ID,
      ])
    ).rowCount !== 0
  // A new database may contain migration ledgers, but no application data.
  const tables = (
    await database.query(
      `SELECT tablename FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename <> ALL($1::text[])`,
      [
        [
          '_app_migrations',
          '__drizzle_migrations',
          'schema_migrations',
          'data_migration_runs',
          'mongo_id_map',
          'auth_id_map',
        ],
      ],
    )
  ).rows
  const probes = tables.map(
    ({ tablename }) =>
      `SELECT 1 FROM public."${String(tablename).replaceAll('"', '""')}"`,
  )
  const existing = await database.query(
    probes.length
      ? `SELECT EXISTS (${probes.join(' UNION ALL ')}) AS present`
      : 'SELECT false AS present',
  )
  const installation = existing.rows[0].present ? 'existing' : 'empty'
  if (
    counts.plaintext ||
    counts.ecb ||
    counts.plainApiKeys ||
    counts.plainOAuth
  )
    issues.push({ code: 'CREDENTIALS_NEED_PREPARATION' })
  if (counts.legacyConfig) issues.push({ code: 'LEGACY_CONFIG' })
  if (counts.metricsMissing) issues.push({ code: 'METRICS_INCOMPLETE' })
  if (installation === 'existing' && !prepared)
    issues.push({ code: 'PREPARATION_MARKER_MISSING' })
  return {
    target: 18,
    status: issues.length ? 'needs-action' : 'ready',
    installation,
    prepared,
    counts,
    issues,
  }
}
