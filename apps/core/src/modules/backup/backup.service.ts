import { createReadStream, existsSync, statSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path, { join, resolve } from 'node:path'

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { CronExpression } from '@nestjs/schedule'
import JSZip from 'jszip'
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
import { scheduleManager } from '~/utils/schedule.util'
import { $, $throw } from '~/utils/shell.util'
import { getFolderSize } from '~/utils/system.util'
import { getMediumDateTime } from '~/utils/time.util'

import { ConfigsService } from '../configs/configs.service'

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
  private async safeUnzip(zipFilePath: string, destDir: string) {
    const base = resolve(destDir)
    const buffer = await readFile(zipFilePath)
    const zip = await new JSZip().loadAsync(buffer)

    const entries = Object.values(zip.files)
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
      const content = await entry.async('nodebuffer')
      await writeFile(target, Uint8Array.from(content))
    }
  }

  private pgPasswordEnv() {
    return POSTGRES.password
      ? `PGPASSWORD=${this.shellQuote(POSTGRES.password)} `
      : ''
  }

  private get excludeTableArgs() {
    return excludeTables.map((t) => `--exclude-table=${t}`).join(' ')
  }

  private pgConnectionArgs() {
    if (POSTGRES.connectionString) {
      return `--dbname ${this.shellQuote(POSTGRES.connectionString)}`
    }

    return [
      `-h ${this.shellQuote(POSTGRES.host)}`,
      `-p ${POSTGRES.port}`,
      `-U ${this.shellQuote(POSTGRES.user)}`,
      `-d ${this.shellQuote(POSTGRES.database)}`,
    ].join(' ')
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
      backups.push({
        filename,
        path,
      })
    }
    return Promise.all(
      backups.map(async ({ filename, path }) => {
        const size = await getFolderSize(path)
        return { filename, size }
      }),
    )
  }

  async backup() {
    this.logger.log('--> Backing up database')
    // Use timestamp as directory name
    const dateDir = getMediumDateTime(new Date())

    const backupDirPath = join(BACKUP_DIR, dateDir)
    mkdirp.sync(backupDirPath)

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
      const dumpedDbDir = join(backupDirPath, 'mx-space')
      mkdirp.sync(dumpedDbDir)
      const dumpFilePath = join(dumpedDbDir, 'pg.dump')

      await runStep(
        'pg_dump',
        `${this.pgPasswordEnv()}pg_dump --format=custom ${this.excludeTableArgs} ${this.pgConnectionArgs()} -f ${this.shellQuote(dumpFilePath)}`,
      )

      if (!existsSync(dumpFilePath)) {
        const error = new Error(
          `pg_dump ran but produced no file: ${dumpFilePath} (check DB name, connection, and permissions)`,
        ) as any
        error.step = 'pg_dump'
        error.cwd = backupDirPath
        throw error
      }
      const dumpStat = statSync(dumpFilePath)
      if (dumpStat.size === 0) {
        const error = new Error(
          `pg_dump produced an empty file: ${dumpFilePath} (common cause of zip exit code 12)`,
        ) as any
        error.step = 'pg_dump'
        error.cwd = backupDirPath
        throw error
      }

      // Use a directory instead of a wildcard to avoid "zip error: Nothing to do" (exit code 12) when the directory is empty
      await runStep(
        'zip-db',
        `zip -r backup-${dateDir} mx-space && rm -rf mx-space`,
        {
          cwd: backupDirPath,
        },
      )

      // Bundle the data directory

      const flags = excludeFolders.map((item) => `--exclude ${item}`).join(' ')
      await rm(join(DATA_DIR, 'backup_data'), { recursive: true, force: true })
      await rm(join(DATA_DIR, 'temp_copy_need'), {
        recursive: true,
        force: true,
      })

      await runStep(
        'zip-data',
        `rsync -a . ./temp_copy_need --exclude temp_copy_need ${flags} && mv temp_copy_need backup_data && zip -r ${join(
          backupDirPath,
          `backup-${dateDir}`,
        )} ./backup_data && rm -rf backup_data`,
        { cwd: DATA_DIR },
      )

      this.logger.log('--> Backup completed successfully')
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
      const backupDirContent = await this.safeListDir(backupDirPath)

      this.logger.error(
        `--> Backup failed (${[step, cwd].filter(Boolean).join(', ')}): ${error.message}` +
          `${stderr}${stdout}\n\n` +
          `diagnostics:\n` +
          `- zip: ${hasZip ? 'found' : 'missing'}\n` +
          `- pg_dump: ${hasPgDump ? 'found' : 'missing'}\n` +
          `- pg_restore: ${hasPgRestore ? 'found' : 'missing'}\n` +
          `- backupDir(${backupDirPath}): ${backupDirContent}`,
      )
      throw error
    }
    const path = join(backupDirPath, `backup-${dateDir}.zip`)

    return {
      buffer: await readFile(path),
      path,
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
    const filePath = join(BACKUP_DIR, dirname, `backup-${dirname}.zip`)
    if (!existsSync(filePath)) {
      throw createAppException(AppErrorCode.FILE_NOT_FOUND)
    }
    return filePath
  }

  async saveTempBackupByUpload(buffer: Buffer) {
    const tempDirPath = '/tmp/mx-space/backup'
    const tempBackupPath = join(tempDirPath, 'backup.zip')
    mkdirp.sync(tempDirPath)
    await writeFile(tempBackupPath, buffer)

    await this.restore(tempBackupPath)
    await this.eventManager.broadcast(
      BusinessEvents.CONTENT_REFRESH,
      'restore_done',
      {
        scope: EventScope.ALL,
      },
    )
  }

  async restore(restoreFilePath: string) {
    await this.backup()
    const isExist = existsSync(restoreFilePath)
    if (!isExist) {
      throw new InternalServerErrorException('Backup file does not exist')
    }
    const dirPath = path.dirname(restoreFilePath)

    const tempdirs = ['mx-space', 'backup_data']
    await Promise.all(
      tempdirs.map((dir) => {
        return rm(join(dirPath, dir), { recursive: true, force: true })
      }),
    )

    // Unzip — in-process, zip-slip-safe extraction (no shell `unzip`).
    try {
      await this.safeUnzip(restoreFilePath, dirPath)
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

      await $throw(
        `${this.pgPasswordEnv()}pg_restore --clean --if-exists --no-owner ${this.pgConnectionArgs()} ${this.shellQuote(dumpFilePath)}`,
        { cwd: dirPath },
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

    await Promise.all(
      backupDataDirFilenames.map(async (filename) => {
        // Containment: source must stay within the extracted backup_data dir,
        // destination within DATA_DIR. Rejects `..`/absolute filenames.
        const fullpath = this.assertContained(backupDataDir, filename)
        const targetPath = this.assertContained(DATA_DIR, filename)

        await rm(targetPath, { recursive: true, force: true })

        await $throw(
          `cp -r ${this.shellQuote(fullpath)} ${this.shellQuote(targetPath)}`,
        )
      }),
    )

    // SECURITY: never auto-install dependencies from a restored archive.
    // An uploaded archive is attacker-controlled; running `npm install` on its
    // declared deps is arbitrary-code-execution via install scripts. Instead we
    // surface the package list so an admin can review and install manually.
    try {
      const packageJson = await readFile(join(backupDataDir, 'package.json'), {
        encoding: 'utf8',
      })
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
    await rm(backupDataDir, { force: true, recursive: true })
  }

  async rollbackTo(dirname: string) {
    const bakFilePath = this.checkBackupExist(dirname) // zip file path

    await this.restore(bakFilePath)

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

    scheduleManager.schedule(async () => {
      const { backupOptions } = await this.configs.waitForConfigReady()

      const { endpoint, bucket, region, secretId, secretKey } =
        backupOptions || {}
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

      const pathParts = backup.path.split('/')
      const remoteFileKey = `${pathParts.at(-2)}.zip`
      this.logger.log('--> Starting upload to S3')
      await s3
        .uploadFile(backup.buffer, remoteFileKey, 'backup')
        .catch((error) => {
          this.logger.error('--> Upload failed')
          throw error
        })

      this.logger.log('--> Upload succeeded')
    })
  }
}
