import { existsSync, statSync } from 'node:fs'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { flatten } from 'lodash'
import { mkdirp } from 'mkdirp'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { CronExpression } from '@nestjs/schedule'

import { DEMO_MODE, MONGO_DB } from '~/app.config'
import { CronDescription } from '~/common/decorators/cron-description.decorator'
import { CronOnce } from '~/common/decorators/cron-once.decorator'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import {
  ANALYZE_COLLECTION_NAME,
  MIGRATE_COLLECTION_NAME,
  WEBHOOK_EVENT_COLLECTION_NAME,
} from '~/constants/db.constant'
import { BACKUP_DIR, DATA_DIR } from '~/constants/path.constant'
import { migrateDatabase } from '~/migration/migrate'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { scheduleManager } from '~/utils/schedule.util'
import { getFolderSize, installPKG } from '~/utils/system.util'
import { getMediumDateTime } from '~/utils/time.util'

import { ConfigsService } from '../configs/configs.service'

const excludeCollections = [
  ANALYZE_COLLECTION_NAME,
  WEBHOOK_EVENT_COLLECTION_NAME,
  MIGRATE_COLLECTION_NAME,
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
      backups.map(async (item) => {
        const { path } = item
        const size = await getFolderSize(path)
        // @ts-ignore
        delete item.path
        return { ...item, size }
      }),
    )
  }

  async backup() {
    const { backupOptions: configs } = await this.configs.waitForConfigReady()
    if (!configs.enable) {
      return
    }
    this.logger.log('--> 备份数据库中')
    // 用时间格式命名文件夹
    const dateDir = getMediumDateTime(new Date())

    const backupDirPath = join(BACKUP_DIR, dateDir)
    mkdirp.sync(backupDirPath)
    try {
      await $`mongodump --uri ${MONGO_DB.customConnectionString || MONGO_DB.uri} -d ${
        MONGO_DB.dbName
      }  ${flatten(
        excludeCollections.map((collection) => [
          '--excludeCollection',

          collection,
        ]),
      )} -o ${backupDirPath} >/dev/null 2>&1`
      // 打包 DB
      cd(backupDirPath)
      await $`mv ${MONGO_DB.dbName} mx-space`.quiet().nothrow()
      await $`zip -r backup-${dateDir} mx-space/* && rm -rf mx-space`.quiet()

      // 打包数据目录

      const flags = excludeFolders.flatMap((item) => ['--exclude', item])
      cd(DATA_DIR)
      await rm(join(DATA_DIR, 'backup_data'), { recursive: true, force: true })
      await rm(join(DATA_DIR, 'temp_copy_need'), {
        recursive: true,
        force: true,
      })

      await $`rsync -a . ./temp_copy_need --exclude temp_copy_need ${flags} && mv temp_copy_need backup_data && zip -r ${join(
        backupDirPath,
        `backup-${dateDir}`,
      )} ./backup_data && rm -rf backup_data`

      this.logger.log('--> 备份成功')
    } catch (error) {
      this.logger.error(
        `--> 备份失败，请确保已安装 zip 或 mongo-tools, mongo-tools 的版本需要与 mongod 版本一致，${error.message}\n\n${
          error.stderr
        }`,
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
    const stream = fs.createReadStream(path)

    return stream
  }

  checkBackupExist(dirname: string) {
    const path = join(BACKUP_DIR, dirname, `backup-${dirname}.zip`)
    if (!existsSync(path)) {
      throw new BadRequestException('文件不存在')
    }
    return path
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
    const isExist = fs.existsSync(restoreFilePath)
    if (!isExist) {
      throw new InternalServerErrorException('备份文件不存在')
    }
    const dirPath = path.dirname(restoreFilePath)

    const tempdirs = ['mx-space', 'backup_data']
    await Promise.all(
      tempdirs.map((dir) => {
        return rm(join(dirPath, dir), { recursive: true, force: true })
      }),
    )

    // 解压
    try {
      cd(dirPath)
      await $`unzip ${restoreFilePath}`
    } catch {
      throw new InternalServerErrorException('服务端 unzip 命令未找到')
    }
    try {
      // 验证
      if (!existsSync(join(dirPath, 'mx-space'))) {
        throw new InternalServerErrorException('备份文件错误，目录不存在')
      }

      cd(dirPath)
      await $`mongorestore --uri ${MONGO_DB.customConnectionString || MONGO_DB.uri} -d ${MONGO_DB.dbName} ./mx-space --drop  >/dev/null 2>&1`

      await migrateDatabase()
    } catch (error) {
      this.logger.error(error)
      throw error
    } finally {
      await rm(join(dirPath, 'mx-space'), { recursive: true, force: true })
    }
    // 还原 backup_data

    const backupDataDir = join(dirPath, 'backup_data')

    const backupDataDirFilenames = await readdir(backupDataDir)

    await Promise.all(
      backupDataDirFilenames.map(async (filename) => {
        const fullpath = join(dirPath, 'backup_data', filename)
        const targetPath = join(DATA_DIR, filename)

        await rm(targetPath, { recursive: true, force: true })

        await $`cp -r ${fullpath} ${targetPath}`
      }),
    )

    try {
      const packageJson = await readFile(join(backupDataDir, 'package.json'), {
        encoding: 'utf-8',
      })
      const pkg = JSON.parse(packageJson)
      if (pkg.dependencies) {
        await Promise.all(
          Object.entries(pkg.dependencies).map(([name, version]) => {
            this.logger.log(`--> 安装依赖 ${name}@${version}`)
            return installPKG(`${name}@${version}`, DATA_DIR).catch((error) => {
              this.logger.error(`--> 依赖安装失败：${error.message}`)
            })
          }),
        )
      }
    } catch {}

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

  async deleteBackup(filename) {
    const path = join(BACKUP_DIR, filename)
    if (!existsSync(path)) {
      throw new BadRequestException('文件不存在')
    }

    await rm(path, { recursive: true })
    return true
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, { name: 'backupDB' })
  @CronDescription('备份 DB 并上传 COS')
  async backupDB() {
    if (DEMO_MODE) {
      return
    }
    const backup = await this.backup()
    if (!backup) {
      this.logger.log('没有开启备份')
      return
    }

    scheduleManager.schedule(async () => {
      const { backupOptions } = await this.configs.waitForConfigReady()

      const { endpoint, bucket, region, secretId, secretKey } =
        backupOptions || {}
      if (!endpoint || !bucket || !region || !secretId || !secretKey) {
        return
      }

      const s3 = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId: secretId,
          secretAccessKey: secretKey,
        },
      })

      const remoteFileKey = backup.path.slice(backup.path.lastIndexOf('/') + 1)
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: remoteFileKey,
        Body: backup.buffer,
        ContentType: 'application/zip',
      })

      this.logger.log('--> 开始上传到 S3')
      await s3.send(command).catch((error) => {
        this.logger.error('--> 上传失败了')
        throw error
      })
      this.logger.log('--> 上传成功')
    })
  }
}
