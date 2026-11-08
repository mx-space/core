import { migration as protectStoredSecrets } from './20261018-protect-stored-secrets'
import type { AppMigration } from './types'

/** Recheck at the cutover even if the opt-in historical migration was applied. */
export const migration: AppMigration = {
  id: '20261109-required-secret-storage',
  description:
    'Require encrypted credentials and hashed API keys before v18 startup',
  up: protectStoredSecrets.up,
}
