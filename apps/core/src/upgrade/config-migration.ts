import { isDeepStrictEqual } from 'node:util'

import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import type { PoolClient } from 'pg'

import { visitConfigSecrets } from '../modules/configs/configs.secret-paths'
import {
  canonicalConfigRows,
  normalizeLegacyConfig,
} from '../modules/configs/legacy-config.util'
import type { SecretCodec } from '../utils/secret-codec'

export class ConfigMigrationError extends Error {
  constructor(
    public readonly code: string,
    public readonly path?: string,
  ) {
    super(path ? `${code} (${path})` : code)
  }
}

/** Caller owns the transaction and CONFIG_UPGRADE_LOCK. No business-service imports. */
export async function migrateConfiguration(
  client: Pick<PoolClient, 'query'>,
  codec: SecretCodec,
) {
  codec.assertConfigured()
  const ids = new SnowflakeGenerator({ workerId: 1023 })
  let changed = 0
  const decrypt = (secret: string, path: string) => {
    try {
      return codec.decrypt(secret, path)
    } catch {
      throw new ConfigMigrationError('SECRET_UNREADABLE', path)
    }
  }
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
      throw new ConfigMigrationError('CONFIG_SHAPE_UNSUPPORTED', key)
  }
  const plaintext = Object.fromEntries(
    rows.map((row) => [
      row.name,
      visitConfigSecrets(row.value, row.name, (secret, path) =>
        decrypt(secret, path),
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
        decrypt(previous, path) === secret
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
  return changed
}
