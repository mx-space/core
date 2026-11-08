import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto'
import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { rotateJwtSecret } from '~/upgrade/jwt-rotation'
import { oauthKey } from '~/upgrade/oauth-token'

describe('maintenance JWT rotation', () => {
  let context: Awaited<ReturnType<typeof createPgTestDatabase>>
  let directory: string
  const oldSecret = 'old-short-jwt'
  const newSecret = 'new-long-jwt-for-upgrade-123456789012345'
  let input: {
    oldJwtFile: string
    newJwtFile: string
    maintenanceConfirmed: boolean
  }
  beforeAll(async () => {
    context = await createPgTestDatabase('mx_jwt_rotation')
    directory = await mkdtemp(path.join(tmpdir(), 'mx-jwt-test-'))
    input = {
      oldJwtFile: path.join(directory, 'old'),
      newJwtFile: path.join(directory, 'new'),
      maintenanceConfirmed: true,
    }
    await writeFile(input.oldJwtFile, oldSecret, { mode: 0o400 })
    await writeFile(input.newJwtFile, `${newSecret}\n`, { mode: 0o400 })
  })
  afterAll(async () => {
    await context?.close()
    if (directory) await rm(directory, { recursive: true })
  })
  beforeEach(async () => {
    await context.pool.query(
      'TRUNCATE accounts, sessions, readers, api_keys, options CASCADE',
    )
    await context.pool.query(
      "INSERT INTO readers (id, email, name) VALUES ('owner', 'owner@example.test', 'Owner')",
    )
    await context.pool.query(
      "INSERT INTO sessions (id, token, user_id, expires_at) VALUES ('session', 'session-token', 'owner', now() + interval '1 day')",
    )
    await context.pool.query(
      "INSERT INTO api_keys (id, key) VALUES ('key', 'unchanged-api-key')",
    )
    await context.pool.query(
      "INSERT INTO options (id, name, value) VALUES ('100', 'non-secret-setting', '{\"untouched\":true}')",
    )
    await context.pool.query(
      "INSERT INTO accounts (id, user_id, account_id, provider_id, access_token, refresh_token) VALUES ('a', 'owner', 'remote', 'github', $1, 'plaintext-refresh'), ('b', 'owner', 'remote-b', 'google', $2, NULL)",
      [
        await symmetricEncrypt({
          key: oauthKey(oldSecret),
          data: 'access-token',
        }),
        await symmetricEncrypt({ key: oldSecret, data: 'legacy-access' }),
      ],
    )
  })
  async function snapshot() {
    return (await context.pool.query('SELECT * FROM accounts ORDER BY id')).rows
  }
  it('requires maintenance confirmation before any mutation', async () => {
    const before = await snapshot()
    await expect(
      rotateJwtSecret(context.pool, { ...input, maintenanceConfirmed: false }),
    ).rejects.toThrow('MAINTENANCE_CONFIRMATION_REQUIRED')
    expect(await snapshot()).toEqual(before)
  })
  it('rewraps all known OAuth formats, expires sessions, and preserves other secrets/files', async () => {
    expect(await rotateJwtSecret(context.pool, input)).toMatchObject({
      reLoginRequired: true,
      environmentUpdateRequired: true,
    })
    const rows = await snapshot()
    expect(
      await symmetricDecrypt({
        key: oauthKey(newSecret),
        data: rows[0].access_token,
      }),
    ).toBe('access-token')
    expect(
      await symmetricDecrypt({
        key: oauthKey(newSecret),
        data: rows[0].refresh_token,
      }),
    ).toBe('plaintext-refresh')
    expect(
      await symmetricDecrypt({
        key: oauthKey(newSecret),
        data: rows[1].access_token,
      }),
    ).toBe('legacy-access')
    expect(
      (await context.pool.query('SELECT count(*)::int AS n FROM sessions'))
        .rows[0].n,
    ).toBe(0)
    expect(
      (await context.pool.query('SELECT key FROM api_keys')).rows[0].key,
    ).toBe('unchanged-api-key')
    expect(
      (await context.pool.query('SELECT value FROM options')).rows[0].value,
    ).toEqual({ untouched: true })
    expect(await readFile(input.oldJwtFile, 'utf8')).toBe(oldSecret)
    expect(await readFile(input.newJwtFile, 'utf8')).toBe(`${newSecret}\n`)
  })
  it('rolls the whole batch back when an OAuth record cannot be opened', async () => {
    await context.pool.query(
      "UPDATE accounts SET access_token = '$ba$1$invalid-ciphertext' WHERE id = 'b'",
    )
    const before = await snapshot()
    const error = await rotateJwtSecret(context.pool, input).catch(
      (error) => error,
    )
    expect(error.message).toContain('OAUTH_UNREADABLE')
    expect(error.message).not.toContain(oldSecret)
    expect(error.message).not.toContain('invalid-ciphertext')
    expect(await snapshot()).toEqual(before)
    expect(
      (await context.pool.query('SELECT count(*)::int AS n FROM sessions'))
        .rows[0].n,
    ).toBe(1)
  })
  it('rejects a wrong original JWT without resetting tokens', async () => {
    const wrongFile = path.join(directory, 'wrong')
    await writeFile(wrongFile, 'incorrect-original', { mode: 0o400 })
    const before = await snapshot()
    await expect(
      rotateJwtSecret(context.pool, { ...input, oldJwtFile: wrongFile }),
    ).rejects.toThrow('OAUTH_UNREADABLE')
    expect(await snapshot()).toEqual(before)
  })
  it('rejects truncated legacy ciphertext and rolls back earlier token changes', async () => {
    const bare = await symmetricEncrypt({
      key: oldSecret,
      data: 'legacy-provider-token',
    })
    await context.pool.query(
      "UPDATE accounts SET access_token = $1 WHERE id = 'b'",
      [bare.slice(0, -1)],
    )
    const before = await snapshot()
    await expect(rotateJwtSecret(context.pool, input)).rejects.toThrow(
      'OAUTH_UNREADABLE',
    )
    expect(await snapshot()).toEqual(before)
  })
})
