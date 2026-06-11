import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { omit, pick, uniqBy } from 'es-toolkit/compat'
import type { Socket } from 'socket.io'

import { RequestContext } from '~/common/contexts/request.context'
import { AppErrorCode, createAppException } from '~/common/errors'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { GatewayService } from '~/processors/gateway/gateway.service'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { checkRefModelCollectionType } from '~/utils/biz.util'
import { camelcaseKeys } from '~/utils/tool.util'

import { CommentState } from '../comment/comment.enum'
import { CommentService } from '../comment/comment.service'
import { ConfigsService } from '../configs/configs.service'
import { NoteService } from '../note/note.service'
import type { NoteModel } from '../note/note.types'
import type { PostService } from '../post/post.service'
import type { PostModel } from '../post/post.types'
import { ReaderService } from '../reader/reader.service'
import { ReaderModel } from '../reader/reader.types'
import { Activity } from './activity.constant'
import type {
  ActivityLikePayload,
  ActivityPresence,
} from './activity.interface'
import { ActivityRepository } from './activity.repository'
import type { UpdatePresenceDto } from './activity.schema'
import type { ActivityRow } from './activity.types'
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

function toObjectPayload(
  payload: ActivityRow['payload'],
): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  return payload as Record<string, unknown>
}

type ActivityWithRef = ActivityRow & {
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

  async getLikeActivities(page = 1, size = 10) {
    const activities = await this.activityRepository.list(
      page,
      size,
      Activity.Like,
    )

    const refIds: string[] = []
    const readerIds: string[] = []
    for (const item of activities.data) {
      const payload = toObjectPayload(item.payload) as
        | Partial<ActivityLikePayload>
        | undefined
      if (!payload) continue
      const { type, id, readerId } = payload
      if (typeof type === 'string' && typeof id === 'string') {
        const lower = type.toLowerCase()
        if (lower === 'note' || lower === 'post') refIds.push(id)
      }
      if (typeof readerId === 'string') readerIds.push(readerId)
    }

    const [readers, collections] = await Promise.all([
      this.readerService.findReaderInIds(readerIds),
      this.databaseService.findGlobalByIds(refIds),
    ])

    const readerMap = new Map(readers.map((reader) => [reader.id, reader]))
    const refModelData = new Map<string, any>()
    for (const doc of [
      ...collections.posts,
      ...collections.notes,
      ...collections.pages,
      ...collections.recentlies,
    ]) {
      refModelData.set(doc.id, doc)
    }

    const docsWithRefModel = activities.data.map((ac) => {
      const nextAc = { ...ac } as ActivityWithRef
      const payload = toObjectPayload(ac.payload) as
        | ActivityPayloadWithRef
        | undefined
      if (!payload) return nextAc

      const refModel = payload.id ? refModelData.get(payload.id) : undefined
      if (refModel) nextAc.ref = refModel

      if (payload.readerId) {
        const reader = readerMap.get(payload.readerId)
        if (reader) nextAc.reader = reader
      }

      return nextAc
    })

    return {
      ...activities,
      data: docsWithRefModel,
    }
  }

  async getReadDurationActivities(page = 1, size = 10) {
    const data = await this.activityRepository.list(
      page,
      size,
      Activity.ReadDuration,
    )

    const articleIds: string[] = []
    for (const item of data.data) {
      const payload = toObjectPayload(item.payload) as
        | ActivityPayloadWithRef
        | undefined
      if (!payload || typeof payload.roomName !== 'string') continue
      const refId = extractArticleIdFromRoomName(payload.roomName)
      articleIds.push(refId)
      ;(item as ActivityWithRef).refId = refId
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
      const readers = await this.readerService.findReaderInIds([readerId])
      reader = readers[0] ?? null
    }

    const mapping = {
      post: ArticleTypeEnum.Post,
      note: ArticleTypeEnum.Note,
    }

    // TODO switch to a reader-level dimension
    const res = await this.countingService.updateLikeCountWithIp(
      mapping[type],
      id,
      ip,
    )
    if (!res) {
      throw createAppException(AppErrorCode.ALREADY_SUPPORTED)
    }

    const globalResult = await this.databaseService.findGlobalById(id)
    const refModel = globalResult?.document
    this.eventService.emit(
      BusinessEvents.ACTIVITY_LIKE,
      {
        id,
        type,
        reader,
        ref: pick(refModel, [
          'id',
          'title',
          'nid',
          'slug',
          'category',
          'categoryId',
          'createdAt',
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
      throw createAppException(AppErrorCode.INVALID_ROOM_NAME)
    }

    data.identity = data.identity.toLowerCase()

    const roomSockets = await this.webGateway.getSocketsOfRoom(roomName)

    const socket = roomSockets.find((socket) => socket.id === data.sid)
    if (!socket) {
      this.logger.debug(
        `socket not found, room_name: ${roomName} identity: ${data.identity}`,
      )
      return
    }

    // Prefer the readerId resolved server-side from the HTTP session cookie
    // (RolesGuard runs globally and fills request.readerId before this
    // service runs). Fall back to the socket-handshake binding, and finally
    // the client-provided value, both of which are less authoritative.
    const socketMeta = await this.gatewayService.getSocketMetadata(socket)
    const resolvedReaderId =
      RequestContext.currentReaderId() || socketMeta?.readerId || data.readerId

    const presenceData: ActivityPresence = {
      ...data,

      operationTime: data.ts,
      updatedAt: Date.now(),
      connectedAt: +new Date(socket.handshake.time),
      readerId: resolvedReaderId,
      ip,
    }

    delete (presenceData as any).ts
    const serializedPresenceData = omit(presenceData, 'ip') as any
    if (resolvedReaderId) {
      const reader = await this.readerService.findReaderInIds([
        resolvedReaderId,
      ])
      if (reader.length) {
        Object.assign(serializedPresenceData, {
          reader: camelcaseKeys({
            ...reader[0],
            id: reader[0].id.toString(),
          }),
        })
      }
    }

    const roomJoinedAtMap =
      await this.webGateway.getSocketRoomJoinedAtMap(socket)

    serializedPresenceData.joinedAt = roomJoinedAtMap[roomName]

    try {
      this.webGateway.broadcast(
        BusinessEvents.ACTIVITY_UPDATE_PRESENCE,
        serializedPresenceData,
        {
          rooms: [roomName],
        },
      )
    } catch (err) {
      this.logger.warn(
        `presence broadcast failed for room ${roomName}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

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
    const roomCount = Object.fromEntries(
      rooms.map((name) => [name, roomMap[name].length]),
    ) as Record<string, number>
    return { rooms, roomCount }
  }

  async getRefsFromRoomNames(roomNames: string[]) {
    const articleIds = roomNames
      .map((roomName) => parseRoomName(roomName))
      .filter((parsed) => parsed?.type === 'article')
      .map((parsed) => parsed!.refId)

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
      const payload = toObjectPayload(item.payload) as
        | ActivityPayloadWithRef
        | undefined
      if (!payload || typeof payload.roomName !== 'string') continue
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
      docs.map((doc) => doc.refId).filter(Boolean),
    )
    const refMap = this.databaseService.flatCollectionToMap(refs)
    await this.commentService.fillAndReplaceAvatarUrl(docs)
    return docs
      .filter((doc) => doc.refId)
      .map((doc) => {
        const ref = refMap[String(doc.refId)]
        return {
          ...pick(doc, 'createdAt', 'author', 'text', 'avatar'),
          ...pick(ref, 'title', 'nid', 'slug', 'id', 'category'),
          type: checkRefModelCollectionType(ref),
        }
      })
  }

  async getRecentPublish() {
    const [post, note] = await Promise.all([
      this.postService.findRecent(3),
      this.noteService.findRecent(3, { visibleOnly: true }),
    ])

    return {
      recent: [],
      post,
      note,
    }
  }

  /**
   * Fetch article publications from the past year.
   */
  async getLastYearPublication() {
    const $gte = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    const [allPosts, allNotes] = await Promise.all([
      this.postService.findRecent(50),
      this.noteService.findRecent(50),
    ])
    const posts = allPosts.filter((row) => row.createdAt >= $gte)
    const notes = allNotes
      .filter((row) => row.createdAt >= $gte)
      .map((note) => {
        if (note.hasPassword || !note.isPublished) {
          note.title = 'Private note'
        }
        return omit(note, 'isPublished')
      })
    return { posts, notes }
  }
}
