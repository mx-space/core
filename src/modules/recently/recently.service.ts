import { Injectable } from '@nestjs/common'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'

import { RecentlyModel } from './recently.model'

@Injectable()
export class RecentlyService {
  constructor(
    @InjectModel(RecentlyModel)
    private readonly recentlyModel: MongooseModel<RecentlyModel>,
    private readonly eventManager: EventManagerService,
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
      await this.eventManager.broadcast(BusinessEvents.RECENTLY_CREATE, res, {
        scope: EventScope.TO_SYSTEM_VISITOR,
      })
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
        await this.eventManager.broadcast(BusinessEvents.RECENTLY_DElETE, id, {
          scope: EventScope.TO_SYSTEM_VISITOR,
        })
      }
    })
    return isDeleted
  }
}
