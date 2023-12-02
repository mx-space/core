import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BusinessEvents } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { CommentModel } from '~/modules/comment/comment.model'
import { ConfigsService } from '~/modules/configs/configs.service'
import { UserService } from '~/modules/user/user.service'

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

    private readonly userService: UserService,
  ) {}

  // push comment
  @OnEvent(BusinessEvents.COMMENT_CREATE)
  async pushCommentEvent(comment: CommentModel) {
    const { enable } = await this.config.get('barkOptions')
    if (!enable) {
      return
    }
    const master = await this.userService.getMaster()
    if (comment.author == master.name && comment.author == master.username) {
      return
    }
    const { adminUrl } = await this.config.get('url')

    await this.push({
      title: '收到一条新评论',
      body: `${comment.author} 评论了你的${
        comment.refType === CollectionRefTypes.Recently ? '速记' : '文章'
      }：${comment.text}`,
      icon: comment.avatar,
      url: `${adminUrl}#/comments`,
    })
  }

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
}
