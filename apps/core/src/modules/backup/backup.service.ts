import { existsSync, statSync } from 'fs'
import { readdir, readFile, rm, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { flatten } from 'lodash'
import { mkdirp } from 'mkdirp'

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
  Analyze_COLLECTION_NAME,
  WEBHOOK_EVENT_COLLECTION_NAME,
} from '~/constants/db.constant'
import { BACKUP_DIR, DATA_DIR } from '~/constants/path.constant'
import { migrateDatabase } from '~/migration/migrate'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { CacheService } from '~/processors/redis/cache.service'
import { getMediumDateTime, scheduleManager } from '~/utils'
import { uploadFileToCOS } from '~/utils/cos.util'
import { getFolderSize, installPKG } from '~/utils/system.util'

import { ConfigsService } from '../configs/configs.service'

const excludeCollections = [
  Analyze_COLLECTION_NAME,
  WEBHOOK_EVENT_COLLECTION_NAME,
]
@Injectable()
export class BackupService {
  private logger: Logger

  constructor(
    private readonly eventManager: EventManagerService,

    private readonly configs: ConfigsService,
    private readonly cacheService: CacheService,
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
      await $`mongodump -h ${MONGO_DB.host} --port ${MONGO_DB.port} -d ${
        MONGO_DB.dbName
      }  ${flatten(
        excludeCollections.map((collection) => [
          '--excludeCollection',
          `${collection}`,
        ]),
      )} -o ${backupDirPath} >/dev/null 2>&1`
      // 打包 DB
      cd(backupDirPath)
      await $`mv ${MONGO_DB.dbName} mx-space`.quiet().nothrow()
      await $`zip -r backup-${dateDir} mx-space/* && rm -rf mx-space`.quiet()

      // 打包数据目录

      const excludeFolders = ['backup', 'log', 'node_modules', 'admin']
      const flags = excludeFolders.map((item) => ['--exclude', item]).flat(1)
      cd(DATA_DIR)
      await rm(join(DATA_DIR, 'backup_data'), { recursive: true, force: true })
      await rm(join(DATA_DIR, 'temp_copy_need'), {
        recursive: true,
        force: true,
      })
      // eslint-disable-next-line no-empty
      await $`rsync -a . ./temp_copy_need --exclude temp_copy_need ${flags} && mv temp_copy_need backup_data && zip -r ${join(
        backupDirPath,
        `backup-${dateDir}`,
      )} ./backup_data && rm -rf backup_data`

      this.logger.log('--> 备份成功')
    } catch (e) {
      this.logger.error(
        `--> 备份失败，请确保已安装 zip 或 mongo-tools, mongo-tools 的版本需要与 mongod 版本一致，${e.message}` ||
          e.stderr,
      )
      throw e
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
      await $`mongorestore -h ${MONGO_DB.host || '127.0.0.1'} --port ${
        MONGO_DB.port || 27017
      } -d ${MONGO_DB.dbName} ./mx-space --drop  >/dev/null 2>&1`

      await migrateDatabase()
    } catch (e) {
      this.logger.error(e)
      throw e
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
            return installPKG(`${name}@${version}`, DATA_DIR).catch((er) => {
              this.logger.error(`--> 依赖安装失败：${er.message}`)
            })
          }),
        )
      }
    } catch (er) {}

    await Promise.all([
      this.cacheService.cleanAllRedisKey(),
      this.cacheService.cleanCatch(),
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
    //  开始上传 COS
    scheduleManager.schedule(async () => {
      const { backupOptions } = await this.configs.waitForConfigReady()

      if (
        !backupOptions.bucket ||
        !backupOptions.region ||
        !backupOptions.secretId ||
        !backupOptions.secretKey
      ) {
        return
      }

      this.logger.log('--> 开始上传到 COS')

      await uploadFileToCOS(
        backup.buffer,
        backup.path.slice(backup.path.lastIndexOf('/') + 1),
        {
          bucket: backupOptions.bucket,
          region: backupOptions.region,
          secretId: backupOptions.secretId,
          secretKey: backupOptions.secretKey,
        },
      )
        .then(() => {
          this.logger.log('--> 上传成功')
        })
        .catch((err) => {
          this.logger.error('--> 上传失败了')
          throw err
        })
    })
  }
}
