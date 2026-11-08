import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runUpgradeCli, upgradeConfigFromEnv } from '~/upgrade/cli'

describe('upgrade CLI isolated process', () => {
  it('uses the same required-key/JWT validation as startup without an activation flag', async () => {
    const { inspectSecretStorageConfig } =
      await import('~/utils/secret-storage-config')
    const env = {
      MX_ENCRYPT_KEY: 'ab'.repeat(32),
      JWT_SECRET: 'test-jwt-secret-with-at-least-32-characters',
    }
    expect(inspectSecretStorageConfig(upgradeConfigFromEnv(env))).toEqual([])
    for (const flag of [
      'MX_ENCRYPT_ENABLE',
      'ENCRYPT_ENABLE',
      'MX_SECRET_STORAGE_V2',
    ]) {
      expect(
        inspectSecretStorageConfig(
          upgradeConfigFromEnv({ ...env, [flag]: 'false' }),
        ),
      ).toContainEqual({ code: 'DEPRECATED_ENCRYPTION_FLAG', path: flag })
    }
  })
  let context: Awaited<ReturnType<typeof createPgTestDatabase>>
  beforeAll(async () => {
    context = await createPgTestDatabase('mx_upgrade_cli')
  })
  afterAll(async () => context?.close())

  it('diagnoses the removed algorithm setting through the standalone read-only check', async () => {
    const output: string[] = []
    expect(
      await runUpgradeCli(
        ['check', '--json'],
        {
          PG_URL: context.connectionString,
          MX_ENCRYPT_KEY: 'ab'.repeat(32),
          JWT_SECRET: 'long-enough-test-jwt-123456789012345',
          ENCRYPT_ALGORITHM: 'aes-256-ecb',
        },
        (value) => output.push(value),
      ),
    ).toBe(2)
    expect(JSON.parse(output[0]).issues).toContainEqual({
      code: 'REMOVED_ENCRYPTION_OPTION',
      path: 'ENCRYPT_ALGORITHM',
    })
    expect(
      (await context.pool.query('SELECT id FROM _app_migrations')).rows,
    ).toEqual([])
  })

  it('rejects the removed prepare command without modifying the database', async () => {
    const output: string[] = []
    expect(
      await runUpgradeCli(
        ['prepare', '--all-replicas-v2'],
        {
          PG_URL: context.connectionString,
          MX_ENCRYPT_KEY: 'ab'.repeat(32),
          JWT_SECRET: 'long-enough-test-jwt-123456789012345',
        },
        (value) => output.push(value),
      ),
    ).toBe(1)
    expect(
      (await context.pool.query('SELECT id FROM _app_migrations')).rows,
    ).toEqual([])
  })

  it('reports bad runtime settings in a fresh process without bootstrap failure', async () => {
    const result = await promisify(execFile)(
      'node_modules/.bin/vite-node',
      [
        '--config',
        'vite.upgrade.config.ts',
        'src/upgrade.ts',
        'check',
        '--json',
      ],
      {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        env: {
          ...process.env,
          PG_URL: context.connectionString,
          MX_ENCRYPT_KEY: 'invalid-key',
          JWT_SECRET: 'bad-jwt-secret',
        },
      },
    ).catch((error) => error)
    expect(result.code, result.stdout + result.stderr).toBe(2)
    const report = JSON.parse(result.stdout.trim())
    expect(report.status).toBe('needs-action')
    expect(report.issues.map((issue) => issue.code)).toContain(
      'FIELD_KEY_INVALID',
    )
    expect(result.stdout + result.stderr).not.toContain('bad-jwt-secret')
  }, 30000)

  it('separates ready, needs-action and connection errors by exit status', async () => {
    const output: string[] = []
    const env = {
      PG_URL: context.connectionString,
      MX_ENCRYPT_KEY: 'ab'.repeat(32),
      JWT_SECRET: 'long-enough-test-jwt-123456789012345',
    }
    expect(
      await runUpgradeCli(['check', '--json'], env, (value) => {
        output.push(value)
      }),
    ).toBe(0)
    expect(
      await runUpgradeCli(
        ['check', '--json'],
        { ...env, JWT_SECRET: 'short' },
        (value) => {
          output.push(value)
        },
      ),
    ).toBe(2)
    expect(
      await runUpgradeCli(
        ['check', '--json'],
        { ...env, PG_URL: 'postgres://no-secret@127.0.0.1:1/missing' },
        (value) => {
          output.push(value)
        },
      ),
    ).toBe(1)
    expect(JSON.parse(output[2]).status).toBe('error')
    expect(output.join('')).not.toContain('no-secret')
  })
})
