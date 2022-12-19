import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common'

import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { CacheService } from '~/processors/redis/cache.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils'

import { RecentlyAttitudeEnum } from './recently.dto'
import { RecentlyModel } from './recently.model'

@Injectable()
export class RecentlyService {
  constructor(
    @InjectModel(RecentlyModel)
    private readonly recentlyModel: MongooseModel<RecentlyModel>,
    private readonly eventManager: EventManagerService,
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  public get model() {
    return this.recentlyModel
  }

  async getAll() {
    return this.model
      .find()
      .sort({ created: -1 })

      .populate({
        path: 'ref',
        select: '-text',
      })
      .lean()
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
      .populate([
        {
          path: 'ref',
          select: '-text',
        },
      ])
      .lean()
  }
  async getLatestOne() {
    return await this.model
      .findOne()
      .sort({ created: -1 })
      .populate([
        {
          path: 'ref',
          select: '-text',
        },
      ])
      .lean()
  }

  async create(model: RecentlyModel) {
    if (model.refId) {
      const existModel = await this.databaseService.findGlobalById(model.refId)
      if (!existModel.type) {
        throw new BadRequestException('ref model not found')
      }

      model.refType = existModel.type
    }

    const res = await this.model.create({
      content: model.content,
      ref: model.refId,
      refType: model.refType,
    })

    const withRef = await this.model
      .findById(res._id)
      .populate([
        {
          path: 'ref',
          select: '-text',
        },
      ])
      .lean()
    process.nextTick(async () => {
      await this.eventManager.broadcast(
        BusinessEvents.RECENTLY_CREATE,
        withRef,
        {
          scope: EventScope.TO_SYSTEM_VISITOR,
        },
      )
    })
    return withRef
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

  async updateAttitude({
    id,
    attitude,
    ip,
  }: {
    id: string
    attitude: RecentlyAttitudeEnum
    ip: string
  }) {
    if (!ip) {
      throw new UnprocessableEntityException('can not got your ip')
    }
    const model = await this.model.findById(id)

    if (!model) {
      throw new CannotFindException()
    }

    const attitudePath = {
      [RecentlyAttitudeEnum.Up]: 'up',
      [RecentlyAttitudeEnum.Down]: 'down',
    }

    const redis = this.cacheService.getClient()
    const key = `${id}:${ip}`
    const currentAttitude = await redis.hget(
      getRedisKey(RedisKeys.RecentlyAttitude),
      key,
    )

    if (currentAttitude) {
      const { attitude } = JSON.parse(currentAttitude)
      model.$inc(attitudePath[attitude], -1)
      await model.save()
      await redis.hdel(getRedisKey(RedisKeys.RecentlyAttitude), key)
      return
    }

    model.$inc(attitudePath[attitude], 1)
    await redis.hset(
      getRedisKey(RedisKeys.RecentlyAttitude),
      key,
      JSON.stringify({ attitude, date: new Date().toISOString() }),
    )
    await model.save()
  }
}
