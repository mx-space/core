import { URL } from 'node:url'

import { Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { isDev } from '~/global/env.global'
import { EmailService } from '~/processors/helper/helper.email.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { scheduleManager } from '~/utils/schedule.util'

import { ConfigsService } from '../configs/configs.service'
import { OwnerService } from '../owner/owner.service'
import { LinkRepository } from './link.repository'
import { type LinkRow, LinkState, LinkType } from './link.types'
import { LinkAvatarService } from './link-avatar.service'
import { LinkApplyEmailType } from './link-mail.enum'

const LinkStateMap: Record<LinkState, string> = {
  [LinkState.Pass]: 'Approved',
  [LinkState.Audit]: 'Under review',
  [LinkState.Outdate]: 'Outdated',
  [LinkState.Banned]: 'Banned',
  [LinkState.Reject]: 'Rejected',
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
          throw createAppException(AppErrorCode.DUPLICATE_LINK)
        }
        case LinkState.Banned: {
          throw createAppException(AppErrorCode.LINK_DISABLED)
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
        throw createAppException(AppErrorCode.SUBPATH_LINK_DISABLED)
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
      throw createAppException(AppErrorCode.LINK_NOT_FOUND, { id })
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
      Your friend link has been approved
        Site title: ${model.name}
        Site URL: ${model.url}
        Site description: ${model.description}`)
      return
    }
    await this.sendLinkApplyEmail({
      model,
      to: model.email,
      template: LinkApplyEmailType.ToCandidate,
    })
  }

  async sendToOwner(authorName: string, model: LinkRow) {
    const { enable } = await this.configsService.get('mailOptions')
    if (!enable || isDev) {
      console.info(`New friend link request from ${authorName}:
        Site title: ${model.name}
        Site URL: ${model.url}
        Site description: ${model.description}`)
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

  private async sendLinkMail(
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
    const { seo, mailOptions } = await this.configsService.waitForConfigReady()
    const senderEmail = mailOptions.from || mailOptions.smtp?.user
    const sendfrom = `"${seo.title || 'Mx Space'}" <${senderEmail}>`
    await this.emailService.send({
      from: sendfrom,
      to,
      subject,
      text,
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
    const { seo } = await this.configsService.waitForConfigReady()
    const siteTitle = seo.title || 'Mx Space'
    const isToOwner = template === LinkApplyEmailType.ToOwner
    const subject = isToOwner
      ? `[${siteTitle}] New friend ${authorName}`
      : `Hey! Your friend link application has been approved`
    const text = isToOwner
      ? `New friend link request from ${model.name}:
          Site title: ${model.name}
          Site URL: ${model.url}
          Site description: ${model.description}
        `
      : `Your friend link application: ${model.name}, ${model.url} has been approved`
    await this.sendLinkMail(to, subject, text)
  }

  async checkLinkHealth() {
    const links = await this.linkRepository.findByState(LinkState.Pass)
    const results = await Promise.all(
      links.map(async ({ id, url }) => {
        this.logger.debug(`Checking friend link ${id} health: GET -> ${url}`)
        try {
          const res = await this.http.axiosRef.get(url, {
            timeout: 5000,
            'axios-retry': { retries: 1, shouldResetTimeout: true },
          })
          return { status: res.status, id }
        } catch (error: any) {
          return {
            id,
            status: error.response?.status || 'ERROR',
            message: error.message,
          }
        }
      }),
    )
    const map: Record<string, unknown> = {}
    for (const result of results) map[result.id] = result
    return map
  }

  async canApplyLink() {
    const { allowApply } = await this.configsService.get('friendLinkOptions')
    return allowApply
  }

  async sendAuditResultByEmail(id: string, reason: string, state: LinkState) {
    const updated = await this.linkRepository.updateState(id, state)
    if (!updated) {
      throw createAppException(AppErrorCode.LINK_NOT_FOUND, { id })
    }

    const { enable } = await this.configsService.get('mailOptions')
    if (!enable || isDev) {
      console.info(`Friend link audit result: ${reason}, state: ${state}`)
      return
    }
    if (!updated.email) return

    await this.sendLinkMail(
      updated.email,
      `Hey! Your friend link application has been processed`,
      `Result: ${LinkStateMap[state]}\nReason: ${reason}`,
    )
  }

  async migrateExternalAvatarsForPassedLinks() {
    return this.linkAvatarService.migratePassedLinks()
  }
}
