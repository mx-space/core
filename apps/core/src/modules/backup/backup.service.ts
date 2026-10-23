import { createReadStream, existsSync, statSync } from 'node:fs'
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { join, resolve } from 'node:path'
import { Readable } from 'node:stream'

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { CronExpression } from '@nestjs/schedule'
import { mkdirp } from 'mkdirp'

import { POSTGRES } from '~/app.config'
import { CronDescription } from '~/common/decorators/cron-description.decorator'
import { CronOnce } from '~/common/decorators/cron-once.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { BACKUP_DIR, DATA_DIR } from '~/constants/path.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { S3Uploader } from '~/utils/s3.util'
import { $, $throw } from '~/utils/shell.util'
import { getFolderSize } from '~/utils/system.util'
import { getMediumDateTime } from '~/utils/time.util'

import { ConfigsService } from '../configs/configs.service'
import {
  backupEncryptionPublicKey,
  decryptBackup,
  encryptBackup,
} from './backup-crypto'

const excludeTables = [
  'analyzes',
  'webhook_events',
  'serverless_logs',
  'sessions',
  'verifications',
  'search_documents',
  'activities',
]

const excludeFolders = [
  'backup',
  'log',
  'node_modules',
  'admin',
  'temp',
  'trash',
  'backup_data',
  'temp_copy_need',
]

@Injectable()
export class BackupService {
  private logger: Logger

  constructor(
    private readonly eventManager: EventManagerService,

    private readonly configs: ConfigsService,
    private readonly redisService: RedisService,
  ) {
    this.logger = new Logger(BackupService.name)
  }

  private async safeListDir(dir: string, limit = 30) {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      return entries
        .slice(0, limit)
        .map((e) => `${e.isDirectory() ? 'dir' : 'file'}:${e.name}`)
        .join(', ')
    } catch (error: any) {
      return `<unreadable: ${error?.message || String(error)}>`
    }
  }

  private async commandExists(command: string) {
    const res = await $(`command -v ${command} >/dev/null 2>&1`)
    return res.exitCode === 0
  }

  private shellQuote(value: string | number) {
    return `'${String(value).replaceAll("'", `'\\''`)}'`
  }

  // Resolve `candidate` against `dir` and assert it stays inside `dir`.
  // Rejects zip-slip (`../`), absolute paths, and any escape attempt.
  private assertContained(dir: string, candidate: string): string {
    const base = resolve(dir)
    const target = resolve(base, candidate)
    if (target !== base && !target.startsWith(base + path.sep)) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: `Path escapes target directory: ${candidate}`,
      })
    }
    return target
  }

  // Safe in-process zip extraction (replaces shell `unzip`).
  // Validates every entry against zip-slip; rejects absolute paths and symlinks.
  private async safeUnzip(buffer: Buffer, destDir: string) {
    const base = resolve(destDir)
    const JSZip = (await import('jszip')).default
    const zip = await new JSZip().loadAsync(buffer)

    const entries = Object.values(zip.files)
    if (entries.length > 10_000)
      throw new Error('Backup exceeds entry count limit')
    let expandedBytes = 0
    for (const entry of entries) {
      const name = entry.name
      if (path.isAbsolute(name) || /^[a-z]:[/\\]/i.test(name)) {
        throw createAppException(AppErrorCode.INVALID_PARAMETER, {
          message: `Absolute path entry rejected: ${name}`,
        })
      }
      // Symlink entries carry unix mode bits with the symlink flag (0o120000).
      const unixMode = (entry as any).unixPermissions as number | null
      if (typeof unixMode === 'number' && (unixMode & 0o170000) === 0o120000) {
        throw createAppException(AppErrorCode.INVALID_PARAMETER, {
          message: `Symlink entry rejected: ${name}`,
        })
      }
      // assertContained throws if the entry escapes destDir.
      this.assertContained(base, name)
    }

    for (const entry of entries) {
      const target = this.assertContained(base, entry.name)
      if (entry.dir) {
        await mkdir(target, { recursive: true })
        continue
      }
      await mkdir(path.dirname(target), { recursive: true })
      async function* boundedContent() {
        let entryBytes = 0
        for await (const chunk of new Readable().wrap(
          entry.nodeStream('nodebuffer'),
        )) {
          entryBytes += chunk.length
          expandedBytes += chunk.length
          if (
            entryBytes > 256 * 1024 * 1024 ||
            expandedBytes > 1024 * 1024 * 1024
          ) {
            throw new Error('Backup exceeds expanded size limit')
          }
          yield chunk
        }
      }
      await writeFile(target, boundedContent())
    }
  }

  private pgEnvironment() {
    // Keep connection credentials out of shell commands and command-failure logs.
    return {
      ...process.env,
      PGHOST: POSTGRES.host,
      PGPORT: String(POSTGRES.port),
      PGUSER: POSTGRES.user,
      PGPASSWORD: POSTGRES.password,
      PGDATABASE: POSTGRES.connectionString || POSTGRES.database,
    }
  }

  private get excludeTableArgs() {
    return excludeTables.map((t) => `--exclude-table=${t}`).join(' ')
  }

  async list() {
    const backupPath = BACKUP_DIR
    if (!existsSync(backupPath)) {
      return []
    }
    const backupFilenames = await readdir(backupPath)
    const backups: { filename: string; path: string }[] = []

    for (const filename of backupFilenames) {
      const path = resolve(backupPath, filename)
      if (!statSync(path).isDirectory()) {
        continue
      }
      if (
        !existsSync(join(path, `backup-${filename}.mxbackup`)) &&
        !existsSync(join(path, `backup-${filename}.zip`))
      ) {
        continue
      }
      backups.push({
        filename,
        path,
      })
    }
    return Promise.all(
      backups.map(async ({ filename, path }) => {
        const size = await getFolderSize(path)
        return {
          filename,
          size,
          encrypted: existsSync(join(path, `backup-${filename}.mxbackup`)),
        }
      }),
    )
  }

  async backup() {
    const options = await this.configs.get('backupOptions')
    const encryptionKey = options.encryptionEnabled
      ? backupEncryptionPublicKey(options.encryptionPublicKey)
      : undefined
    this.logger.log('--> Backing up database')
    const dateDir = getMediumDateTime(new Date())
    // Isolate plaintext staging from downloadable backups and concurrent runs.
    const workDir = await mkdtemp(join(tmpdir(), 'mx-backup-'))
    let backupDirPath: string | undefined

    const runStep = async (
      step: string,
      command: string,
      options?: Parameters<typeof $throw>[1],
    ) => {
      try {
        return await $throw(command, options)
      } catch (error: any) {
        error.step = step
        error.cwd = options?.cwd || process.cwd()
        throw error
      }
    }

    try {
      const dumpedDbDir = join(workDir, 'mx-space')
      mkdirp.sync(dumpedDbDir)
      const dumpFilePath = join(dumpedDbDir, 'pg.dump')

      await runStep(
        'pg_dump',
        `pg_dump --format=custom --dbname "$PGDATABASE" ${this.excludeTableArgs} -f ${this.shellQuote(dumpFilePath)}`,
        { env: this.pgEnvironment() },
      )

      if (!existsSync(dumpFilePath)) {
        const error = new Error(
          `pg_dump ran but produced no file: ${dumpFilePath} (check DB name, connection, and permissions)`,
        ) as any
        error.step = 'pg_dump'
        error.cwd = workDir
        throw error
      }
      const dumpStat = statSync(dumpFilePath)
      if (dumpStat.size === 0) {
        const error = new Error(
          `pg_dump produced an empty file: ${dumpFilePath} (common cause of zip exit code 12)`,
        ) as any
        error.step = 'pg_dump'
        error.cwd = workDir
        throw error
      }

      const flags = excludeFolders.map((item) => `--exclude ${item}`).join(' ')
      await runStep(
        'copy-data',
        `rsync -a ${flags} ${this.shellQuote(`${DATA_DIR}/`)} ${this.shellQuote(join(workDir, 'backup_data'))}`,
      )
      await runStep('zip', 'zip -qr backup.zip mx-space backup_data', {
        cwd: workDir,
      })

      const archive = await readFile(join(workDir, 'backup.zip'))
      const buffer = encryptionKey
        ? encryptBackup(archive, encryptionKey)
        : archive
      await mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 })
      backupDirPath = await mkdtemp(join(BACKUP_DIR, `${dateDir}-`))
      const filePath = join(
        backupDirPath,
        `backup-${path.basename(backupDirPath)}.${encryptionKey ? 'mxbackup' : 'zip'}`,
      )
      await writeFile(filePath, buffer, { mode: 0o600, flag: 'wx' })

      this.logger.log('--> Backup completed successfully')
      return { buffer, path: filePath }
    } catch (error) {
      const step = (error as any)?.step ? `step=${(error as any).step}` : ''
      const cwd = (error as any)?.cwd ? `cwd=${(error as any).cwd}` : ''
      const stderr = (error as any)?.stderr
        ? `\n\nstderr:\n${(error as any).stderr}`
        : ''
      const stdout = (error as any)?.stdout
        ? `\n\nstdout:\n${(error as any).stdout}`
        : ''

      // Extra diagnostics: command availability and current backup directory contents
      const [hasZip, hasPgDump, hasPgRestore] = await Promise.all([
        this.commandExists('zip'),
        this.commandExists('pg_dump'),
        this.commandExists('pg_restore'),
      ])
      const backupDirContent = await this.safeListDir(workDir)

      this.logger.error(
        `--> Backup failed (${[step, cwd].filter(Boolean).join(', ')}): ${error.message}` +
          `${stderr}${stdout}\n\n` +
          `diagnostics:\n` +
          `- zip: ${hasZip ? 'found' : 'missing'}\n` +
          `- pg_dump: ${hasPgDump ? 'found' : 'missing'}\n` +
          `- pg_restore: ${hasPgRestore ? 'found' : 'missing'}\n` +
          `- workDir(${workDir}): ${backupDirContent}`,
      )
      if (backupDirPath) {
        await rm(backupDirPath, { recursive: true, force: true })
      }
      throw error
    } finally {
      await rm(workDir, { recursive: true, force: true })
    }
  }

  async getFileStream(dirname: string) {
    const path = this.checkBackupExist(dirname)
    return createReadStream(path)
  }

  checkBackupExist(dirname: string) {
    if (/[/\\]|\.\./.test(dirname)) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'invalid dirname',
      })
    }
    for (const extension of ['mxbackup', 'zip']) {
      const filePath = join(
        BACKUP_DIR,
        dirname,
        `backup-${dirname}.${extension}`,
      )
      if (existsSync(filePath)) return filePath
    }
    throw createAppException(AppErrorCode.FILE_NOT_FOUND)
  }

  async saveTempBackupByUpload(buffer: Buffer, decryptionKey?: string) {
    const tempDirPath = await mkdtemp(join(tmpdir(), 'mx-backup-upload-'))
    try {
      const tempBackupPath = join(tempDirPath, 'backup')
      await writeFile(tempBackupPath, buffer, { mode: 0o600 })
      await this.restore(tempBackupPath, decryptionKey)
    } finally {
      await rm(tempDirPath, { recursive: true, force: true })
    }
    await this.eventManager.broadcast(
      BusinessEvents.CONTENT_REFRESH,
      'restore_done',
      {
        scope: EventScope.ALL,
      },
    )
  }

  async restore(restoreFilePath: string, decryptionKey?: string) {
    const isExist = existsSync(restoreFilePath)
    if (!isExist) {
      throw new InternalServerErrorException('Backup file does not exist')
    }
    let archive: Buffer
    try {
      archive = decryptBackup(await readFile(restoreFilePath), decryptionKey)
    } catch (error) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: error.message,
      })
    }
    const dirPath = await mkdtemp(join(tmpdir(), 'mx-backup-restore-'))
    try {
      // Unzip — in-process, zip-slip-safe extraction (no shell `unzip`).
      try {
        await this.safeUnzip(archive, dirPath)
      } catch (error: any) {
        this.logger.error(
          `unzip failed: ${error?.message || error}\n\n${error?.stderr || ''}`,
        )
        throw error
      }
      try {
        // Verify
        if (!existsSync(join(dirPath, 'mx-space'))) {
          throw new InternalServerErrorException(
            'Invalid backup file: directory does not exist',
          )
        }

        const dumpFilePath = join(dirPath, 'mx-space', 'pg.dump')
        if (!existsSync(dumpFilePath)) {
          throw new InternalServerErrorException(
            'Invalid backup file: database dump does not exist',
          )
        }

        const backupDataDir = join(dirPath, 'backup_data')
        if (
          !existsSync(backupDataDir) ||
          !statSync(backupDataDir).isDirectory()
        ) {
          throw new InternalServerErrorException(
            'Invalid backup file: data directory does not exist',
          )
        }

        const restoreSql = join(dirPath, 'restore.sql')
        await $throw(
          `pg_restore --clean --if-exists --no-owner --no-acl --file ${this.shellQuote(restoreSql)} ${this.shellQuote(dumpFilePath)}`,
        )

        // Authenticate and validate the input before taking a safety snapshot or mutating data.
        await this.backup()

        // Omitted runtime tables still reference restored tables; recreate their empty schemas atomically.
        const runtimeSchema = join(dirPath, 'runtime-schema.sql')
        const prepareSql = join(dirPath, 'prepare.sql')
        await $throw(
          `pg_dump --schema-only --clean --if-exists --no-owner --no-acl --dbname "$PGDATABASE" ${excludeTables.map((table) => `--table=public.${table}`).join(' ')} -f ${this.shellQuote(runtimeSchema)}`,
          { env: this.pgEnvironment() },
        )
        await writeFile(
          prepareSql,
          `DROP TABLE IF EXISTS ${excludeTables.map((table) => `public."${table}"`).join(', ')} CASCADE;`,
        )
        await $throw(
          `psql --no-psqlrc --single-transaction --set=ON_ERROR_STOP=on --dbname "$PGDATABASE" --file ${this.shellQuote(prepareSql)} --file ${this.shellQuote(restoreSql)} --file ${this.shellQuote(runtimeSchema)}`,
          { cwd: dirPath, env: this.pgEnvironment() },
        )
      } catch (error) {
        this.logger.error(
          `restore failed: ${(error as any)?.message || error}\n\n${
            (error as any)?.stderr || ''
          }`,
        )
        throw error
      } finally {
        await rm(join(dirPath, 'mx-space'), { recursive: true, force: true })
      }
      // Restore backup_data

      const backupDataDir = join(dirPath, 'backup_data')

      const backupDataDirFilenames = await readdir(backupDataDir)

      for (const filename of backupDataDirFilenames) {
        // Containment: source must stay within the extracted backup_data dir,
        // destination within DATA_DIR. Rejects `..`/absolute filenames.
        const fullpath = this.assertContained(backupDataDir, filename)
        const targetPath = this.assertContained(DATA_DIR, filename)

        await rm(targetPath, { recursive: true, force: true })

        await $throw(
          `cp -r ${this.shellQuote(fullpath)} ${this.shellQuote(targetPath)}`,
        )
      }

      // SECURITY: never auto-install dependencies from a restored archive.
      // An uploaded archive is attacker-controlled; running `npm install` on its
      // declared deps is arbitrary-code-execution via install scripts. Instead we
      // surface the package list so an admin can review and install manually.
      try {
        const packageJson = await readFile(
          join(backupDataDir, 'package.json'),
          {
            encoding: 'utf8',
          },
        )
        const pkg = JSON.parse(packageJson)
        const deps = pkg?.dependencies
        if (deps && typeof deps === 'object' && Object.keys(deps).length > 0) {
          const list = Object.entries(deps)
            .map(([name, version]) => `${name}@${version}`)
            .join(', ')
          this.logger.warn(
            `--> Restored archive declares ${
              Object.keys(deps).length
            } dependencies. Automatic installation is disabled for security ` +
              `(install scripts can execute arbitrary code). Review and install ` +
              `manually if required: ${list}`,
          )
        }
      } catch {
        // package.json absent or unpar. Restores without a manifest are valid.
      }

      await Promise.all([
        this.redisService.cleanAllRedisKey(),
        this.redisService.cleanCatch(),
      ])
    } finally {
      await rm(dirPath, { force: true, recursive: true })
    }
  }

  async rollbackTo(dirname: string, decryptionKey?: string) {
    const bakFilePath = this.checkBackupExist(dirname)

    await this.restore(bakFilePath, decryptionKey)

    await this.eventManager.broadcast(
      BusinessEvents.CONTENT_REFRESH,
      'restore_done',
      {
        scope: EventScope.ALL,
      },
    )
  }

  async deleteBackup(filename: string) {
    if (/[/\\]|\.\./.test(filename)) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'invalid filename',
      })
    }
    const filePath = join(BACKUP_DIR, filename)
    if (!existsSync(filePath)) {
      throw createAppException(AppErrorCode.FILE_NOT_FOUND)
    }

    await rm(filePath, { recursive: true })
    return true
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, { name: 'backupDB' })
  @CronDescription('Back up the database and upload to object storage')
  async backupDB() {
    const { backupOptions: configs } = await this.configs.waitForConfigReady()
    if (!configs.enable) {
      return
    }

    const backup = await this.backup()

    const { endpoint, bucket, region, secretId, secretKey } = configs
    if (!endpoint || !bucket || !region || !secretId || !secretKey) {
      return
    }

    const s3 = new S3Uploader({
      bucket,
      region,
      accessKey: secretId,
      secretKey,
      endpoint,
    })

    const remoteFileKey = path.basename(backup.path)
    this.logger.log('--> Starting upload to S3')
    await s3
      .uploadFile(backup.buffer, remoteFileKey, 'backup')
      .catch((error) => {
        this.logger.error('--> Upload failed')
        throw error
      })

    this.logger.log('--> Upload succeeded')
  }
}
