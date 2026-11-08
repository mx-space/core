import { readFile, stat } from 'node:fs/promises'

import { symmetricEncrypt } from 'better-auth/crypto'
import type { Pool } from 'pg'

import { oauthKey, unwrapOAuthToken } from './oauth-token'
import { UpgradeError } from './preparation'
import { CONFIG_UPGRADE_LOCK } from './readiness'

async function readSecretFile(file: string) {
  try {
    if (!(await stat(file)).isFile()) throw new Error('Not a file')
    const value = (await readFile(file, 'utf8')).replace(/\r?\n$/, '')
    if (!value || /[\r\n]/.test(value)) throw new Error('Invalid secret file')
    return value
  } catch {
    throw new UpgradeError('JWT_FILE_UNREADABLE')
  }
}

/** Offline only: the operator must stop every business/background writer first. */
export async function rotateJwtSecret(
  pool: Pool,
  input: {
    maintenanceConfirmed: boolean
    oldJwtFile: string
    newJwtFile: string
  },
) {
  if (!input.maintenanceConfirmed)
    throw new UpgradeError('MAINTENANCE_CONFIRMATION_REQUIRED')
  const [oldSecret, newSecret] = await Promise.all([
    readSecretFile(input.oldJwtFile),
    readSecretFile(input.newJwtFile),
  ])
  if (newSecret.length < 32) throw new UpgradeError('NEW_JWT_TOO_SHORT')
  if (newSecret === oldSecret) throw new UpgradeError('JWT_UNCHANGED')
  const client = await pool.connect()
  let changed = 0
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout = '10s'")
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      CONFIG_UPGRADE_LOCK,
    ])
    for (const row of (
      await client.query(
        'SELECT id, access_token, refresh_token FROM accounts FOR UPDATE',
      )
    ).rows) {
      for (const field of ['access_token', 'refresh_token']) {
        if (!row[field]) continue
        let plaintext: string
        try {
          plaintext = await unwrapOAuthToken(row[field], oldSecret)
        } catch {
          throw new UpgradeError(
            'OAUTH_UNREADABLE',
            `accounts.${row.id}.${field}`,
          )
        }
        const encrypted = await symmetricEncrypt({
          key: oauthKey(newSecret),
          data: plaintext,
        })
        await client.query(`UPDATE accounts SET ${field} = $1 WHERE id = $2`, [
          encrypted,
          row.id,
        ])
        changed++
      }
    }
    const expiredSessions =
      (await client.query('DELETE FROM sessions')).rowCount ?? 0
    await client.query('COMMIT')
    return {
      status: 'rotated',
      changed,
      expiredSessions,
      reLoginRequired: true,
      environmentUpdateRequired: true,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error instanceof UpgradeError
      ? error
      : new UpgradeError('JWT_ROTATION_FAILED')
  } finally {
    client.release()
  }
}
