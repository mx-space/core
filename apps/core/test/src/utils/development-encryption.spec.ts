import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { createPgTestDatabase } from 'test/helper/pg-verify-url'

import { SecretCodec } from '~/utils/secret-codec'

it('runs development migrations without a configured field key and preserves encrypted credentials on restart', async () => {
  const context = await createPgTestDatabase('mx_development_key')
  const directory = await mkdtemp(join(tmpdir(), 'mx-dev-migrations-'))
  const core = fileURLToPath(new URL('../../../', import.meta.url))
  try {
    await context.pool.query(
      "INSERT INTO options (id,name,value) VALUES ('100','membership',$1)",
      [{ dodoApiKey: 'retained-development-token' }],
    )
    const overrides = {
      NODE_ENV: 'development',
      PG_URL: context.connectionString,
      PG_CONNECTION_STRING: context.connectionString,
      MIGRATIONS_DIR: join(core, 'src/database/migrations'),
      JWT_SECRET: 'development-migration-jwt-at-least-32-characters',
    }
    const run = () =>
      promisify(execFile)(
        join(core, 'node_modules/.bin/vite-node'),
        [
          '--config',
          join(core, 'test/fixtures/development-migrations.config.ts'),
          join(core, 'test/fixtures/development-migrations.ts'),
        ],
        {
          cwd: core,
          env: {
            ...process.env,
            DEV_MIGRATION_TEST_ENV: JSON.stringify(overrides),
            SECURITY_CONFIG_TEST_CWD: directory,
          },
        },
      ).catch((error) => {
        throw new Error(`${error.message}\n${error.stdout}`)
      })
    await run()
    const keyFile = join(directory, 'tmp/dev-encryption.key')
    const key = await readFile(keyFile, 'utf8')
    const rows = () =>
      context.pool.query('SELECT name,value FROM options ORDER BY name')
    const first = (await rows()).rows
    const membership = first.find((row) => row.name === 'membership')!.value
    expect(membership.apiKey).toMatch(/^\$\$\{mx\}\$\$v2\./)
    expect(
      new SecretCodec({ key }).decrypt(membership.apiKey, 'membership.apiKey'),
    ).toBe('retained-development-token')
    expect(
      (
        await context.pool.query(
          "SELECT id FROM _app_migrations WHERE id='20261109-required-secret-storage'",
        )
      ).rowCount,
    ).toBe(1)
    await run()
    expect((await rows()).rows).toEqual(first)
    expect(await readFile(keyFile, 'utf8')).toBe(key)
  } finally {
    await context.close()
    await rm(directory, { recursive: true })
  }
}, 60000)
