import pluralize from 'pluralize'

import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common'

import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { CacheService } from '~/processors/redis/cache.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils'

import { CommentRefTypes } from '../comment/comment.model'
import { CommentService } from '../comment/comment.service'
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
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,
  ) {}

  public get model() {
    return this.recentlyModel
  }

  async getAll() {
    // TODO lookup `ref`
    const result = (await this.model.aggregate([
      {
        $lookup: {
          from: 'comments',
          as: 'comment',
          foreignField: 'ref',
          localField: '_id',
        },
      },

      {
        $addFields: {
          comments: {
            $size: '$comment',
          },
        },
      },
      {
        $project: {
          comment: 0,
        },
      },
      {
        $sort: {
          created: -1,
        },
      },
    ])) as RecentlyModel[]

    await this.populateRef(result)

    return result
  }

  async populateRef(result: RecentlyModel[], omit = ['text']) {
    const refMap: Record<Exclude<CommentRefTypes, 'Recently'>, string[]> = {
      Note: [],
      Page: [],
      Post: [],
    }
    for (const doc of result) {
      if (!doc.refType) {
        continue
      }
      refMap[doc.refType]?.push(doc.ref)
    }

    const foreignIdMap = {} as any

    for (const refType in refMap) {
      const refIds = refMap[refType as CommentRefTypes]
      if (!refIds.length) {
        continue
      }

      await this.databaseService.db
        .collection(pluralize(refType).toLowerCase())
        .find({
          _id: {
            $in: refIds,
          },
        })
        .forEach((doc) => {
          foreignIdMap[doc._id.toHexString()] = Object.assign({}, doc)
        })
    }

    for (const doc of result) {
      if (!doc.refType) {
        continue
      }

      const hasRef = foreignIdMap[(doc.ref as any)?.toHexString()]
      if (hasRef) {
        for (const field of omit) {
          Reflect.deleteProperty(hasRef, field)
        }
        doc.ref = hasRef
      }
    }
    return result
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

    const result = await this.recentlyModel.aggregate([
      {
        $match: after
          ? {
              _id: {
                $gt: after,
              },
            }
          : before
          ? { _id: { $lt: before } }
          : {},
      },

      {
        $lookup: {
          from: 'comments',
          as: 'comment',
          foreignField: 'ref',
          localField: '_id',
        },
      },

      {
        $addFields: {
          comments: {
            $size: '$comment',
          },
        },
      },
      {
        $project: {
          comment: 0,
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
      { $limit: size },
    ])
    await this.populateRef(result)
    return result
  }
  async getLatestOne() {
    const latest = await this.model
      .findOne()
      .sort({ created: -1 })
      .populate([
        {
          path: 'ref',
          select: '-text',
        },
      ])
      .lean()

    if (!latest) {
      return null
    }

    const commentCount = await this.commentService.model.countDocuments({
      refType: CommentRefTypes.Recently,
      ref: latest._id,
    })

    return {
      ...latest,
      comments: commentCount,
    }
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
      const { attitude: prevAttitude } = JSON.parse(currentAttitude)
      // 之前是点了赞，现在还是点赞，取消之前的点赞
      if (prevAttitude === attitude) {
        model.$inc(attitudePath[prevAttitude], -1)
        await redis.hdel(getRedisKey(RedisKeys.RecentlyAttitude), key)
        // 之前点了赞，现在点了踩，取消之前的点赞，并且踩 +1
      } else {
        model.$inc(attitudePath[prevAttitude], -1)
        model.$inc(attitudePath[attitude], 1)
        await redis.hset(
          getRedisKey(RedisKeys.RecentlyAttitude),
          key,
          JSON.stringify({ attitude, date: new Date().toISOString() }),
        )
      }

      await model.save()

      return prevAttitude === attitude ? -1 : 1
    }

    model.$inc(attitudePath[attitude], 1)
    await redis.hset(
      getRedisKey(RedisKeys.RecentlyAttitude),
      key,
      JSON.stringify({ attitude, date: new Date().toISOString() }),
    )
    await model.save()
    return 1
  }
}
