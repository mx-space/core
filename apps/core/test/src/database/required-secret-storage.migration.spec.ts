import { defaultKeyHasher } from '@better-auth/api-key'
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto'
import { legacySecret } from 'test/helper/legacy-secret'
import { createPgTestDatabase } from 'test/helper/pg-verify-url'

import { ENCRYPT, SECURITY } from '~/app.config'
import { AppMigrationsService } from '~/database/app-migrations/app-migrations.service'
import { oauthKey } from '~/database/app-migrations/helpers/oauth-token'
import { readUpgradeState } from '~/upgrade/readiness'
import { EncryptUtil } from '~/utils/encrypt.util'

it.each([false, true])(
  'release migration protects every credential without opt-in, including after an old credential migration (already applied=%s)',
  async (previouslyApplied) => {
    const context = await createPgTestDatabase('mx_required_secrets')
    try {
      if (previouslyApplied)
        await context.pool.query(
          "INSERT INTO _app_migrations (id) VALUES ('20261018-protect-stored-secrets')",
        )
      await context.pool.query(
        "INSERT INTO options (id,name,value) VALUES ('100','membership',$1)",
        [{ dodoApiKey: legacySecret('retained-billing', ENCRYPT.key) }],
      )
      await context.pool.query(
        "INSERT INTO readers (id,name,email) VALUES ('owner','Owner','owner@example.test')",
      )
      await context.pool.query(
        "INSERT INTO api_keys (id,user_id,key) VALUES ('key','owner','original-client-key')",
      )
      await context.pool.query(
        "INSERT INTO accounts (id,user_id,provider_id,access_token) VALUES ('oauth','owner','github',$1)",
        [
          await symmetricEncrypt({
            key: SECURITY.jwtSecret!,
            data: 'provider-token',
          }),
        ],
      )
      await context.pool.query(
        "INSERT INTO snippets (id,raw,path,secret) VALUES ('101','{}','sample','snippet-secret')",
      )
      await context.pool.query(
        "INSERT INTO webhooks (id,payload_url,events,secret) VALUES ('102','https://example.test','{}','webhook-secret')",
      )
      await context.pool.query(
        "INSERT INTO ai_translations (id,ref_id,ref_type,hash,lang,source_lang,title,text,ai_model,ai_provider) VALUES ('103','104','post','h','ja','zh','Title','Body','legacy-model','legacy-provider')",
      )
      const runner = new AppMigrationsService(context.db, context.pool)
      await runner.run()
      expect(
        await readUpgradeState(context.pool, {
          ...ENCRYPT,
          jwtSecret: SECURITY.jwtSecret,
        }),
      ).toMatchObject({
        status: 'ready',
        counts: {
          plaintext: 0,
          ecb: 0,
          legacyConfig: 0,
          plainApiKeys: 0,
          plainOAuth: 0,
          metricsMissing: 0,
        },
      })
      const membership = (
        await context.pool.query(
          "SELECT value FROM options WHERE name='membership'",
        )
      ).rows[0].value
      expect(EncryptUtil.decrypt(membership.apiKey, 'membership.apiKey')).toBe(
        'retained-billing',
      )
      expect(
        (await context.pool.query('SELECT key,config_id FROM api_keys'))
          .rows[0],
      ).toEqual({
        key: await defaultKeyHasher('original-client-key'),
        config_id: 'mx-hashed-v1',
      })
      const token = (
        await context.pool.query('SELECT access_token FROM accounts')
      ).rows[0].access_token
      expect(
        await symmetricDecrypt({
          key: oauthKey(SECURITY.jwtSecret!),
          data: token,
        }),
      ).toBe('provider-token')
      expect(
        EncryptUtil.decrypt(
          (await context.pool.query('SELECT secret FROM snippets')).rows[0]
            .secret,
          'snippets.101.secret',
        ),
      ).toBe('snippet-secret')
      expect(
        EncryptUtil.decrypt(
          (await context.pool.query('SELECT secret FROM webhooks')).rows[0]
            .secret,
          'webhooks.102.secret',
        ),
      ).toBe('webhook-secret')
      const snapshot = async () =>
        Promise.all(
          [
            'options',
            'api_keys',
            'accounts',
            'snippets',
            'webhooks',
            'ai_generation_metrics',
            '_app_migrations',
          ].map(
            async (table) =>
              (await context.pool.query(`SELECT * FROM ${table} ORDER BY id`))
                .rows,
          ),
        )
      const before = await snapshot()
      await runner.run()
      expect(await snapshot()).toEqual(before)
    } finally {
      await context.close()
    }
  },
)

it('blocks release and rolls back the credential batch without recording completion when OAuth cannot be decrypted', async () => {
  const context = await createPgTestDatabase('mx_required_secrets_failure')
  try {
    await context.pool.query(
      "INSERT INTO readers (id,name,email) VALUES ('owner','Owner','owner@example.test')",
    )
    await context.pool.query(
      "INSERT INTO api_keys (id,user_id,key) VALUES ('key','owner','original-client-key')",
    )
    await context.pool.query(
      "INSERT INTO snippets (id,raw,path,secret) VALUES ('100','{}','sample','snippet-secret')",
    )
    await context.pool.query(
      "INSERT INTO accounts (id,user_id,provider_id,access_token) VALUES ('oauth','owner','github','$ba$1$invalid-ciphertext')",
    )
    await expect(
      new AppMigrationsService(context.db, context.pool).run(),
    ).rejects.toThrow()
    expect(
      (await context.pool.query('SELECT key FROM api_keys')).rows[0].key,
    ).toBe('original-client-key')
    expect(
      (await context.pool.query('SELECT secret FROM snippets')).rows[0].secret,
    ).toBe('snippet-secret')
    expect(
      (
        await context.pool.query(
          "SELECT id FROM _app_migrations WHERE id='20261109-required-secret-storage'",
        )
      ).rows,
    ).toEqual([])
  } finally {
    await context.close()
  }
})
