import { ENCRYPT } from '~/app.config'
import { CONFIG_FORMAT_MIGRATION_ID } from '~/shared/config-format'
import { CONFIG_UPGRADE_LOCK } from '~/shared/config-lock'
import { SecretCodec } from '~/utils/secret-codec'

import { migrateConfiguration } from './helpers/config-migration'
import type { AppMigration } from './types'

export const migration: AppMigration = {
  id: CONFIG_FORMAT_MIGRATION_ID,
  description:
    'Persist canonical configuration before removing runtime legacy conversion',
  async up({ pool, logger }) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL lock_timeout = '10s'")
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
        CONFIG_UPGRADE_LOCK,
      ])
      const changed = await migrateConfiguration(
        client,
        new SecretCodec(ENCRYPT),
      )
      await client.query('COMMIT')
      logger.log(`Migrated ${changed} configuration records`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}
