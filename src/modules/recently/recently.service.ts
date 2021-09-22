import { Injectable } from '@nestjs/common'
import { InjectModel } from 'nestjs-typegoose'
import { EventTypes } from '~/processors/gateway/events.types'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { RecentlyModel } from './recently.model'

@Injectable()
export class RecentlyService {
  constructor(
    @InjectModel(RecentlyModel)
    private readonly recentlyModel: MongooseModel<RecentlyModel>,
    private readonly gateway: WebEventsGateway,
  ) {}

  public get model() {
    return this.recentlyModel
  }

  async getAll() {
    return this.model.find().sort({ created: -1 }).lean()
  }

  async getOffset({
    before,
    size,
    after,
  }: {
    before?: string
    size?: number
    after?: string
  }) {
    size = size ?? 10

    return await this.model
      .find(
        after
          ? {
              _id: {
                $gt: after,
              },
            }
          : before
          ? { _id: { $lt: before } }
          : {},
      )
      .limit(size)
      .sort({ _id: -1 })
      .lean()
  }
  async getLatestOne() {
    return await this.model.findOne().sort({ created: -1 }).lean()
  }

  async create(model: RecentlyModel) {
    const res = await this.model.create({
      content: model.content,
      language: model.language,
      project: model.project,
    })
    process.nextTick(async () => {
      await this.gateway.broadcast(EventTypes.RECENTLY_CREATE, res)
    })
    return res
  }

  async delete(id: string) {
    const { deletedCount } = await this.model.deleteOne({
      _id: id,
    })
    const isDeleted = deletedCount === 1
    process.nextTick(async () => {
      if (isDeleted) {
        await this.gateway.broadcast(EventTypes.RECENTLY_DElETE, { id })
      }
    })
    return isDeleted
  }
}
