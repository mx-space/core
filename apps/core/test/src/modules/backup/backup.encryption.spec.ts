import { generateKeyPairSync } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import JSZip from 'jszip'

import { BackupService } from '~/modules/backup/backup.service'
import { decryptBackup } from '~/modules/backup/backup-crypto'
import { S3Uploader } from '~/utils/s3.util'
import { $throw } from '~/utils/shell.util'

const fixture = vi.hoisted(() => ({
  root: `/tmp/mx-backup-spec-${process.pid}-${Math.random().toString(36).slice(2)}`,
  database: 'retained-database-credential',
  failDump: false,
}))

vi.mock('../../../../src/app.config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/app.config')>()),
  POSTGRES: {
    host: 'localhost',
    port: 5432,
    user: 'backup-test',
    password: 'pg-password',
    database: 'test',
  },
}))
vi.mock('../../../../src/constants/path.constant', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/constants/path.constant')>()),
  DATA_DIR: `${fixture.root}/data`,
  BACKUP_DIR: `${fixture.root}/data/backup`,
}))
vi.mock('../../../../src/utils/s3.util', () => ({
  S3Uploader: vi.fn(function () {
    return { uploadFile: vi.fn().mockResolvedValue(undefined) }
  }),
}))
vi.mock('../../../../src/utils/shell.util', async () => {
  const actual = await vi.importActual<typeof import('~/utils/shell.util')>(
    '../../../../src/utils/shell.util',
  )
  return {
    ...actual,
    $throw: vi.fn(async (command: string, options?: any) => {
      if (command.startsWith('pg_dump ')) {
        if (fixture.failDump) throw new Error('simulated export failure')
        await writeFile(
          command.match(/-f '([^']+)'/)![1],
          command.includes('--schema-only')
            ? '-- runtime schema'
            : fixture.database,
        )
      } else if (command.startsWith('pg_restore ')) {
        const database = await readFile(command.match(/'([^']+)'$/)![1], 'utf8')
        await writeFile(command.match(/--file '([^']+)'/)![1], database)
      } else if (command.startsWith('psql ')) {
        const files = [...command.matchAll(/--file '([^']+)'/g)].map(
          (match) => match[1],
        )
        fixture.database = await readFile(files[1], 'utf8')
      } else {
        return actual.$throw(command, options)
      }
      return { stdout: '', stderr: '', exitCode: 0 }
    }),
  }
})

let service: BackupService
let redis: {
  cleanAllRedisKey: ReturnType<typeof vi.fn>
  cleanCatch: ReturnType<typeof vi.fn>
}
const keys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
const backupOptions = {
  encryptionEnabled: true,
  encryptionPublicKey: keys.publicKey,
  enable: true,
  endpoint: 'https://s3.example.test',
  bucket: 'test',
  region: 'auto',
  secretId: 'access-id',
  secretKey: 's3-secret',
}

beforeEach(async () => {
  vi.clearAllMocks()
  backupOptions.encryptionEnabled = true
  backupOptions.encryptionPublicKey = keys.publicKey
  fixture.database = 'retained-database-credential'
  fixture.failDump = false
  await mkdir(join(fixture.root, 'data'), { recursive: true, mode: 0o700 })
  await writeFile(
    join(fixture.root, 'data/credential.txt'),
    'retained-file-credential',
  )
  redis = { cleanAllRedisKey: vi.fn(), cleanCatch: vi.fn() }
  service = new BackupService(
    { broadcast: vi.fn() } as any,
    {
      get: async () => backupOptions,
      waitForConfigReady: async () => ({ backupOptions }),
    } as any,
    redis as any,
  )
})

afterEach(async () => {
  await rm(fixture.root, { recursive: true, force: true })
})

it('stores, serves and uploads encrypted bytes while retaining all credentials', async () => {
  const backup = await service.backup()
  expect(backup.path.endsWith('.mxbackup')).toBe(true)
  expect(await readFile(backup.path)).toEqual(backup.buffer)
  const dirname = backup.path.split('/').at(-2)!
  const stream = await service.getFileStream(dirname)
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  expect(Buffer.concat(chunks)).toEqual(backup.buffer)
  expect(
    backup.buffer.includes(Buffer.from('retained-database-credential')),
  ).toBe(false)
  const zip = await JSZip.loadAsync(
    decryptBackup(backup.buffer, keys.privateKey),
  )
  expect(await zip.file('mx-space/pg.dump')!.async('string')).toBe(
    fixture.database,
  )
  expect(await zip.file('backup_data/credential.txt')!.async('string')).toBe(
    'retained-file-credential',
  )
  expect(await readdir(join(fixture.root, 'data/backup', dirname))).toEqual([
    backup.path.split('/').at(-1),
  ])

  await service.backupDB()
  const uploader = vi.mocked(S3Uploader).mock.results[0].value
  const [uploaded, name] = uploader.uploadFile.mock.calls[0]
  expect(name.endsWith('.mxbackup')).toBe(true)
  const uploadedPath = (await service.list())
    .map(({ filename }) => service.checkBackupExist(filename))
    .find((filePath) => filePath.endsWith(name))!
  expect(uploaded).toEqual(await readFile(uploadedPath))
  const uploadedZip = await JSZip.loadAsync(
    decryptBackup(uploaded, keys.privateKey),
  )
  expect(await uploadedZip.file('mx-space/pg.dump')!.async('string')).toBe(
    fixture.database,
  )
  expect(
    vi.mocked($throw).mock.calls.every(([cmd]) => !cmd.includes('pg-password')),
  ).toBe(true)
})

it('restores encrypted uploads and old ZIPs with their database and file credentials', async () => {
  const backup = await service.backup()
  for (const archive of [
    backup.buffer,
    decryptBackup(backup.buffer, keys.privateKey),
  ]) {
    fixture.database = 'changed'
    await writeFile(join(fixture.root, 'data/credential.txt'), 'changed')
    await service.saveTempBackupByUpload(archive, keys.privateKey)
    expect(fixture.database).toBe('retained-database-credential')
    expect(
      await readFile(join(fixture.root, 'data/credential.txt'), 'utf8'),
    ).toBe('retained-file-credential')
  }
  expect(redis.cleanAllRedisKey).toHaveBeenCalledTimes(2)
  expect((await service.list()).length).toBe(3)
})

it('rejects wrong keys and damaged input before snapshots, database or cache operations', async () => {
  const backup = await service.backup()
  const takeSnapshot = vi.spyOn(service, 'backup')
  vi.mocked($throw).mockClear()
  await expect(
    service.saveTempBackupByUpload(backup.buffer, 'wrong-key'),
  ).rejects.toThrow('wrong key')
  backupOptions.encryptionEnabled = true
  backupOptions.encryptionPublicKey = keys.publicKey
  const corrupted = Buffer.from(backup.buffer)
  corrupted[corrupted.length - 1] ^= 1
  for (const invalid of [
    corrupted,
    backup.buffer.subarray(0, 30),
    Buffer.from('invalid'),
  ]) {
    await expect(
      service.saveTempBackupByUpload(invalid, keys.privateKey),
    ).rejects.toThrow()
  }
  expect(takeSnapshot).not.toHaveBeenCalled()
  expect($throw).not.toHaveBeenCalled()
  expect(redis.cleanAllRedisKey).not.toHaveBeenCalled()
  expect(fixture.database).toBe('retained-database-credential')
})

it('fails before exporting when the key is absent, and cleans plaintext after export errors', async () => {
  backupOptions.encryptionPublicKey = ''
  await expect(service.backup()).rejects.toThrow('public key')
  expect($throw).not.toHaveBeenCalled()
  backupOptions.encryptionEnabled = true
  backupOptions.encryptionPublicKey = keys.publicKey
  fixture.failDump = true
  await expect(service.backup()).rejects.toThrow('simulated export failure')
  const failedPath = vi
    .mocked($throw)
    .mock.calls[0][0].match(/-f '([^']+)'/)![1]
  expect(existsSync(failedPath.split('/mx-space/')[0])).toBe(false)
  expect(await service.list()).toEqual([])
})

it('creates ordinary ZIPs when encryption is disabled and needs a private key only during recovery', async () => {
  backupOptions.encryptionEnabled = false
  backupOptions.encryptionPublicKey = ''
  const backup = await service.backup()
  expect(backup.path.endsWith('.zip')).toBe(true)
  expect((await service.list())[0].encrypted).toBe(false)
  const zip = await JSZip.loadAsync(backup.buffer)
  expect(await zip.file('mx-space/pg.dump')!.async('string')).toBe(
    fixture.database,
  )
  await service.saveTempBackupByUpload(backup.buffer)
})
