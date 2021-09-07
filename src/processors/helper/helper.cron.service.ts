import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import COS from 'cos-nodejs-sdk-v5'
import dayjs from 'dayjs'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import mkdirp from 'mkdirp'
import { join } from 'path'
import { $, cd } from 'zx'
import {
  BACKUP_DIR,
  LOCAL_BOT_LIST_DATA_FILE_PATH,
} from '~/constants/path.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { isDev } from '~/utils/index.util'
import { HttpService } from './helper.http.service'
@Injectable()
export class CronService {
  private logger: Logger
  constructor(
    private readonly http: HttpService,
    private readonly configs: ConfigsService,
  ) {
    this.logger = new Logger(CronService.name)
  }
  /**
   *
   * @description 每天凌晨更新 Bot 列表
   */
  @Cron(CronExpression.EVERY_WEEK)
  async updateBotList() {
    try {
      const { data: json } = await this.http.axiosRef.get(
        'https://cdn.jsdelivr.net/gh/atmire/COUNTER-Robots@master/COUNTER_Robots_list.json',
      )

      writeFileSync(LOCAL_BOT_LIST_DATA_FILE_PATH, JSON.stringify(json), {
        encoding: 'utf-8',
        flag: 'w+',
      })

      return json
    } catch {
      this.logger.warn('更新 Bot 列表错误')
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'backup' })
  async backupDB({ uploadCOS = true }: { uploadCOS?: boolean } = {}) {
    if (!this.configs.get('backupOptions').enable) {
      return
    }
    this.logger.log('--> 备份数据库中')

    const dateDir = this.nowStr

    const backupDirPath = join(BACKUP_DIR, dateDir)
    mkdirp.sync(backupDirPath)
    try {
      await $`mongodump -h 127.0.0.1 -d mx-space -o ${backupDirPath} >/dev/null 2>&1`
      cd(backupDirPath)
      await $`zip -r backup-${dateDir}  mx-space/* && rm -r mx-space`

      this.logger.log('--> 备份成功')
    } catch (e) {
      if (isDev) {
        console.log(e)
      }
      this.logger.error(
        '--> 备份失败, 请确保已安装 zip 或 mongo-tools, mongo-tools 的版本需要与 mongod 版本一致',
      )
      return
    }

    //  开始上传 COS
    process.nextTick(() => {
      if (!uploadCOS) {
        return
      }
      const backupOptions = this.configs.get('backupOptions')
      if (
        !backupOptions.Bucket ||
        !backupOptions.Region ||
        !backupOptions.SecretId ||
        !backupOptions.SecretKey
      ) {
        return
      }
      const backupFilePath = join(backupDirPath, 'backup-' + dateDir + '.zip')

      if (!existsSync(backupFilePath)) {
        this.logger.warn('文件不存在, 无法上传到 COS')
        return
      }
      this.logger.log('--> 开始上传到 COS')
      const cos = new COS({
        SecretId: backupOptions.SecretId,
        SecretKey: backupOptions.SecretKey,
      })
      // 分片上传
      cos.sliceUploadFile(
        {
          Bucket: backupOptions.Bucket,
          Region: backupOptions.Region,
          Key: `backup-${dateDir}.zip`,
          FilePath: backupFilePath,
        },
        (err) => {
          if (!err) {
            this.logger.log('--> 上传成功')
          } else {
            this.logger.error('--> 上传失败了' + err)
          }
        },
      )
    })

    return readFileSync(join(backupDirPath, 'backup-' + dateDir + '.zip'))
  }

  private get nowStr() {
    return dayjs().format('YYYY-MM-DD-HH:mm:ss')
  }
}
