import { URL } from 'node:url'

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { isDev } from '~/global/env.global'
import { EmailService } from '~/processors/helper/helper.email.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { InjectModel } from '~/transformers/model.transformer'
import { scheduleManager } from '~/utils/schedule.util'

import { ConfigsService } from '../configs/configs.service'
import { UserService } from '../user/user.service'
import { LinkApplyEmailType } from './link-mail.enum'
import { LinkModel, LinkState, LinkStateMap, LinkType } from './link.model'

@Injectable()
export class LinkService {
  constructor(
    @InjectModel(LinkModel)
    private readonly linkModel: MongooseModel<LinkModel>,
    private readonly emailService: EmailService,
    private readonly configs: ConfigsService,

    private readonly userService: UserService,
    private readonly eventManager: EventManagerService,
    private readonly http: HttpService,
    private readonly configsService: ConfigsService,
  ) {}

  public get model() {
    return this.linkModel
  }
  async applyForLink(model: LinkModel) {
    const { allowSubPath } = await this.configsService.get('friendLinkOptions')

    const existedDoc = await this.model
      .findOne({
        $or: [{ url: model.url }, { name: model.name }],
      })
      .lean()

    let nextModel: LinkModel | null
    if (existedDoc) {
      switch (existedDoc.state) {
        case LinkState.Pass:
        case LinkState.Audit:
          throw new BadRequestException('请不要重复申请友链哦')

        case LinkState.Banned:
          throw new BadRequestException('您的友链已被禁用，请联系管理员')
        case LinkState.Reject:
        case LinkState.Outdate:
          nextModel = await this.model
            .findOneAndUpdate(
              { _id: existedDoc._id },
              {
                $set: {
                  state: LinkState.Audit,
                },
              },
              { new: true },
            )
            .lean()
      }
    } else {
      const url = new URL(model.url)
      const pathname = url.pathname

      if (pathname !== '/' && !allowSubPath) {
        throw new UnprocessableEntityException('管理员当前禁用了子路径友链申请')
      }

      nextModel = await this.model.create({
        ...model,
        url: allowSubPath ? `${url.origin}${url.pathname}` : url.origin,
        type: LinkType.Friend,
        state: LinkState.Audit,
      })
    }

    scheduleManager.schedule(() => {
      this.eventManager.broadcast(BusinessEvents.LINK_APPLY, nextModel, {
        scope: EventScope.TO_SYSTEM_ADMIN,
      })
    })
  }

  async approveLink(id: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: id },
        {
          $set: { state: LinkState.Pass },
        },
      )
      .lean()

    if (!doc) {
      throw new NotFoundException()
    }

    return doc
  }

  async getCount() {
    const [audit, friends, collection, outdate, banned, reject] =
      await Promise.all([
        this.model.countDocuments({ state: LinkState.Audit }),
        this.model.countDocuments({
          type: LinkType.Friend,
          state: LinkState.Pass,
        }),
        this.model.countDocuments({
          type: LinkType.Collection,
        }),
        this.model.countDocuments({
          state: LinkState.Outdate,
        }),
        this.model.countDocuments({
          state: LinkState.Banned,
        }),
        this.model.countDocuments({
          state: LinkState.Reject,
        }),
      ])
    return {
      audit,
      friends,
      collection,
      outdate,
      banned,
      reject,
    }
  }

  async sendToCandidate(model: LinkModel) {
    if (!model.email) {
      return
    }
    const { enable } = await this.configs.get('mailOptions')
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
  async sendToMaster(authorName: string, model: LinkModel) {
    const enable = (await this.configs.get('mailOptions')).enable
    if (!enable || isDev) {
      console.info(`来自 ${authorName} 的友链请求：
        站点标题：${model.name}
        站点网站：${model.url}
        站点描述：${model.description}`)
      return
    }
    scheduleManager.schedule(async () => {
      const master = await this.userService.getMaster()

      await this.sendLinkApplyEmail({
        authorName,
        model,
        to: master.mail,
        template: LinkApplyEmailType.ToMaster,
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
    model: LinkModel
    template: LinkApplyEmailType
  }) {
    const { seo, mailOptions } = await this.configsService.waitForConfigReady()
    const { from, user } = mailOptions
    const sendfrom = `"${seo.title || 'Mx Space'}" <${from || user}>`
    await this.emailService.getInstance().sendMail({
      from: sendfrom,
      to,
      subject:
        template === LinkApplyEmailType.ToMaster
          ? `[${seo.title || 'Mx Space'}] 新的朋友 ${authorName}`
          : `嘿!~, 主人已通过你的友链申请!~`,
      text:
        template === LinkApplyEmailType.ToMaster
          ? `来自 ${model.name} 的友链请求：
          站点标题：${model.name}
          站点网站：${model.url}
          站点描述：${model.description}
        `
          : `你的友链申请：${model.name}, ${model.url} 已通过`,
    })
  }

  /** 确定友链存活状态 */
  async checkLinkHealth() {
    const links = await this.model.find({ state: LinkState.Pass })
    const health = await Promise.all(
      links.map(({ id, url }) => {
        Logger.debug(
          `检查友链 ${id} 的健康状态：GET -> ${url}`,
          LinkService.name,
        )
        return this.http.axiosRef
          .get(url, {
            timeout: 5000,
            'axios-retry': {
              retries: 1,
              shouldResetTimeout: true,
            },
          })
          .then((res) => {
            return {
              status: res.status,
              id,
            }
          })
          .catch((error) => {
            return {
              id,
              status: error.response?.status || 'ERROR',
              message: error.message,
            }
          })
      }),
    ).then((arr) =>
      arr.reduce((acc, cur) => {
        acc[cur.id] = cur
        return acc
      }, {}),
    )

    return health
  }

  async canApplyLink() {
    const configs = await this.configs.get('friendLinkOptions')
    const can = configs.allowApply
    return can
  }

  async sendAuditResultByEmail(id: string, reason: string, state: LinkState) {
    const doc = await this.model.findById(id)
    if (!doc) {
      throw new NotFoundException()
    }

    doc.state = state
    await doc.save()

    const { seo, mailOptions } = await this.configsService.waitForConfigReady()
    const { enable } = mailOptions
    if (!enable || isDev) {
      console.log(`友链结果通知：${reason}, 状态：${state}`)
      return
    }

    const { from, user } = mailOptions
    const sendfrom = `"${seo.title || 'Mx Space'}" <${from || user}>`
    await this.emailService.getInstance().sendMail({
      from: sendfrom,
      to: doc.email,
      subject: `嘿!~, 主人已处理你的友链申请!~`,
      text: `申请结果：${LinkStateMap[state]}\n原因：${reason}`,
    })
  }
}
