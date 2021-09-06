import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { writeFileSync } from 'fs'
import { localBotListDataFilePath } from '~/constants/path.constant'
import { HttpService } from './helper.http.service'
@Injectable()
export class CronService {
  private logger: Logger
  constructor(private readonly http: HttpService) {
    this.logger = new Logger(CronService.name)
  }

  @Cron(CronExpression.EVERY_WEEK)
  async updateBotList() {
    try {
      const { data: json } = await this.http.axiosRef.get(
        'https://cdn.jsdelivr.net/gh/atmire/COUNTER-Robots@master/COUNTER_Robots_list.json',
      )

      writeFileSync(localBotListDataFilePath, JSON.stringify(json), {
        encoding: 'utf-8',
        flag: 'w+',
      })

      return json
    } catch {
      this.logger.warn('更新 Bot 列表错误')
    }
  }
}
