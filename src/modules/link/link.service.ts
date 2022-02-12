import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { InjectModel } from 'nestjs-typegoose'
import { isDev } from '~/global/env.global'
import { AdminEventsGateway } from '~/processors/gateway/admin/events.gateway'
import { EventTypes } from '~/processors/gateway/events.types'
import {
  EmailService,
  LinkApplyEmailType,
} from '~/processors/helper/helper.email.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { ConfigsService } from '../configs/configs.service'
import { LinkModel, LinkState, LinkType } from './link.model'

@Injectable()
export class LinkService {
  constructor(
    @InjectModel(LinkModel)
    private readonly linkModel: MongooseModel<LinkModel>,
    private readonly emailService: EmailService,
    private readonly configs: ConfigsService,
    private readonly adminGateway: AdminEventsGateway,
    private readonly http: HttpService,
  ) {}

  public get model() {
    return this.linkModel
  }
  async applyForLink(model: LinkModel) {
    try {
      const doc = await this.model.create({
        ...model,
        type: LinkType.Friend,
        state: LinkState.Audit,
      })

      process.nextTick(() => {
        this.adminGateway.broadcast(EventTypes.LINK_APPLY, doc)
      })
    } catch {
      throw new BadRequestException('请不要重复申请友链哦')
    }
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

    return doc
  }

  async getCount() {
    const [audit, friends, collection, outdate, banned] = await Promise.all([
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
    ])
    return {
      audit,
      friends,
      collection,
      outdate,
      banned,
    }
  }

  async sendToCandidate(model: LinkModel) {
    if (!model.email) {
      return
    }
    const enable = (await this.configs.get('mailOptions')).enable
    if (!enable || isDev) {
      console.log(`
      To: ${model.email}
      你的友链已通过
        站点标题: ${model.name}
        站点网站: ${model.url}
        站点描述: ${model.description}`)
      return
    }

    await this.emailService.sendLinkApplyEmail({
      model,
      to: model.email,
      template: LinkApplyEmailType.ToCandidate,
    })
  }
  async sendToMaster(authorName: string, model: LinkModel) {
    const enable = (await this.configs.get('mailOptions')).enable
    if (!enable || isDev) {
      console.log(`来自 ${authorName} 的友链请求:
        站点标题: ${model.name}
        站点网站: ${model.url}
        站点描述: ${model.description}`)
      return
    }
    process.nextTick(async () => {
      const master = await this.configs.getMaster()

      await this.emailService.sendLinkApplyEmail({
        authorName,
        model,
        to: master.mail,
        template: LinkApplyEmailType.ToMaster,
      })
    })
  }
  /** 确定友链存活状态 */
  async checkLinkHealth() {
    const links = await this.model.find({ state: LinkState.Pass })
    const health = await Promise.all(
      links.map(({ id, url }) => {
        Logger.debug(
          `检查友链 ${id} 的健康状态: GET -> ${url}`,
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
          .catch((err) => {
            return {
              id,
              status: err.response?.status || 'ERROR',
              message: err.message,
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
}
