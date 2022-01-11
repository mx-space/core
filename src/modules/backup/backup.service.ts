import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { exec } from 'child_process'
import dayjs from 'dayjs'
import { existsSync, statSync } from 'fs'
import { readdir, readFile, rm, writeFile } from 'fs/promises'
import mkdirp from 'mkdirp'
import { join, resolve } from 'path'
import { Readable } from 'stream'
import { promisify } from 'util'
import { MONGO_DB } from '~/app.config'
import { BACKUP_DIR, DATA_DIR } from '~/constants/path.constant'
import { AdminEventsGateway } from '~/processors/gateway/admin/events.gateway'
import { EventTypes } from '~/processors/gateway/events.types'
import { getFolderSize } from '~/utils/system.util'
import { ConfigsService } from '../configs/configs.service'

@Injectable()
export class BackupService {
  private logger: Logger

  constructor(
    private readonly adminGateway: AdminEventsGateway,
    private readonly configs: ConfigsService,
  ) {
    this.logger = new Logger(BackupService.name)
  }

  async list() {
    const backupPath = BACKUP_DIR
    if (!existsSync(backupPath)) {
      return []
    }
    const backupFilenames = await readdir(backupPath)
    const backups = []

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
        delete item.path
        return { ...item, size }
      }),
    )
  }

  async backup() {
    const nowStr = dayjs().format('YYYY-MM-DD-HH:mm:ss')
    const { backupOptions: configs } = await this.configs.waitForConfigReady()
    if (!configs.enable) {
      return
    }
    this.logger.log('--> 备份数据库中')
    // 用时间格式命名文件夹
    const dateDir = nowStr

    const backupDirPath = join(BACKUP_DIR, dateDir)
    mkdirp.sync(backupDirPath)
    try {
      await $`mongodump -h ${MONGO_DB.host} --port ${MONGO_DB.port} -d ${MONGO_DB.dbName} --excludeCollection analyzes -o ${backupDirPath} >/dev/null 2>&1`

      // 打包 DB
      await promisify(exec)(
        `zip -r backup-${dateDir}  mx-space/* && rm -rf mx-space`,
        {
          cwd: backupDirPath,
        },
      )

      // 打包数据目录
      await promisify(exec)(
        `rsync -a . ./temp_copy_need --exclude temp_copy_need --exclude backup --exclude log && mv temp_copy_need backup_data && zip -r ${join(
          backupDirPath,
          `backup-${dateDir}`,
        )} ./backup_data && rm -rf backup_data`,
        {
          cwd: DATA_DIR,
        },
      )

      this.logger.log('--> 备份成功')
    } catch (e) {
      this.logger.error(
        '--> 备份失败, 请确保已安装 zip 或 mongo-tools, mongo-tools 的版本需要与 mongod 版本一致, ' +
          e.message,
      )
      throw e
    }
    const path = join(backupDirPath, 'backup-' + dateDir + '.zip')

    return {
      buffer: await readFile(path),
      path,
    }
  }

  async getFileStream(dirname: string) {
    const path = this.checkBackupExist(dirname)
    const stream = new Readable()

    stream.push(await readFile(path))
    stream.push(null)

    return stream
  }

  checkBackupExist(dirname: string) {
    const path = join(BACKUP_DIR, dirname, 'backup-' + dirname + '.zip')
    if (!existsSync(path)) {
      throw new BadRequestException('文件不存在')
    }
    return path
  }

  // TODO 下面两个方法有重复代码
  async saveTempBackupByUpload(buffer: Buffer) {
    const tempDirPath = '/tmp/mx-space/backup'
    const tempBackupPath = join(tempDirPath, 'backup.zip')
    mkdirp.sync(tempDirPath)
    await writeFile(tempBackupPath, buffer)

    try {
      cd(tempDirPath)
      await $`unzip backup.zip`
      await $`mongorestore -h ${MONGO_DB.host || '127.0.0.1'} --port ${
        MONGO_DB.port || 27017
      } -d ${MONGO_DB.dbName} ./mx-space --drop  >/dev/null 2>&1`

      this.logger.debug('恢复成功')
      await this.adminGateway.broadcast(
        EventTypes.CONTENT_REFRESH,
        'restore_done',
      )
    } finally {
      await rm(tempDirPath, { recursive: true })
    }
  }

  async rollbackTo(dirname: string) {
    const bakFilePath = this.checkBackupExist(dirname) // zip file path
    const dirPath = join(BACKUP_DIR, dirname)
    try {
      if (existsSync(join(join(dirPath, 'mx-space')))) {
        await rm(join(dirPath, 'mx-space'), { recursive: true })
      }

      cd(dirPath)
      await $`unzip ${bakFilePath}`
    } catch {
      throw new InternalServerErrorException('服务端 unzip 命令未找到')
    }
    try {
      if (!existsSync(join(dirPath, 'mx-space'))) {
        throw new InternalServerErrorException('备份文件错误, 目录不存在')
      }

      cd(dirPath)
      await $`mongorestore -h ${MONGO_DB.host || '127.0.0.1'} --port ${
        MONGO_DB.port || 27017
      } -d ${MONGO_DB.dbName} ./mx-space --drop  >/dev/null 2>&1`
    } catch (e) {
      this.logger.error(e)
      throw e
    } finally {
      try {
        await rm(join(dirPath, 'mx-space'), { recursive: true })
      } catch {}
    }

    await this.adminGateway.broadcast(
      EventTypes.CONTENT_REFRESH,
      'restore_done',
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
}
