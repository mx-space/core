import { Injectable, Logger } from '@nestjs/common'
import { ConfigsService } from '~/modules/configs/configs.service'
import { HttpService } from './helper.http.service'

export interface HitokotoResponse {
  id: number
  uuid: string
  hitokoto: string
  type: string
  from: string
  from_who: string | null
  creator: string
  creator_uid: number
  reviewer: number
  commit_from: string
  created_at: string
  length: number
}

export interface HitokotoData {
  text: string
  from: string
  author?: string
}

@Injectable()
export class HitokotoService {
  private readonly logger = new Logger(HitokotoService.name)

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * 获取随机一言
   * @returns 一言数据，如果获取失败或未启用则返回 null
   */
  async getHitokoto(): Promise<HitokotoData | null> {
    try {
      const mailOptions = await this.configsService.get('mailOptions')
      const hitokotoConfig = mailOptions?.hitokoto

      if (!hitokotoConfig?.enable) {
        return null
      }

      const apiUrl = hitokotoConfig.api || 'https://v1.hitokoto.cn'

      const response = await this.httpService.axiosRef.get<HitokotoResponse>(
        apiUrl,
        {
          timeout: 5000, // 5秒超时
        },
      )

      const data = response.data

      return {
        text: data.hitokoto,
        from: data.from,
        author: data.from_who || undefined,
      }
    } catch (error) {
      this.logger.warn(`获取一言失败: ${error.message}`)
      return null
    }
  }
}
