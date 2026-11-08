import { execFileSync } from 'node:child_process'
import { createCipheriv, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import JSZip from 'jszip'
import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { decryptBackup } from '~/modules/backup/backup-crypto'
import { SecretCodec } from '~/utils/secret-codec'

const entry = fileURLToPath(
  new URL('../../../out/upgrade.mjs', import.meta.url),
)

describe.skipIf(!existsSync(entry))(
  'historical archive → private PG → built upgrade CLI',
  () => {
    let source: Awaited<ReturnType<typeof createPgTestDatabase>>
    let target: Awaited<ReturnType<typeof createPgTestDatabase>>
    beforeAll(async () => {
      source = await createPgTestDatabase('mx_archive_source')
      target = await createPgTestDatabase('mx_archive_target')
    })
    afterAll(async () => {
      await target?.close()
      await source?.close()
    })

    it('restores ZIP/v1 contents using original keys, then prepares through the shipped entry', async (test) => {
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
      const codec = new SecretCodec({ key, enable: true, v2: false })
      await source.pool.query(
        "INSERT INTO options (id, name, value) VALUES ('100', 'membership', $1)",
        [
          {
            dodoApiKey: codec.encrypt(
              'retained-billing-token',
              'membership.dodoApiKey',
            ),
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
        PG_URL: target.connectionString,
        MX_ENCRYPT_KEY: key,
        MX_ENCRYPT_ENABLE: 'true',
        MX_SECRET_STORAGE_V2: 'true',
        JWT_SECRET: 'private-rehearsal-jwt-123456789012345',
      }
      const run = (args: string[]) =>
        JSON.parse(
          execFileSync(process.execPath, [entry, ...args], {
            env,
            encoding: 'utf8',
          }),
        )
      expect(run(['prepare', '--all-replicas-v2', '--dry-run'])).toMatchObject({
        status: 'would-be-ready',
        dryRun: true,
      })
      expect(
        (
          await target.pool.query(
            "SELECT value FROM options WHERE name = 'membership'",
          )
        ).rows[0].value,
      ).toHaveProperty('dodoApiKey')
      expect(run(['prepare', '--all-replicas-v2'])).toMatchObject({
        status: 'prepared',
      })
      expect(run(['check', '--json'])).toMatchObject({ status: 'ready' })
      const canonical = (
        await target.pool.query(
          "SELECT value FROM options WHERE name = 'membership'",
        )
      ).rows[0].value
      expect(
        new SecretCodec({ key, enable: true, v2: true }).decrypt(
          canonical.apiKey,
          'membership.apiKey',
        ),
      ).toBe('retained-billing-token')
    }, 30000)
  },
)
