import crypto from 'node:crypto'

import { defaultKeyHasher } from '@better-auth/api-key'
import { symmetricDecrypt } from 'better-auth/crypto'
import { createPgTestDatabase } from 'test/helper/pg-verify-url'

import { ENCRYPT, SECURITY } from '~/app.config'
import { migration } from '~/database/app-migrations/20261018-protect-stored-secrets'
import { CreateAuth } from '~/modules/auth/auth.implement'
import { AuthRepository } from '~/modules/auth/auth.repository'
import { AuthService } from '~/modules/auth/auth.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { OptionsRepository } from '~/modules/configs/options.repository'
import { OwnerRepository } from '~/modules/owner/owner.repository'
import { ReaderRepository } from '~/modules/reader/reader.repository'
import { SnippetRepository } from '~/modules/snippet/snippet.repository'
import { WebhookRepository } from '~/modules/webhook/webhook.repository'
import { __setTestPostgresInstance } from '~/processors/database/postgres.provider'
import { SnowflakeService } from '~/shared/id/snowflake.service'
import { EncryptUtil } from '~/utils/encrypt.util'

it('upgrades real credential rows without changing their usable values, and can run twice', async () => {
  const context = await createPgTestDatabase('mx_secret_verify')
  __setTestPostgresInstance(context.pool, context.db)
  try {
    const cipher = crypto.createCipheriv(
      'aes-256-ecb',
      Buffer.from(ENCRYPT.key, 'hex'),
      '',
    )
    const oldSecret =
      '$${mx}$$' +
      Buffer.concat([cipher.update('legacy-s3'), cipher.final()]).toString(
        'base64',
      )
    await context.pool.query(
      "INSERT INTO readers (id, name, email, role) VALUES ('100', 'Owner', 'owner@example.test', 'owner')",
    )
    await context.pool.query(
      'INSERT INTO options (id,name,value) VALUES (101, $1, $2), (102, $3, $4)',
      [
        'backupOptions',
        JSON.stringify({ secretKey: oldSecret }),
        'mailOptions',
        JSON.stringify({ smtp: { pass: 'legacy-smtp' } }),
      ],
    )
    await context.pool.query(
      "INSERT INTO api_keys (id,user_id,key,name) VALUES ('legacy-key','100','legacy-raw-api-key','Legacy')",
    )
    await context.pool.query(
      "INSERT INTO accounts (id,user_id,provider_id,access_token,refresh_token) VALUES ('oauth','100','github','legacy-access','legacy-refresh')",
    )
    await context.pool.query(
      "INSERT INTO webhooks (id,payload_url,events,secret) VALUES (103,'https://example.test/hook','{all}','legacy-hook')",
    )
    await context.pool.query(
      "INSERT INTO snippets (id,raw,path,type,secret) VALUES (104,'export default () => 1','function/test','function','key=legacy-snippet')",
    )
    const args = {
      db: context.db,
      pool: context.pool,
      logger: { log: vi.fn() } as any,
    }
    await migration.up(args)
    const first = (
      await context.pool.query('SELECT key,config_id FROM api_keys')
    ).rows[0]
    expect(first.key).toBe(await defaultKeyHasher('legacy-raw-api-key'))
    expect(first.config_id).toBe('mx-hashed-v1')
    await migration.up(args)
    expect(
      (await context.pool.query('SELECT key FROM api_keys')).rows[0].key,
    ).toBe(first.key)

    const snowflake = new SnowflakeService()
    const { auth } = await CreateAuth(
      {},
      undefined,
      'http://127.0.0.1:2333',
      snowflake,
    )
    const service = new AuthService(
      new AuthRepository(context.db),
      new ReaderRepository(context.db, snowflake),
      new OwnerRepository(context.db, snowflake),
      { get: () => auth } as any,
      snowflake,
      { emit: () => false } as any,
    )
    expect(await service.verifyApiKey('legacy-raw-api-key')).toMatchObject({
      id: 'legacy-key',
      referenceId: '100',
    })
    expect(await service.verifyApiKey(first.key)).toBeNull()
    const created = await service.createAccessToken({
      name: 'Created once',
    } as any)
    const stored = (
      await context.pool.query(
        "SELECT key,config_id FROM api_keys WHERE name='Created once'",
      )
    ).rows[0]
    expect(stored.key).toBe(await defaultKeyHasher(created.token))
    expect(stored.config_id).toBe('mx-hashed-v1')
    const item = (await service.getAllAccessToken()).find(
      (row) => row.name === 'Created once',
    )!
    expect(item.token).not.toBe(created.token)
    expect((await service.getToken(item.id))?.token).toBe(item.token)
    await service.deleteToken(item.id)
    expect(await service.verifyApiKey(created.token)).toBeNull()

    let cache: string | null = null
    const configs = new ConfigsService(
      new OptionsRepository(context.db, snowflake),
      {
        waitForReady: async () => {},
        getClient: () => ({
          get: async () => cache,
          set: async (_key, value) => {
            cache = value
          },
        }),
      } as any,
      {} as any,
      { emit: vi.fn() } as any,
    )
    await configs.patchAndValid('backupOptions', {
      enable: true,
      secretKey: '',
    })
    expect(cache).not.toContain('legacy-smtp')
    expect(cache).not.toContain('legacy-s3')
    const persisted = (
      await context.pool.query(
        "SELECT value FROM options WHERE name='backupOptions'",
      )
    ).rows[0].value
    expect(
      EncryptUtil.decrypt(persisted.secretKey, 'backupOptions.secretKey'),
    ).toBe('legacy-s3')
    expect((await configs.get('mailOptions')).smtp?.pass).toBe('legacy-smtp')
    expect((await configs.getConfigForResponse()).backupOptions.secretKey).toBe(
      '',
    )

    const oauth = (
      await context.pool.query(
        'SELECT access_token,refresh_token FROM accounts',
      )
    ).rows[0]
    expect(oauth.access_token).toMatch(/^\$ba\$1\$/)
    const oauthKey = {
      currentVersion: 1,
      keys: new Map([[1, SECURITY.jwtSecret!]]),
      legacySecret: SECURITY.jwtSecret!,
    }
    expect(
      await symmetricDecrypt({ key: oauthKey, data: oauth.access_token }),
    ).toBe('legacy-access')
    expect(
      await symmetricDecrypt({ key: oauthKey, data: oauth.refresh_token }),
    ).toBe('legacy-refresh')
    const repo = new WebhookRepository(context.db, snowflake)
    expect((await repo.findById('103'))?.secret).toBe('legacy-hook')
    await repo.update('103', { secret: 'new-hook' })
    expect(
      (await context.pool.query('SELECT secret FROM webhooks')).rows[0].secret,
    ).not.toContain('new-hook')
    expect((await repo.findById('103'))?.secret).toBe('new-hook')
    const snippets = new SnippetRepository(context.db, snowflake)
    const snippet = await snippets.create({
      raw: 'export default () => 1',
      path: 'function/new',
      type: 'function' as any,
      secret: 'key=new-snippet',
    })
    expect(
      EncryptUtil.decrypt(snippet.secret!, `snippets.${snippet.id}.secret`),
    ).toBe('key=new-snippet')
    expect(() =>
      EncryptUtil.decrypt(snippet.secret!, 'snippets.104.secret'),
    ).toThrow()
    expect(
      EncryptUtil.decrypt(
        (await snippets.findById('104'))!.secret!,
        'snippets.104.secret',
      ),
    ).toBe('key=legacy-snippet')
  } finally {
    __setTestPostgresInstance(null, null)
    await context.close()
  }
}, 120_000)
