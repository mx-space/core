import { defaultKeyHasher } from '@better-auth/api-key'
import {
  parseEnvelope,
  symmetricDecrypt,
  symmetricEncrypt,
} from 'better-auth/crypto'
import { eq } from 'drizzle-orm'

import { SECRET_STORAGE_V2, SECURITY } from '~/app.config'
import {
  accounts,
  apiKeys,
  options,
  snippets,
  webhooks,
} from '~/database/schema'
import { HASHED_API_KEY_CONFIG_ID } from '~/modules/auth/auth.constant'
import { encryptObject } from '~/modules/configs/configs.encrypt.util'
import { EncryptUtil } from '~/utils/encrypt.util'

import type { AppMigration } from './types'

export const migration: AppMigration = {
  id: '20261018-protect-stored-secrets',
  description:
    'Protect existing credentials after every replica enables v2 writes',
  async up({ db, logger }) {
    EncryptUtil.assertConfigured()
    if (!SECRET_STORAGE_V2 || !SECURITY.jwtSecret) {
      throw new Error(
        'Secret migration requires MX_SECRET_STORAGE_V2=1 and JWT_SECRET',
      )
    }
    const oauthKey = {
      currentVersion: 1,
      keys: new Map([[1, SECURITY.jwtSecret]]),
      legacySecret: SECURITY.jwtSecret,
    }
    let changed = 0
    // shortcut: one transaction locks credential rows during backfill; batch for large installations.
    await db.transaction(async (tx) => {
      for (const row of await tx.select().from(options).for('update')) {
        if (!row.value || typeof row.value !== 'object') continue
        const value = encryptObject(structuredClone(row.value), row.name)
        if (JSON.stringify(value) === JSON.stringify(row.value)) continue
        await tx.update(options).set({ value }).where(eq(options.id, row.id))
        changed++
      }
      for (const row of await tx
        .select({ id: snippets.id, secret: snippets.secret })
        .from(snippets)
        .for('update')) {
        if (!row.secret) continue
        const secret = EncryptUtil.encrypt(
          row.secret,
          `snippets.${row.id}.secret`,
        )
        if (secret === row.secret) continue
        await tx.update(snippets).set({ secret }).where(eq(snippets.id, row.id))
        changed++
      }
      for (const row of await tx
        .select({ id: webhooks.id, secret: webhooks.secret })
        .from(webhooks)
        .for('update')) {
        const secret = EncryptUtil.encrypt(
          row.secret,
          `webhooks.${row.id}.secret`,
        )
        if (secret === row.secret) continue
        await tx.update(webhooks).set({ secret }).where(eq(webhooks.id, row.id))
        changed++
      }
      for (const row of await tx.select().from(apiKeys).for('update')) {
        if (row.configId === HASHED_API_KEY_CONFIG_ID) continue
        await tx
          .update(apiKeys)
          .set({
            key: await defaultKeyHasher(row.key),
            configId: HASHED_API_KEY_CONFIG_ID,
            referenceId: row.referenceId || row.userId,
            start: row.start || row.key.slice(0, 6),
          })
          .where(eq(apiKeys.id, row.id))
        changed++
      }
      for (const row of await tx
        .select({
          id: accounts.id,
          accessToken: accounts.accessToken,
          refreshToken: accounts.refreshToken,
        })
        .from(accounts)
        .for('update')) {
        const patch: Partial<typeof accounts.$inferInsert> = {}
        for (const field of ['accessToken', 'refreshToken'] as const) {
          const token = row[field]
          if (!token) continue
          if (token.startsWith('$ba$')) {
            if (!parseEnvelope(token))
              throw new Error('Malformed OAuth token envelope')
            await symmetricDecrypt({ key: oauthKey, data: token })
          } else {
            patch[field] = await symmetricEncrypt({
              key: oauthKey,
              data: token,
            })
          }
        }
        if (!Object.keys(patch).length) continue
        await tx.update(accounts).set(patch).where(eq(accounts.id, row.id))
        changed++
      }
    })
    logger.log(`Protected ${changed} credential records`)
  },
}
