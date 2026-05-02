import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { omit, pick, uniqBy } from 'es-toolkit/compat'
import type { Socket } from 'socket.io'

import { RequestContext } from '~/common/contexts/request.context'
import { BizException } from '~/common/exceptions/biz.exception'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { GatewayService } from '~/processors/gateway/gateway.service'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { checkRefModelCollectionType } from '~/utils/biz.util'
import { camelcaseKeys } from '~/utils/tool.util'

import { CommentState } from '../comment/comment.model'
import { CommentService } from '../comment/comment.service'
import { ConfigsService } from '../configs/configs.service'
import type { NoteModel } from '../note/note.model'
import { NoteService } from '../note/note.service'
import type { PostModel } from '../post/post.model'
import type { PostService } from '../post/post.service'
import { ReaderModel } from '../reader/reader.model'
import { ReaderService } from '../reader/reader.service'
import { Activity } from './activity.constant'
import type {
  ActivityLikePayload,
  ActivityLikeSupportType,
  ActivityPresence,
} from './activity.interface'
import { ActivityRepository, type ActivityRow } from './activity.repository'
import type { UpdatePresenceDto } from './activity.schema'
import {
  extractArticleIdFromRoomName,
  isValidRoomName,
  parseRoomName,
} from './activity.util'

interface ActivityPayloadWithRef {
  id?: string
  type?: string
  readerId?: string
  roomName?: string
}

type LegacyActivityWithRef = ActivityRow & {
  _id: ActivityRow['id']
  created: Date
  ref?: PostModel | NoteModel
  reader?: ReaderModel
  refId?: string
}

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

    private readonly activityRepository: ActivityRepository,

    private readonly commentService: CommentService,
    private readonly databaseService: DatabaseService,

    private readonly webGateway: WebEventsGateway,
    private readonly gatewayService: GatewayService,
    private readonly configsService: ConfigsService,

    @Inject(POST_SERVICE_TOKEN)
    private readonly postService: PostService,
    @Inject(forwardRef(() => NoteService))
    private readonly noteService: NoteService,
    private readonly readerService: ReaderService,
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
        this.activityRepository.create({
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

  private toLegacyActivity(row: ActivityRow) {
    return {
      ...row,
      _id: row.id,
      created: row.createdAt,
    }
  }

  private toLegacyPager(
    result: Awaited<ReturnType<ActivityRepository['list']>>,
  ) {
    return {
      docs: result.data.map((row) => this.toLegacyActivity(row)),
      totalDocs: result.pagination.total,
      page: result.pagination.currentPage,
      totalPages: result.pagination.totalPage,
      limit: result.pagination.size,
      hasNextPage: result.pagination.hasNextPage,
      hasPrevPage: result.pagination.hasPrevPage,
      data: result.data.map((row) => this.toLegacyActivity(row)),
    }
  }

  async getLikeActivities(page = 1, size = 10) {
    const activities = this.toLegacyPager(
      await this.activityRepository.list(page, size, Activity.Like),
    )
    const typedIdsMap = activities.data.reduce(
      (acc, item) => {
        if (!item.payload || typeof item.payload !== 'object') {
          return acc
        }
        const { type, id } = item.payload as unknown as ActivityLikePayload
        if (typeof type !== 'string' || typeof id !== 'string') {
          return acc
        }

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

    const readerIds = [] as string[]
    for (const item of activities.docs) {
      if (!item.payload || typeof item.payload !== 'object') continue
      const payload = item.payload as unknown as ActivityPayloadWithRef
      const readerId = payload.readerId
      if (typeof readerId === 'string') {
        readerIds.push(readerId)
      }
    }

    const readers = await this.readerService.findReaderInIds(readerIds)

    const readerMap = new Map<string, ReaderModel>()
    for (const reader of readers) {
      readerMap.set(reader._id.toHexString(), reader)
    }

    const refModelData = new Map<string, any>()
    const ids = Object.values(typedIdsMap).flat()
    const collections = await this.databaseService.findGlobalByIds(ids)
    for (const doc of [
      ...collections.posts,
      ...collections.notes,
      ...collections.pages,
      ...collections.recentlies,
    ]) {
      refModelData.set(doc.id, doc)
    }

    const docsWithRefModel = activities.docs.map((ac) => {
      const nextAc = { ...ac } as LegacyActivityWithRef
      if (!ac.payload || typeof ac.payload !== 'object') {
        return nextAc
      }
      const payload = ac.payload as unknown as ActivityPayloadWithRef
      const refModel = payload.id ? refModelData.get(payload.id) : undefined

      if (refModel) {
        nextAc.ref = refModel
      }
      const readerId = payload.readerId
      if (readerId) {
        const reader = readerMap.get(readerId)
        if (reader) {
          nextAc.reader = reader
        }
      }

      return nextAc
    })

    return {
      ...activities,
      data: docsWithRefModel,
    }
  }

  async getReadDurationActivities(page = 1, size = 10) {
    const data = this.toLegacyPager(
      await this.activityRepository.list(page, size, Activity.ReadDuration),
    )

    const articleIds = [] as string[]
    for (let i = 0; i < data.data.length; i++) {
      const item = data.data[i]
      if (!item.payload || typeof item.payload !== 'object') continue
      const payload = item.payload as unknown as ActivityPayloadWithRef
      const roomName = payload.roomName
      if (typeof roomName !== 'string') continue
      const refId = extractArticleIdFromRoomName(roomName)
      articleIds.push(refId)
      ;(data.data[i] as LegacyActivityWithRef).refId = refId
    }

    const documentMap = await this.databaseService.findGlobalByIds(articleIds)
    return {
      ...data,
      objects: documentMap,
    }
  }

  async likeAndEmit(type: 'post' | 'note', id: string, ip: string) {
    const readerId = RequestContext.currentReaderId()

    let reader: ReaderModel | null = null
    if (readerId) {
      reader = await this.readerService
        .findReaderInIds([readerId])
        .then((res) => res[0])
    }

    try {
      const mapping = {
        post: ArticleTypeEnum.Post,
        note: ArticleTypeEnum.Note,
      }

      // TODO 改成 reader 维度
      const res = await this.countingService.updateLikeCountWithIp(
        mapping[type],
        id,
        ip,
      )
      if (!res) {
        throw new BizException(ErrorCodeEnum.AlreadySupported)
      }
    } catch (error: any) {
      throw new BizException(ErrorCodeEnum.AlreadySupported, error?.message)
    }

    const refModel = await this.databaseService
      .findGlobalById(id)
      .then((res) => res?.document)
    this.eventService.emit(
      BusinessEvents.ACTIVITY_LIKE,
      {
        id,
        type,
        reader,
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

    await this.activityRepository.create({
      type: Activity.Like,
      payload: {
        ip,
        type,
        id,
        readerId: reader ? readerId : undefined,
      },
    })
  }

  async updatePresence(data: UpdatePresenceDto, ip: string) {
    const roomName = data.roomName

    if (!isValidRoomName(roomName)) {
      throw new BizException(ErrorCodeEnum.InvalidRoomName)
    }
    const roomSockets = await this.webGateway.getSocketsOfRoom(roomName)

    const socket = roomSockets.find((socket) => socket.id === data.sid)
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
      readerId: data.readerId,
      ip,
    }

    delete (presenceData as any).ts
    const serializedPresenceData = omit(presenceData, 'ip') as any
    if (data.readerId) {
      const reader = await this.readerService.findReaderInIds([data.readerId])
      if (reader.length) {
        Object.assign(serializedPresenceData, {
          reader: camelcaseKeys({
            ...reader[0],
            _id: undefined,
            id: reader[0]._id.toHexString(),
          }),
        })
      }
    }

    const roomJoinedAtMap =
      await this.webGateway.getSocketRoomJoinedAtMap(socket)

    serializedPresenceData.joinedAt = roomJoinedAtMap[roomName]

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

    const presences = socketMeta
      .filter((x) => x?.presence)
      .map((x) => ({
        ...x.presence!,
        joinedAt: x.roomJoinedAtMap?.[roomName],
      }))
      .sort((a, b) => a.updatedAt - b.updatedAt)

    return uniqBy(presences, (x) => x.identity)
  }

  async deleteActivityByType(type: Activity, beforeDate: Date) {
    const deletedCount = await this.activityRepository.deleteByTypeBefore(
      type,
      beforeDate,
    )
    return { deletedCount }
  }

  async deleteAll() {
    const deletedCount = await this.activityRepository.deleteAll()
    return { deletedCount }
  }

  async getAllRoomNames() {
    const roomMap = await this.webGateway.getAllRooms()
    const rooms = Object.keys(roomMap)
    const roomCount: Record<string, number> = {}
    for (const roomName of rooms) {
      roomCount[roomName] = roomMap[roomName].length
    }
    return { rooms, roomCount }
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

  async getDateRangeOfReadings(startAt?: Date, endAt?: Date, limit = 50) {
    startAt = startAt ?? new Date('2020-01-01')
    endAt = endAt ?? new Date()

    const activities = await this.activityRepository.findByTypeInRange(
      Activity.ReadDuration,
      startAt,
      endAt,
    )

    const countMap = new Map<string, number>()
    for (const item of activities) {
      if (!item.payload || typeof item.payload !== 'object') continue
      const payload = item.payload as unknown as ActivityPayloadWithRef
      if (typeof payload.roomName !== 'string') continue
      const refId = extractArticleIdFromRoomName(payload.roomName)
      if (!refId) continue
      countMap.set(refId, (countMap.get(refId) || 0) + 1)
    }

    const sorted = [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)

    const topRefIds = sorted.map(([id]) => id)
    const idsCollections = await this.databaseService.findGlobalByIds(topRefIds)
    const mapping = this.databaseService.flatCollectionToMap(idsCollections)

    return sorted.map(([refId, count]) => ({
      refId,
      count,
      ref: mapping[refId],
    }))
  }

  async getTopReadings(limit = 5, days = 14) {
    const endAt = new Date()
    const startAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    return this.getDateRangeOfReadings(startAt, endAt, limit)
  }

  async getRecentComment() {
    const configs = await this.configsService.get('commentOptions')
    const { commentShouldAudit } = configs

    const docs = await this.commentService.findRecent(3, {
      state: commentShouldAudit ? CommentState.Read : undefined,
      rootOnly: false,
    })

    // For post refs, look up their categories separately
    const refs = await this.databaseService.findGlobalByIds(
      docs.map((doc) => doc.ref).filter(Boolean),
    )
    const refMap = this.databaseService.flatCollectionToMap(refs)
    await this.commentService.fillAndReplaceAvatarUrl(docs)
    return docs
      .filter((doc) => doc.ref)
      .map((doc) => {
        const ref = refMap[String(doc.ref)]
        return {
          ...pick(doc, 'created', 'author', 'text', 'avatar'),
          ...pick(ref, 'title', 'nid', 'slug', 'id', 'category'),
          type: checkRefModelCollectionType(ref),
        }
      })
  }

  async getRecentPublish() {
    const [recent, post, note] = await Promise.all([
      this.databaseService.findGlobalByIds([]).then(() => []),
      this.postService.findRecent(3),
      this.noteService.findRecent(3, { visibleOnly: true }),
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
      this.postService
        .findRecent(50)
        .then((rows) => rows.filter((row) => row.created >= $gte)),
      this.noteService
        .findRecent(50)
        .then((rows) => rows.filter((row) => row.created >= $gte)),
    ])
    return {
      posts,
      notes: notes.map((note) => {
        if (note.password || !note.isPublished) {
          note.title = '未公开的日记'
        }

        return omit(note, 'password', 'isPublished')
      }),
    }
  }
}
