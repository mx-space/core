import { parseEnvelope, symmetricDecrypt } from 'better-auth/crypto'
import type { Pool, PoolClient } from 'pg'

import { HASHED_API_KEY_CONFIG_ID } from '../modules/auth/auth.constant'
import { visitConfigSecrets } from '../modules/configs/configs.secret-paths'
import { SecretCodec } from '../utils/secret-codec'

export const PREPARED_MIGRATION_ID = '20261108-v18-prepared'
export const CONFIG_UPGRADE_LOCK = '5183248167463294042'
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

export function oauthKey(secret: string) {
  return {
    currentVersion: 1,
    keys: new Map([[1, secret]]),
    legacySecret: secret,
  }
}

export function isLegacyConfig(name: string, value: any): boolean {
  return (
    name === 'imageGenerationOptions' ||
    name === 'ttsOptions' ||
    (name === 'ai' && value?.version !== 2) ||
    (name === 'thirdPartyServiceIntegration' &&
      !!value &&
      'githubToken' in value) ||
    (name === 'membership' &&
      !!value &&
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
      if (!token.startsWith('$ba$')) {
        counts.plainOAuth++
        continue
      }
      counts.encryptedOAuth++
      if (!parseEnvelope(token))
        issues.push({
          code: 'OAUTH_UNREADABLE',
          path: `accounts.${row.id}.${field}`,
        })
      else if (config.jwtSecret) {
        try {
          await symmetricDecrypt({
            key: oauthKey(config.jwtSecret),
            data: token,
          })
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
  const existing = await database.query(`SELECT EXISTS (
    SELECT 1 FROM options UNION ALL SELECT 1 FROM readers UNION ALL SELECT 1 FROM posts UNION ALL SELECT 1 FROM notes UNION ALL SELECT 1 FROM pages UNION ALL SELECT 1 FROM snippets UNION ALL SELECT 1 FROM webhooks UNION ALL SELECT 1 FROM accounts UNION ALL SELECT 1 FROM api_keys UNION ALL SELECT 1 FROM ai_translations UNION ALL SELECT 1 FROM ai_insights
  ) AS present`)
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
