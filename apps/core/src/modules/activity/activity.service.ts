import { omit, pick, uniqBy } from 'lodash'
import { Types } from 'mongoose'

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common'

import { ArticleTypeEnum } from '~/constants/article.constant'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import {
  NOTE_COLLECTION_NAME,
  POST_COLLECTION_NAME,
  RECENTLY_COLLECTION_NAME,
} from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { GatewayService } from '~/processors/gateway/gateway.service'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'
import { checkRefModelCollectionType } from '~/utils'

import { CommentState } from '../comment/comment.model'
import { CommentService } from '../comment/comment.service'
import { ConfigsService } from '../configs/configs.service'
import { NoteService } from '../note/note.service'
import { PostService } from '../post/post.service'
import { Activity } from './activity.constant'
import { ActivityModel } from './activity.model'
import {
  extractArticleIdFromRoomName,
  isValidRoomName,
  parseRoomName,
} from './activity.util'
import type { UpdatePresenceDto } from './dtos/presence.dto'
import type {
  ActivityLikePayload,
  ActivityLikeSupportType,
  ActivityPresence,
} from './activity.interface'
import type { RecentlyModel } from '../recently/recently.model'
import type { PostModel } from '../post/post.model'
import type { PageModel } from '../page/page.model'
import type { NoteModel } from '../note/note.model'
import type { Socket } from 'socket.io'
import type { Collection } from 'mongodb'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'

declare module '~/types/socket-meta' {
  interface SocketMetadata {
    presence?: ActivityPresence
  }
}

@Injectable()
export class ActivityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger
  constructor(
    private readonly countingService: CountingService,

    private readonly eventService: EventManagerService,

    @InjectModel(ActivityModel)
    private readonly activityModel: MongooseModel<ActivityModel>,

    private readonly commentService: CommentService,
    private readonly databaseService: DatabaseService,

    private readonly webGateway: WebEventsGateway,
    private readonly gatewayService: GatewayService,
    private readonly configsService: ConfigsService,

    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,
    @Inject(forwardRef(() => NoteService))
    private readonly noteService: NoteService,
  ) {
    this.logger = new Logger(ActivityService.name)
  }

  private cleanupFnList: Array<() => any | null> = []

  onModuleDestroy() {
    this.cleanupFnList.forEach((fn) => fn())
  }

  onModuleInit() {
    const handlePresencePersistToDb = async (socket: Socket) => {
      const meta = await this.gatewayService.getSocketMetadata(socket)

      const { presence, roomJoinedAtMap } = meta

      if (presence) {
        const {
          connectedAt,
          operationTime,
          updatedAt,
          position,
          roomName,
          displayName,
          ip,
        } = presence
        const joinedAt = roomJoinedAtMap?.[roomName]
        if (!joinedAt) return
        const duration = operationTime - joinedAt

        if (duration < 10_000 || (position === 0 && duration < 60_000)) {
          return
        }
        this.activityModel.create({
          type: Activity.ReadDuration,
          payload: {
            connectedAt,
            operationTime,
            updatedAt,
            position,
            roomName,
            displayName,
            joinedAt,
            ip,
          },
        })
      }
    }
    const q = [
      this.webGateway.registerHook('onDisconnected', handlePresencePersistToDb),
      this.webGateway.registerHook('onLeaveRoom', async (socket, roomName) => {
        const socketMeta = await this.gatewayService.getSocketMetadata(socket)
        if (socketMeta.presence) {
          this.webGateway.broadcast(
            BusinessEvents.ACTIVITY_LEAVE_PRESENCE,
            {
              identity: socketMeta.presence.identity,
              roomName,
            },
            {
              rooms: [roomName],
            },
          )
          handlePresencePersistToDb(socket)
        }
      }),
    ]
    this.cleanupFnList = q
  }

  get model() {
    return this.activityModel
  }

  async getLikeActivities(page = 1, size = 10) {
    const activities = await this.model.paginate(
      {
        type: Activity.Like,
      },
      {
        page,
        limit: size,
        sort: {
          created: -1,
        },
      },
    )

    const transformedPager = transformDataToPaginate(activities)
    const typedIdsMap = transformedPager.data.reduce(
      (acc, item) => {
        const { type, id } = item.payload as ActivityLikePayload

        switch (type.toLowerCase()) {
          case 'note': {
            acc.note.push(id)
            break
          }
          case 'post': {
            acc.post.push(id)

            break
          }
        }
        return acc
      },
      {
        post: [],
        note: [],
      } as Record<ActivityLikeSupportType, string[]>,
    )

    const type2Collection: Record<
      ActivityLikeSupportType,
      Collection<Document>
    > = {
      note: this.databaseService.db.collection(NOTE_COLLECTION_NAME),
      post: this.databaseService.db.collection(POST_COLLECTION_NAME),
    }

    const refModelData = new Map<string, any>()
    for (const [type, ids] of Object.entries(typedIdsMap)) {
      const collection = type2Collection[type as ActivityLikeSupportType]
      const docs = await collection
        .find(
          {
            _id: {
              $in: ids.map((id) => new Types.ObjectId(id)),
            },
          },
          {
            projection: {
              text: 0,
            },
          },
        )
        .toArray()

      for (const doc of docs) {
        refModelData.set(doc._id.toHexString(), doc)
      }
    }

    const docsWithRefModel = activities.docs.map((ac) => {
      const nextAc = ac.toJSON()
      const refModel = refModelData.get(ac.payload.id)

      refModel && Reflect.set(nextAc, 'ref', refModel)

      return nextAc
    }) as any as (ActivityModel & {
      payload: any
      ref: PostModel | NoteModel
    })[]

    return {
      ...transformedPager,
      data: docsWithRefModel,
    }
  }

  async getReadDurationActivities(page = 1, size = 10) {
    const activities = await this.model.paginate(
      {
        type: Activity.ReadDuration,
      },
      {
        page,
        limit: size,
        sort: {
          created: -1,
        },
      },
    )
    const data = transformDataToPaginate(activities)

    const articleIds = [] as string[]
    for (let i = 0; i < data.data.length; i++) {
      const item = data.data[i]
      const roomName = item.payload.roomName
      if (!roomName) continue
      const refId = extractArticleIdFromRoomName(roomName)
      articleIds.push(refId)
      data.data[i] = data.data[i].toObject()
      ;(data.data[i] as any).refId = refId
    }

    const documentMap = await this.databaseService.findGlobalByIds(articleIds)
    return {
      ...data,
      objects: documentMap,
    }
  }

  async likeAndEmit(type: 'post' | 'note', id: string, ip: string) {
    try {
      const mapping = {
        post: ArticleTypeEnum.Post,
        note: ArticleTypeEnum.Note,
      }
      const res = await this.countingService.updateLikeCountWithIp(
        mapping[type],
        id,
        ip,
      )
      if (!res) {
        throw new BadRequestException('你已经支持过啦！')
      }
    } catch (error: any) {
      throw new BadRequestException(error)
    }

    const refModel = await this.databaseService
      .findGlobalById(id)
      .then((res) => res?.document)
    this.eventService.emit(
      BusinessEvents.ACTIVITY_LIKE,
      {
        id,
        type,
        ref: pick(refModel, [
          'id',
          '_id',
          'title',
          'nid',
          'slug',
          'category',
          'categoryId',
          'created',
        ]),
      },
      {
        scope: EventScope.TO_SYSTEM_ADMIN,
      },
    )

    await this.activityModel.create({
      type: Activity.Like,
      created: new Date(),
      payload: {
        ip,
        type,
        id,
      } as ActivityLikePayload,
    })
  }

  async updatePresence(data: UpdatePresenceDto, ip: string) {
    const roomName = data.roomName

    if (!isValidRoomName(roomName)) {
      throw new BadRequestException('invalid room_name')
    }
    const roomSockets = await this.webGateway.getSocketsOfRoom(roomName)

    // TODO 或许应该找到所有的同一个用户的 socket 最早的一个连接时间
    const socket = roomSockets.find(
      (socket) =>
        // (await this.gatewayService.getSocketMetadata(socket))?.sessionId ===
        // data.identity,
        socket.id === data.sid,
    )
    if (!socket) {
      this.logger.debug(
        `socket not found, room_name: ${roomName} identity: ${data.identity}`,
      )
      return
    }

    const presenceData: ActivityPresence = {
      ...data,

      operationTime: data.ts,
      updatedAt: Date.now(),
      connectedAt: +new Date(socket.handshake.time),

      ip,
    }

    Reflect.deleteProperty(presenceData, 'ts')
    const serializedPresenceData = omit(presenceData, 'ip')

    const roomJoinedAtMap =
      await this.webGateway.getSocketRoomJoinedAtMap(socket)

    Reflect.set(serializedPresenceData, 'joinedAt', roomJoinedAtMap[roomName])

    this.webGateway.broadcast(
      BusinessEvents.ACTIVITY_UPDATE_PRESENCE,
      serializedPresenceData,
      {
        rooms: [roomName],
      },
    )

    await this.gatewayService.setSocketMetadata(socket, {
      presence: presenceData,
    })

    return serializedPresenceData
  }

  async getRoomPresence(roomName: string): Promise<ActivityPresence[]> {
    const roomSocket = await this.webGateway.getSocketsOfRoom(roomName)
    const socketMeta = await Promise.all(
      roomSocket.map((socket) => this.gatewayService.getSocketMetadata(socket)),
    )

    return uniqBy(
      socketMeta
        .filter((x) => x?.presence)
        .map((x) => {
          // eslint-disable-next-line array-callback-return
          if (!x.presence) return

          return {
            ...x.presence,
            joinedAt: x.roomJoinedAtMap?.[roomName],
          }
        })
        .sort((a, b) => {
          if (a && b) return a.updatedAt - b.updatedAt
          return 1
        }) as ActivityPresence[],
      (x) => x.identity,
    )
  }

  async deleteActivityByType(type: Activity, beforeDate: Date) {
    return this.model.deleteMany({
      type,
      created: {
        $lt: beforeDate,
      },
    })
  }

  async deleteAll() {
    return this.model.deleteMany({})
  }

  async getAllRoomNames() {
    const roomMap = await this.webGateway.getAllRooms()
    const rooms = Object.keys(roomMap)
    return {
      rooms,
      roomCount: rooms.reduce((acc, roomName) => {
        return {
          ...acc,
          [roomName]: roomMap[roomName].length,
        }
      }, {}) as any as Record<string, number>,
    }
  }

  async getRefsFromRoomNames(roomNames: string[]) {
    const articleIds = [] as string[]
    for (const roomName of roomNames) {
      const parsed = parseRoomName(roomName)
      if (!parsed) continue
      switch (parsed.type) {
        case 'article': {
          const { refId } = parsed

          articleIds.push(refId)
          break
        }
      }
    }

    const objects = await this.databaseService.findGlobalByIds(articleIds)

    return { objects }
  }

  async getDateRangeOfReadings(startAt?: Date, endAt?: Date) {
    startAt = startAt ?? new Date('2020-01-01')
    endAt = endAt ?? new Date()

    const activities = await this.activityModel
      .find({
        created: {
          $gte: startAt,
          $lte: endAt,
        },
        type: Activity.ReadDuration,
      })
      .lean({
        getters: true,
      })

    const refIds = new Set<string>()
    for (const item of activities) {
      const parsed = item.payload
      const refId = extractArticleIdFromRoomName(parsed.roomName)
      if (!refId) continue
      refIds.add(refId)
    }

    const activityCountingMap = activities.reduce(
      (acc, item) => {
        const refId = extractArticleIdFromRoomName(item.payload.roomName)
        if (!refId) return acc
        if (!acc[refId]) {
          acc[refId] = 0
        }
        acc[refId]++

        return acc
      },
      {} as Record<string, number>,
    )

    const result = [] as {
      refId: string
      count: number
      ref: PostModel | NoteModel | PageModel | RecentlyModel
    }[]

    const idsCollections = await this.databaseService.findGlobalByIds(
      Array.from(refIds),
    )

    const mapping = this.databaseService.flatCollectionToMap(idsCollections)
    for (const refId of refIds) {
      result.push({
        refId,
        count: activityCountingMap[refId] ?? 0,
        ref: mapping[refId],
      })
    }

    return result
  }

  async getRecentComment() {
    const configs = await this.configsService.get('commentOptions')
    const { commentShouldAudit } = configs

    const docs = await this.commentService.model
      .find({
        isWhispers: false,
        state: commentShouldAudit
          ? CommentState.Read
          : {
              $in: [CommentState.Read, CommentState.Unread],
            },
      })

      .populate('ref', 'title nid slug subtitle content categoryId')

      .lean({ getters: true })
      .sort({
        created: -1,
      })
      .limit(3)

    await this.commentService.fillAndReplaceAvatarUrl(docs)
    return docs.map((doc) => {
      return Object.assign(
        {},
        pick(doc, 'created', 'author', 'text', 'avatar'),
        pick(doc.ref, 'title', 'nid', 'slug', 'id'),
        {
          type: checkRefModelCollectionType(doc.ref),
        },
      )
    })
  }

  async getRecentPublish() {
    const [recent, post, note] = await Promise.all([
      this.databaseService.db
        .collection(RECENTLY_COLLECTION_NAME)
        .find()
        .project({
          content: 1,
          created: 1,
          up: 1,
          down: 1,
        })
        .sort({
          created: -1,
        })
        .limit(3)

        .toArray(),
      this.databaseService.db
        .collection(POST_COLLECTION_NAME)
        .find()
        .project({
          title: 1,
          slug: 1,
          created: 1,
          modified: 1,
          category: 1,
          categoryId: 1,
        })
        .sort({
          created: -1,
        })
        .limit(3)
        .toArray(),
      // .aggregate([
      //   {
      //     $lookup: {
      //       from: CATEGORY_COLLECTION_NAME,
      //       localField: 'categoryId',
      //       foreignField: '_id',
      //       as: 'category',
      //     },
      //   },
      //   {
      //     $project: {
      //       title: 1,
      //       slug: 1,
      //       created: 1,
      //       category: {
      //         $arrayElemAt: ['$category', 0],
      //       },
      //       categoryId: 1,
      //       id: '$_id',
      //     },
      //   },
      //   {
      //     $sort: {
      //       created: -1,
      //     },
      //   },
      //   {
      //     $limit: 3,
      //   },
      // ])
      // .toArray(),
      this.databaseService.db
        .collection(NOTE_COLLECTION_NAME)
        .find({
          hide: false,
        })
        .sort({
          created: -1,
        })
        .project({
          title: 1,
          nid: 1,
          id: 1,
          created: 1,
          modified: 1,
        })
        .limit(3)
        .toArray(),
    ])

    return {
      recent,
      post,
      note,
    }
  }

  /**
   * 获取过去一年的文章发布
   */
  async getLastYearPublication() {
    const $gte = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    const [posts, notes] = await Promise.all([
      this.postService.model
        .find({
          created: {
            $gte,
          },
        })
        .select('title created slug categoryId category')
        .sort({ created: -1 }),
      this.noteService.model
        .find(
          {
            created: {
              $gte,
            },
          },
          {
            title: 1,
            created: 1,
            nid: 1,
            weather: 1,
            mood: 1,
            bookmark: 1,
            password: 1,
            hide: 1,
          },
        )
        .lean(),
    ])
    return {
      posts,
      notes: notes.map((note) => {
        if (note.password || note.hide) {
          note.title = '未公开的日记'
        }

        return omit(note, 'password', 'hide')
      }),
    }
  }
}
