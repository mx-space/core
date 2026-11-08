import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { readUpgradeState } from '~/upgrade/readiness'
import { SecretCodec } from '~/utils/secret-codec'

describe('standalone upgrade readiness', () => {
  let context: Awaited<ReturnType<typeof createPgTestDatabase>>
  const config = {
    key: 'ab'.repeat(32),
    jwtSecret: 'jwt-secret-for-upgrade-123456789012345',
    enable: true,
    v2: true,
  }
  beforeAll(async () => {
    context = await createPgTestDatabase('mx_upgrade_check')
  })
  afterAll(async () => context?.close())

  it('identifies an empty installation without requiring a historical marker', async () => {
    expect(await readUpgradeState(context.pool, config)).toMatchObject({
      installation: 'empty',
      status: 'ready',
      prepared: false,
    })
  })

  it('reports missing/invalid settings without importing the business application', async () => {
    const report = await readUpgradeState(context.pool, {
      key: '',
      jwtSecret: 'short-secret',
      enable: false,
      v2: false,
    })
    expect(report.status).toBe('needs-action')
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'FIELD_KEY_MISSING',
        'JWT_TOO_SHORT',
        'V2_WRITES_DISABLED',
      ]),
    )
    expect(JSON.stringify(report)).not.toContain('short-secret')
  })

  it('counts old formats, detects wrong keys and remains read-only', async () => {
    const codec = new SecretCodec({ ...config, v2: false })
    await context.pool.query(
      'INSERT INTO options (id, name, value) VALUES ($1, $2, $3)',
      [
        '100',
        'membership',
        { dodoApiKey: codec.encrypt('private-value', 'membership.dodoApiKey') },
      ],
    )
    const before = (await context.pool.query('SELECT * FROM options')).rows
    const report = await readUpgradeState(context.pool, config)
    expect(report).toMatchObject({
      installation: 'existing',
      status: 'needs-action',
      counts: { ecb: 1, legacyConfig: 1 },
    })
    expect(JSON.stringify(report)).not.toContain('private-value')
    expect(
      (
        await readUpgradeState(context.pool, {
          ...config,
          key: 'cd'.repeat(32),
        })
      ).issues.map((issue) => issue.code),
    ).toContain('SECRET_UNREADABLE')
    expect((await context.pool.query('SELECT * FROM options')).rows).toEqual(
      before,
    )
  })
  it('does not trust a marker over malformed canonical configuration', async () => {
    await context.pool.query(
      "DELETE FROM options; INSERT INTO _app_migrations (id) VALUES ('20261108-v18-prepared'); INSERT INTO options (id, name, value) VALUES ('300', 'membership', '42'::jsonb)",
    )
    expect(
      (await readUpgradeState(context.pool, config)).issues.map(
        (issue) => issue.code,
      ),
    ).toContain('CONFIG_SHAPE_UNSUPPORTED')
  })
  it('does not classify retained business data without an owner as a new empty installation', async () => {
    await context.pool.query(
      "DELETE FROM options; DELETE FROM _app_migrations; INSERT INTO categories (id, name, slug) VALUES ('400', 'Retained category', 'retained')",
    )
    expect(await readUpgradeState(context.pool, config)).toMatchObject({
      installation: 'existing',
      status: 'needs-action',
      prepared: false,
    })
  })
})
