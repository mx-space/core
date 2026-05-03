import { URL } from 'node:url'

import { Injectable, Logger } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { isDev } from '~/global/env.global'
import { EmailService } from '~/processors/helper/helper.email.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { scheduleManager } from '~/utils/schedule.util'

import { ConfigsService } from '../configs/configs.service'
import { OwnerService } from '../owner/owner.service'
import {
  LinkRepository,
  type LinkRow,
  LinkState,
  LinkType,
} from './link.repository'
import { LinkAvatarService } from './link-avatar.service'
import { LinkApplyEmailType } from './link-mail.enum'

const LinkStateMap: Record<LinkState, string> = {
  [LinkState.Pass]: '通过',
  [LinkState.Audit]: '审核',
  [LinkState.Outdate]: '过期',
  [LinkState.Banned]: '禁用',
  [LinkState.Reject]: '拒绝',
}

@Injectable()
export class LinkService {
  private readonly logger = new Logger(LinkService.name)

  constructor(
    private readonly linkRepository: LinkRepository,
    private readonly emailService: EmailService,
    private readonly configsService: ConfigsService,
    private readonly ownerService: OwnerService,
    private readonly eventManager: EventManagerService,
    private readonly http: HttpService,
    private readonly linkAvatarService: LinkAvatarService,
  ) {}

  public get repository() {
    return this.linkRepository
  }

  list(page: number, size: number, state?: LinkState) {
    return this.linkRepository.list(page, size, { state })
  }

  findAvailable() {
    return this.linkRepository.findAvailable()
  }

  countByState(state: LinkState) {
    return this.linkRepository.countByState(state)
  }

  async applyForLink(input: {
    url: string
    name: string
    avatar?: string | null
    description?: string | null
    email?: string | null
    author?: string | null
  }) {
    const { allowSubPath } = await this.configsService.get('friendLinkOptions')

    const existed = await this.linkRepository.findByUrlOrName(
      input.url,
      input.name,
    )

    let nextLink: LinkRow | null = null
    if (existed) {
      switch (existed.state) {
        case LinkState.Pass:
        case LinkState.Audit: {
          throw new BizException(ErrorCodeEnum.DuplicateLink)
        }
        case LinkState.Banned: {
          throw new BizException(ErrorCodeEnum.LinkDisabled)
        }
        case LinkState.Reject:
        case LinkState.Outdate: {
          nextLink = await this.linkRepository.updateState(
            existed.id,
            LinkState.Audit,
          )
          break
        }
      }
    } else {
      const url = new URL(input.url)
      const pathname = url.pathname
      if (pathname !== '/' && !allowSubPath) {
        throw new BizException(ErrorCodeEnum.SubpathLinkDisabled)
      }
      nextLink = await this.linkRepository.create({
        name: input.name,
        url: allowSubPath ? `${url.origin}${url.pathname}` : url.origin,
        avatar: input.avatar ?? null,
        description: input.description ?? null,
        email: input.email ?? null,
        type: LinkType.Friend,
        state: LinkState.Audit,
      })
    }

    scheduleManager.schedule(() => {
      this.eventManager.broadcast(BusinessEvents.LINK_APPLY, nextLink, {
        scope: EventScope.TO_SYSTEM_ADMIN,
      })
    })
  }

  async approveLink(id: string) {
    const updated = await this.linkRepository.updateState(id, LinkState.Pass)
    if (!updated) {
      throw new BizException(ErrorCodeEnum.LinkNotFound)
    }
    const convertedAvatar =
      await this.linkAvatarService.convertToInternal(updated)
    return { link: updated, convertedAvatar }
  }

  async getCount() {
    const [audit, friends, collection, outdate, banned, reject] =
      await Promise.all([
        this.linkRepository.countByState(LinkState.Audit),
        this.linkRepository.countByTypeAndState(
          LinkType.Friend,
          LinkState.Pass,
        ),
        this.linkRepository.countByType(LinkType.Collection),
        this.linkRepository.countByState(LinkState.Outdate),
        this.linkRepository.countByState(LinkState.Banned),
        this.linkRepository.countByState(LinkState.Reject),
      ])
    return { audit, friends, collection, outdate, banned, reject }
  }

  async sendToCandidate(model: LinkRow) {
    if (!model.email) return
    const { enable } = await this.configsService.get('mailOptions')
    if (!enable || isDev) {
      console.info(`
      To: ${model.email}
      你的友链已通过
        站点标题：${model.name}
        站点网站：${model.url}
        站点描述：${model.description}`)
      return
    }
    await this.sendLinkApplyEmail({
      model,
      to: model.email,
      template: LinkApplyEmailType.ToCandidate,
    })
  }

  async sendToOwner(authorName: string, model: LinkRow) {
    const enable = (await this.configsService.get('mailOptions')).enable
    if (!enable || isDev) {
      console.info(`来自 ${authorName} 的友链请求：
        站点标题：${model.name}
        站点网站：${model.url}
        站点描述：${model.description}`)
      return
    }
    scheduleManager.schedule(async () => {
      const owner = await this.ownerService.getOwner()
      if (!owner.mail) return
      await this.sendLinkApplyEmail({
        authorName,
        model,
        to: owner.mail,
        template: LinkApplyEmailType.ToOwner,
      })
    })
  }

  async sendLinkApplyEmail({
    to,
    model,
    authorName,
    template,
  }: {
    authorName?: string
    to: string
    model: LinkRow
    template: LinkApplyEmailType
  }) {
    const { seo, mailOptions } = await this.configsService.waitForConfigReady()
    const senderEmail = mailOptions.from || mailOptions.smtp?.user
    const sendfrom = `"${seo.title || 'Mx Space'}" <${senderEmail}>`
    await this.emailService.send({
      from: sendfrom,
      to,
      subject:
        template === LinkApplyEmailType.ToOwner
          ? `[${seo.title || 'Mx Space'}] 新的朋友 ${authorName}`
          : `嘿!~, 主人已通过你的友链申请!~`,
      text:
        template === LinkApplyEmailType.ToOwner
          ? `来自 ${model.name} 的友链请求：
          站点标题：${model.name}
          站点网站：${model.url}
          站点描述：${model.description}
        `
          : `你的友链申请：${model.name}, ${model.url} 已通过`,
    })
  }

  async checkLinkHealth() {
    const links = await this.linkRepository.findByState(LinkState.Pass)
    const health = await Promise.all(
      links.map(({ id, url }) => {
        this.logger.debug(`检查友链 ${id} 的健康状态：GET -> ${url}`)
        return this.http.axiosRef
          .get(url, {
            timeout: 5000,
            'axios-retry': { retries: 1, shouldResetTimeout: true },
          })
          .then((res) => ({ status: res.status, id }))
          .catch((error) => ({
            id,
            status: error.response?.status || 'ERROR',
            message: error.message,
          }))
      }),
    ).then((arr) =>
      arr.reduce<Record<string, unknown>>((acc, cur) => {
        acc[cur.id] = cur
        return acc
      }, {}),
    )
    return health
  }

  async canApplyLink() {
    const { allowApply } = await this.configsService.get('friendLinkOptions')
    return allowApply
  }

  async sendAuditResultByEmail(id: string, reason: string, state: LinkState) {
    const updated = await this.linkRepository.updateState(id, state)
    if (!updated) {
      throw new BizException(ErrorCodeEnum.LinkNotFound)
    }

    const { seo, mailOptions } = await this.configsService.waitForConfigReady()
    const { enable } = mailOptions
    if (!enable || isDev) {
      console.info(`友链结果通知：${reason}, 状态：${state}`)
      return
    }
    if (!updated.email) return

    const senderEmail = mailOptions.from || mailOptions.smtp?.user
    const sendfrom = `"${seo.title || 'Mx Space'}" <${senderEmail}>`
    await this.emailService.send({
      from: sendfrom,
      to: updated.email,
      subject: `嘿!~, 主人已处理你的友链申请!~`,
      text: `申请结果：${LinkStateMap[state]}\n原因：${reason}`,
    })
  }

  async migrateExternalAvatarsForPassedLinks() {
    return this.linkAvatarService.migratePassedLinks()
  }
}
