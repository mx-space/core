import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  Scope,
} from '@nestjs/common'
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import mkdirp from 'mkdirp'
import { join, resolve } from 'path'
import { Readable } from 'stream'
import { MONGO_DB } from '~/app.config'
import { BACKUP_DIR } from '~/constants/path.constant'
import { AdminEventsGateway } from '~/processors/gateway/admin/events.gateway'
import { EventTypes } from '~/processors/gateway/events.types'
import { getFolderSize } from '~/utils/system.util'

@Injectable({ scope: Scope.REQUEST })
export class BackupService {
  private logger: Logger

  constructor(private readonly adminGateway: AdminEventsGateway) {
    this.logger = new Logger(BackupService.name)
  }

  async list() {
    const backupPath = BACKUP_DIR
    if (!existsSync(backupPath)) {
      return []
    }
    const backupFilenames = readdirSync(backupPath)
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
        const { stdout } = await getFolderSize(path)
        delete item.path
        return { ...item, size: stdout }
      }),
    )
  }

  getFileStream(dirname: string) {
    const path = this.checkBackupExist(dirname)
    const stream = new Readable()

    stream.push(readFileSync(path))
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

  async saveTempBackupByUpload(buffer: Buffer) {
    const tempDirPath = '/tmp/mx-space/backup'
    const tempBackupPath = join(tempDirPath, 'backup.zip')
    mkdirp.sync(tempDirPath)
    writeFileSync(tempBackupPath, buffer)

    try {
      cd(tempDirPath)
      await $`unzip backup.zip`
      await $`mongorestore -h ${process.env.DB_URL || '127.0.0.1'} -d ${
        MONGO_DB.collectionName
      } ./mx-space --drop  >/dev/null 2>&1`

      this.logger.debug('恢复成功')
      await this.adminGateway.broadcast(
        EventTypes.CONTENT_REFRESH,
        'restore_done',
      )
    } catch (e) {
      const logDir = '/tmp/mx-space/log'
      mkdirp.sync(logDir)
      writeFileSync(logDir, e.message, { encoding: 'utf-8', flag: 'a+' })
      throw new InternalServerErrorException(e.message)
    } finally {
      rmSync(tempDirPath, { recursive: true })
    }
  }

  async rollbackTo(dirname: string) {
    const bakFilePath = this.checkBackupExist(dirname) // zip file path
    const dirPath = join(BACKUP_DIR, dirname)
    try {
      if (existsSync(join(join(dirPath, 'mx-space')))) {
        rmSync(join(dirPath, 'mx-space'), { recursive: true })
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
      await $`mongorestore -h ${process.env.DB_URL || '127.0.0.1'} -d ${
        MONGO_DB.collectionName
      } ./mx-space --drop  >/dev/null 2>&1`
    } catch (e) {
      this.logger.error(e)
      throw e
    } finally {
      try {
        rmSync(join(dirPath, 'mx-space'), { recursive: true })
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

    rmSync(path, { recursive: true })
    return true
  }
}
