import { defaultKeyHasher } from '@better-auth/api-key'
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto'
import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { prepareUpgrade } from '~/upgrade/preparation'
import {
  CONFIG_UPGRADE_LOCK,
  oauthKey,
  readUpgradeState,
} from '~/upgrade/readiness'
import { SecretCodec } from '~/utils/secret-codec'

describe('transactional v18 preparation', () => {
  let context: Awaited<ReturnType<typeof createPgTestDatabase>>
  const config = {
    key: 'ab'.repeat(32),
    jwtSecret: 'long-test-jwt-secret-1234567890123456789',
    enable: true,
    v2: true,
  }
  const codec = new SecretCodec(config)
  beforeAll(async () => {
    context = await createPgTestDatabase('mx_upgrade_prepare')
  })
  afterAll(async () => context?.close())
  beforeEach(async () => {
    await context.pool.query(
      'TRUNCATE options, snippets, webhooks, api_keys, accounts, readers, _app_migrations CASCADE',
    )
    await context.pool.query(
      "INSERT INTO options (id, name, value) VALUES ('100', 'membership', $1), ('101', 'thirdPartyServiceIntegration', $2), ('102', 'imageGenerationOptions', $3)",
      [
        {
          dodoApiKey: codec.encrypt('billing-secret', 'membership.dodoApiKey'),
        },
        {
          githubToken: new SecretCodec({ ...config, v2: false }).encrypt(
            'github-secret',
            'thirdPartyServiceIntegration.githubToken',
          ),
        },
        { enable: true, apiKey: 'image-secret', model: 'image-v1' },
      ],
    )
    await context.pool.query(
      "INSERT INTO snippets (id, raw, path, secret) VALUES ('200', '{}', 'sample', 'snippet-secret')",
    )
    await context.pool.query(
      "INSERT INTO webhooks (id, payload_url, events, secret) VALUES ('201', 'https://example.test', '{}', 'webhook-secret')",
    )
    await context.pool.query(
      "INSERT INTO readers (id, email, name) VALUES ('owner', 'owner@example.test', 'Owner')",
    )
    await context.pool.query(
      "INSERT INTO api_keys (id, user_id, key) VALUES ('key', 'owner', 'raw-client-key')",
    )
    await context.pool.query(
      "INSERT INTO accounts (id, user_id, account_id, provider_id, access_token) VALUES ('account', 'owner', 'remote', 'github', 'provider-token')",
    )
  })
  async function snapshot() {
    return Promise.all(
      [
        'options',
        'snippets',
        'webhooks',
        'api_keys',
        'accounts',
        '_app_migrations',
      ].map(
        async (table) =>
          (await context.pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows,
      ),
    )
  }
  it('requires an explicit all-replicas confirmation and leaves data untouched', async () => {
    const before = await snapshot()
    await expect(
      prepareUpgrade(context.pool, config, { allReplicasV2: false }),
    ).rejects.toThrow('REPLICA_CONFIRMATION_REQUIRED')
    expect(await snapshot()).toEqual(before)
  })
  it('dry-run proves conversion and rolls back every write', async () => {
    const before = await snapshot()
    expect(
      await prepareUpgrade(context.pool, config, {
        allReplicasV2: true,
        dryRun: true,
      }),
    ).toMatchObject({ dryRun: true, status: 'would-be-ready' })
    expect(await snapshot()).toEqual(before)
  })
  it('converts at original paths, hashes once and preserves OAuth/provider secrets', async () => {
    await prepareUpgrade(context.pool, config, { allReplicasV2: true })
    expect(await readUpgradeState(context.pool, config)).toMatchObject({
      status: 'ready',
      prepared: true,
      counts: {
        legacyConfig: 0,
        ecb: 0,
        plaintext: 0,
        plainApiKeys: 0,
        plainOAuth: 0,
      },
    })
    const rows = Object.fromEntries(
      (await context.pool.query('SELECT name, value FROM options')).rows.map(
        (row) => [row.name, row.value],
      ),
    )
    expect(codec.decrypt(rows.membership.apiKey, 'membership.apiKey')).toBe(
      'billing-secret',
    )
    expect(
      codec.decrypt(
        rows.thirdPartyServiceIntegration.github.token,
        'thirdPartyServiceIntegration.github.token',
      ),
    ).toBe('github-secret')
    expect(
      codec.decrypt(rows.ai.providers[0].apiKey, 'ai.providers.0.apiKey'),
    ).toBe('image-secret')
    const key = (await context.pool.query('SELECT key FROM api_keys')).rows[0]
      .key
    expect(key).toBe(await defaultKeyHasher('raw-client-key'))
    expect(
      await symmetricDecrypt({
        key: oauthKey(config.jwtSecret),
        data: (await context.pool.query('SELECT access_token FROM accounts'))
          .rows[0].access_token,
      }),
    ).toBe('provider-token')
    const before = await snapshot()
    await prepareUpgrade(context.pool, config, { allReplicasV2: true })
    expect(await snapshot()).toEqual(before)
  })
  it('rolls back and omits a marker if original decryption fails', async () => {
    const before = await snapshot()
    await expect(
      prepareUpgrade(
        context.pool,
        { ...config, key: 'cd'.repeat(32) },
        { allReplicasV2: true },
      ),
    ).rejects.toThrow('SECRET_UNREADABLE')
    expect(await snapshot()).toEqual(before)
  })
  it('rolls back when mixed config contains conflicting secrets', async () => {
    await context.pool.query(
      "UPDATE options SET value = $1 WHERE name = 'membership'",
      [{ apiKey: 'canonical-private', dodoApiKey: 'legacy-private' }],
    )
    const before = await snapshot()
    await expect(
      prepareUpgrade(context.pool, config, { allReplicasV2: true }),
    ).rejects.toThrow('CONFIG_SECRET_CONFLICT')
    expect(await snapshot()).toEqual(before)
  })
  it('rolls back on truncated legacy OAuth ciphertext rather than wrapping it as plaintext', async () => {
    const bare = await symmetricEncrypt({
      key: config.jwtSecret,
      data: 'original-provider-token',
    })
    await context.pool.query('UPDATE accounts SET access_token = $1', [
      bare.slice(0, -1),
    ])
    const before = await snapshot()
    await expect(
      prepareUpgrade(context.pool, config, { allReplicasV2: true }),
    ).rejects.toThrow('OAUTH_UNREADABLE')
    expect(await snapshot()).toEqual(before)
  })
  it('upgrades a legacy Better Auth bare-hex token without double encryption', async () => {
    const bare = await symmetricEncrypt({
      key: config.jwtSecret,
      data: 'original-provider-token',
    })
    await context.pool.query('UPDATE accounts SET access_token = $1', [bare])
    await prepareUpgrade(context.pool, config, { allReplicasV2: true })
    const stored = (
      await context.pool.query('SELECT access_token FROM accounts')
    ).rows[0].access_token
    expect(
      await symmetricDecrypt({ key: oauthKey(config.jwtSecret), data: stored }),
    ).toBe('original-provider-token')
  })
  it('serializes preparation with normal configuration writes', async () => {
    const writer = await context.pool.connect()
    await writer.query('BEGIN')
    await writer.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      CONFIG_UPGRADE_LOCK,
    ])
    let finished = false
    const preparing = prepareUpgrade(context.pool, config, {
      allReplicasV2: true,
    }).then(() => {
      finished = true
    })
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(finished).toBe(false)
    await writer.query('COMMIT')
    writer.release()
    await preparing
    expect(finished).toBe(true)
  })
})
