import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from 'nestjs-typegoose'
import { AdminEventsGateway } from '~/processors/gateway/admin/events.gateway'
import { EventTypes } from '~/processors/gateway/events.types'
import {
  EmailService,
  LinkApplyEmailType,
} from '~/processors/helper/helper.email.service'
import { isDev } from '~/utils/index.util'
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

      process.nextTick(async () => {
        await this.adminGateway.broadcast(EventTypes.LINK_APPLY, doc)
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
    const [audit, friends, collection] = await Promise.all([
      this.model.countDocuments({ state: LinkState.Audit }),
      this.model.countDocuments({
        type: LinkType.Friend,
        state: LinkState.Pass,
      }),
      this.model.countDocuments({
        type: LinkType.Collection,
      }),
    ])
    return {
      audit,
      friends,
      collection,
    }
  }

  async sendToCandidate(model: LinkModel) {
    if (!model.email) {
      return
    }
    const enable = this.configs.get('mailOptions').enable
    if (!enable || isDev) {
      console.log(`
      TO: ${model.email}
      你的友链已通过
        站点标题: ${model.name}
        站点网站: ${model.url}
        站点描述: ${model.description}`)
      return
    }
    process.nextTick(async () => {
      await this.emailService.sendLinkApplyEmail({
        model,
        to: model.email,
        template: LinkApplyEmailType.ToCandidate,
      })
    })
  }
  async sendToMaster(authorName: string, model: LinkModel) {
    const enable = this.configs.get('mailOptions').enable
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
}
