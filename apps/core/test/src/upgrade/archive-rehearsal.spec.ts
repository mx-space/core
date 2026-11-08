import { execFileSync } from 'node:child_process'
import { createCipheriv, randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import JSZip from 'jszip'
import { legacySecret } from 'test/helper/legacy-secret'
import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { decryptBackup } from '~/modules/backup/backup-crypto'
import { SecretCodec } from '~/utils/secret-codec'

const entry = fileURLToPath(
  new URL('../../../out/upgrade.mjs', import.meta.url),
)
const migrateEntry = fileURLToPath(
  new URL('../../../out/migrate.mjs', import.meta.url),
)

describe.skipIf(!existsSync(entry) || !existsSync(migrateEntry))(
  'historical archive → private PG → built release migration',
  () => {
    let source: Awaited<ReturnType<typeof createPgTestDatabase>>
    let target: Awaited<ReturnType<typeof createPgTestDatabase>>
    let cliCwd: string
    beforeAll(async () => {
      cliCwd = mkdtempSync(join(tmpdir(), 'mx-upgrade-rehearsal-'))
      source = await createPgTestDatabase('mx_archive_source')
      target = await createPgTestDatabase('mx_archive_target')
    })
    afterAll(async () => {
      await target?.close()
      await source?.close()
      if (cliCwd) rmSync(cliCwd, { recursive: true })
    })

    it('restores ZIP/v1 contents using original keys, then migrates through the shipped release entry', async (test) => {
      const url = new URL(source.connectionString)
      const container = execFileSync(
        'docker',
        ['ps', '--filter', `publish=${url.port}`, '--format', '{{.ID}}'],
        { encoding: 'utf8' },
      ).trim()
      if (!container || container.includes('\n')) {
        test.skip()
        return
      }
      const key = 'ab'.repeat(32)
      await source.pool.query(
        "INSERT INTO options (id, name, value) VALUES ('100', 'membership', $1)",
        [
          {
            dodoApiKey: legacySecret('retained-billing-token', key),
          },
        ],
      )
      const pgEnv = (database: string) => ({
        ...process.env,
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: database,
      })
      const dump = execFileSync(
        'docker',
        [
          'exec',
          '-e',
          'PGUSER',
          '-e',
          'PGPASSWORD',
          '-e',
          'PGDATABASE',
          container,
          'pg_dump',
          '-Fc',
          '--table=public.options',
        ],
        { env: pgEnv(url.pathname.slice(1)), maxBuffer: 10 * 1024 * 1024 },
      )
      const zip = await new JSZip()
        .file('mx-space/pg.dump', dump)
        .file('backup_data/proof.txt', 'retained-file')
        .generateAsync({ type: 'nodebuffer' })
      expect(decryptBackup(zip, undefined)).toEqual(zip)
      const recoveryKey = randomBytes(32)
      const nonce = randomBytes(12)
      const header = Buffer.from('MXBACKUP\x01')
      const cipher = createCipheriv('aes-256-gcm', recoveryKey, nonce)
      cipher.setAAD(header)
      const payload = Buffer.concat([cipher.update(zip), cipher.final()])
      const archive = Buffer.concat([
        header,
        nonce,
        cipher.getAuthTag(),
        payload,
      ])
      expect(() => decryptBackup(archive, 'cd'.repeat(32))).toThrow()
      const restored = await JSZip.loadAsync(
        decryptBackup(archive, recoveryKey.toString('hex')),
      )
      expect(
        await restored.file('backup_data/proof.txt')!.async('string'),
      ).toBe('retained-file')
      execFileSync(
        'docker',
        [
          'exec',
          '-i',
          '-e',
          'PGUSER',
          '-e',
          'PGPASSWORD',
          '-e',
          'PGDATABASE',
          container,
          'pg_restore',
          '--single-transaction',
          '--exit-on-error',
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-acl',
          '-d',
          new URL(target.connectionString).pathname.slice(1),
        ],
        {
          env: pgEnv(new URL(target.connectionString).pathname.slice(1)),
          input: await restored.file('mx-space/pg.dump')!.async('nodebuffer'),
        },
      )
      const env = {
        ...process.env,
        ENCRYPT_ENABLE: undefined,
        MX_ENCRYPT_ENABLE: undefined,
        MX_SECRET_STORAGE_V2: undefined,
        PG_URL: target.connectionString,
        PG_CONNECTION_STRING: target.connectionString,
        MX_ENCRYPT_KEY: key,
        JWT_SECRET: 'private-rehearsal-jwt-123456789012345',
        NODE_ENV: 'production',
        SNOWFLAKE_WORKER_ID: '1',
        MIGRATIONS_DIR: fileURLToPath(
          new URL('../../../src/database/migrations', import.meta.url),
        ),
      }
      const run = (args: string[]) => {
        try {
          return JSON.parse(
            execFileSync(process.execPath, [entry, ...args], {
              cwd: cliCwd,
              env,
              encoding: 'utf8',
            }),
          )
        } catch (error) {
          // Diagnostic reports intentionally omit stored secret values.
          const { stdout, stderr } = error as { stdout: string; stderr: string }
          throw new Error(`${stdout}\n${stderr}`, { cause: error })
        }
      }
      expect(
        (
          await target.pool.query(
            "SELECT value FROM options WHERE name = 'membership'",
          )
        ).rows[0].value,
      ).toHaveProperty('dodoApiKey')
      const migrationOutput = execFileSync(process.execPath, [migrateEntry], {
        cwd: cliCwd,
        env,
        encoding: 'utf8',
      })
      const report = run(['check', '--json'])
      expect(
        report,
        `${JSON.stringify(report)}\n${migrationOutput}`,
      ).toMatchObject({
        status: 'ready',
      })
      const canonical = (
        await target.pool.query(
          "SELECT value FROM options WHERE name = 'membership'",
        )
      ).rows[0].value
      expect(
        new SecretCodec({ key }).decrypt(canonical.apiKey, 'membership.apiKey'),
      ).toBe('retained-billing-token')
    }, 30000)
  },
)
