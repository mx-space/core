import { forwardRef, Inject, Injectable } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'
import { scheduleManager } from '~/utils/schedule.util'

import { CommentService } from '../comment/comment.service'
import { ConfigsService } from '../configs/configs.service'
import { RecentlyModel } from './recently.model'
import { RecentlyRepository, type RecentlyRow } from './recently.repository'
import { RecentlyAttitudeEnum } from './recently.schema'

@Injectable()
export class RecentlyService {
  constructor(
    private readonly recentlyRepository: RecentlyRepository,
    private readonly eventManager: EventManagerService,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,
    private readonly configsService: ConfigsService,
  ) {}

  public get repository() {
    return this.recentlyRepository
  }

  toLegacy(row: RecentlyRow | null): any {
    if (!row) return null
    return {
      ...row,
      _id: row.id,
      created: row.createdAt,
      modified: row.modifiedAt,
      ref: row.refId,
      comments: row.commentsIndex,
    }
  }

  toLegacyMany(rows: RecentlyRow[]) {
    return rows.map((row) => this.toLegacy(row))
  }

  async findById(id: string) {
    return this.toLegacy(await this.recentlyRepository.findById(id))
  }

  async findRecent(size: number) {
    return this.toLegacyMany(await this.recentlyRepository.findRecent(size))
  }

  async count() {
    return this.recentlyRepository.count()
  }

  async getAll() {
    const result = await this.recentlyRepository.list(1, 50)
    return this.toLegacyMany(result.data)
  }

  async getOne(id: string) {
    return this.findById(id)
  }

  async populateRef<T extends RecentlyModel>(result: T[], _omit = ['text']) {
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
    void before
    void after
    void (await this.configsService.get('commentOptions'))
    return this.findRecent(size ?? 10)
  }

  async getLatestOne() {
    const [latest] = await this.findRecent(1)
    if (!latest) return null
    const commentCount = await this.commentService.countByRef(
      CollectionRefTypes.Recently,
      latest.id,
    )
    return { ...latest, comments: commentCount }
  }

  async create(model: RecentlyModel) {
    let refType = model.refType
    const refId = model.refId ?? (model as any).ref
    if (refId) {
      const existModel = await this.databaseService.findGlobalById(refId)
      if (!existModel || !existModel.type) {
        throw new BizException(ErrorCodeEnum.RefModelNotFound)
      }
      refType = existModel.type
    }

    const withRef = this.toLegacy(
      await this.recentlyRepository.create({
        content: model.content,
        type: (model as any).type,
        metadata: (model as any).metadata,
        refId,
        refType: refType as any,
      }),
    )
    scheduleManager.schedule(async () => {
      await this.eventManager.emit(BusinessEvents.RECENTLY_CREATE, withRef, {
        scope: EventScope.TO_SYSTEM_VISITOR,
      })
    })
    return withRef
  }

  async delete(id: string) {
    const deleted = await this.recentlyRepository.deleteById(id)
    await this.commentService.deleteForRef(CollectionRefTypes.Recently, id)
    const isDeleted = !!deleted
    scheduleManager.schedule(async () => {
      if (isDeleted) {
        await this.eventManager.emit(
          BusinessEvents.RECENTLY_DELETE,
          { id },
          { scope: EventScope.TO_SYSTEM_VISITOR },
        )
      }
    })
    return isDeleted
  }

  async update(id: string, model: Partial<RecentlyModel>) {
    const withRef = this.toLegacy(
      await this.recentlyRepository.update(id, {
        content: model.content,
        type: model.type,
        metadata: model.metadata,
        modifiedAt: new Date(),
      }),
    )
    if (!withRef) return null
    scheduleManager.schedule(async () => {
      await this.eventManager.emit(BusinessEvents.RECENTLY_UPDATE, withRef, {
        scope: EventScope.TO_SYSTEM_VISITOR,
      })
    })
    return withRef
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
    if (!ip) throw new BizException(ErrorCodeEnum.CannotGetIp)
    const model = await this.recentlyRepository.findById(id)
    if (!model) throw new CannotFindException()

    const redis = this.redisService.getClient()
    const key = `${id}:${ip}`
    const currentAttitude = await redis.hget(
      getRedisKey(RedisKeys.RecentlyAttitude),
      key,
    )

    if (currentAttitude) {
      const { attitude: prevAttitude } = JSON.parse(currentAttitude)
      if (prevAttitude === attitude) {
        if (prevAttitude === RecentlyAttitudeEnum.Up) {
          await this.recentlyRepository.incrementUp(id, -1)
        } else {
          await this.recentlyRepository.incrementDown(id, -1)
        }
        await redis.hdel(getRedisKey(RedisKeys.RecentlyAttitude), key)
        return -1
      }
      if (prevAttitude === RecentlyAttitudeEnum.Up) {
        await this.recentlyRepository.incrementUp(id, -1)
        await this.recentlyRepository.incrementDown(id, 1)
      } else {
        await this.recentlyRepository.incrementDown(id, -1)
        await this.recentlyRepository.incrementUp(id, 1)
      }
      await redis.hset(
        getRedisKey(RedisKeys.RecentlyAttitude),
        key,
        JSON.stringify({ attitude, date: new Date().toISOString() }),
      )
      return 1
    }

    if (attitude === RecentlyAttitudeEnum.Up) {
      await this.recentlyRepository.incrementUp(id, 1)
    } else {
      await this.recentlyRepository.incrementDown(id, 1)
    }
    await redis.hset(
      getRedisKey(RedisKeys.RecentlyAttitude),
      key,
      JSON.stringify({ attitude, date: new Date().toISOString() }),
    )
    return 1
  }
}
