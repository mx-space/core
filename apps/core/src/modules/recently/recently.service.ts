import { mongo } from 'mongoose'
import pluralize from 'pluralize'

import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common'

import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils/redis.util'
import { scheduleManager } from '~/utils/schedule.util'

import { CommentState } from '../comment/comment.model'
import { CommentService } from '../comment/comment.service'
import { ConfigsService } from '../configs/configs.service'
import { RecentlyAttitudeEnum } from './recently.dto'
import { RecentlyModel } from './recently.model'

const { ObjectId } = mongo

@Injectable()
export class RecentlyService {
  constructor(
    @InjectModel(RecentlyModel)
    private readonly recentlyModel: MongooseModel<RecentlyModel>,
    private readonly eventManager: EventManagerService,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,
    private readonly configsService: ConfigsService,
  ) {}

  public get model() {
    return this.recentlyModel
  }

  async getAll() {
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

  async getOne(id: string) {
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
      {
        $match: {
          _id: new ObjectId(id),
        },
      },
    ])) as RecentlyModel[]

    await this.populateRef(result)

    return result[0] || null
  }
  async populateRef(result: RecentlyModel[], omit = ['text']) {
    const refMap: Record<
      Exclude<CollectionRefTypes, CollectionRefTypes.Recently>,
      string[]
    > = {
      [CollectionRefTypes.Post]: [],
      [CollectionRefTypes.Page]: [],
      [CollectionRefTypes.Note]: [],
    }
    for (const doc of result) {
      if (!doc.refType) {
        continue
      }
      refMap[doc.refType]?.push(doc.ref)
    }

    const foreignIdMap = {} as any

    for (const refType in refMap) {
      const refIds = refMap[refType as CollectionRefTypes]
      if (refIds.length === 0) {
        continue
      }
      const cursor = await this.databaseService.db
        .collection(pluralize(refType).toLowerCase())
        .find({
          _id: {
            $in: refIds,
          },
        })

      for await (const doc of cursor) {
        foreignIdMap[doc._id.toHexString()] = Object.assign({}, doc)
      }
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

    const configs = await this.configsService.get('commentOptions')
    const { commentShouldAudit } = configs

    const result = await this.recentlyModel.aggregate([
      {
        $match: after
          ? {
              _id: {
                $gt: new ObjectId(after),
              },
            }
          : before
            ? { _id: { $lt: new ObjectId(before) } }
            : {},
      },

      {
        $lookup: {
          from: 'comments',
          as: 'comment',
          foreignField: 'ref',
          localField: '_id',
          pipeline: [
            {
              $match: commentShouldAudit
                ? {
                    state: CommentState.Read,
                  }
                : {
                    $or: [
                      {
                        state: CommentState.Read,
                      },
                      {
                        state: CommentState.Unread,
                      },
                    ],
                  },
            },
          ],
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
      refType: CollectionRefTypes.Recently,
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
      if (!existModel || !existModel.type) {
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
    scheduleManager.schedule(async () => {
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
    const [{ deletedCount }] = await Promise.all([
      this.model.deleteOne({
        _id: id,
      }),
      // delete comment ref
      this.commentService.model.deleteMany({
        ref: id,
        refType: CollectionRefTypes.Recently,
      }),
    ])
    const isDeleted = deletedCount === 1
    scheduleManager.schedule(async () => {
      if (isDeleted) {
        await this.eventManager.broadcast(BusinessEvents.RECENTLY_DELETE, id, {
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

    const redis = this.redisService.getClient()
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
