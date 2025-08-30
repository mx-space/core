import { Injectable } from '@nestjs/common'
import { ConfigsService } from '~/modules/configs/configs.service'
import { throttle } from 'lodash'
import { HttpService } from './helper.http.service'

export type BarkPushOptions = {
  title: string
  body: string
  category?: string
  /**
   * An url to the icon, available only on iOS 15 or later
   */
  icon?: string
  group?: string
  url?: string
  /**
   * Value from here <https://github.com/Finb/Bark/tree/master/Sounds>
   */
  sound?: string
  level?: 'active' | 'timeSensitive' | 'passive'
}

@Injectable()
export class BarkPushService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigsService,
  ) {}

  async push(options: BarkPushOptions) {
    const { key, serverUrl = 'https://day.app' } =
      await this.config.get('barkOptions')

    const { title: siteTitle } = await this.config.get('seo')
    if (!key) {
      throw new Error('Bark key is not configured')
    }
    const { title, ...rest } = options

    const response = await this.httpService.axiosRef.post(`${serverUrl}/push`, {
      device_key: key,
      title: `[${siteTitle}] ${title}`,
      category: siteTitle,
      group: siteTitle,
      ...rest,
    })
    return response.data
  }

  throttlePush = throttle((options: BarkPushOptions) => {
    this.push(options)
  }, 1000 * 600)
}
