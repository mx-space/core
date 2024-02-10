import { pick, uniqBy } from 'lodash'
import { Types } from 'mongoose'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { Collection } from 'mongodb'
import type {
  ActivityLikePayload,
  ActivityLikeSupportType,
  ActivityPresence,
} from './activity.interface'
import type { UpdatePresenceDto } from './dtos/presence.dto'

import { BadRequestException, Injectable, Logger } from '@nestjs/common'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { GatewayService } from '~/processors/gateway/gateway.service'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'

import { Activity } from './activity.constant'
import { ActivityModel } from './activity.model'
import { isValidRoomName } from './activity.util'

declare module '~/utils/socket.util' {
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
    private readonly databaseService: DatabaseService,

    private readonly webGateway: WebEventsGateway,
    private readonly gatewayService: GatewayService,
  ) {
    this.logger = new Logger(ActivityService.name)
  }

  private cleanupFnList: Array<() => any | null> = []

  onModuleDestroy() {
    this.cleanupFnList.forEach((fn) => fn())
  }

  onModuleInit() {
    const q = [
      this.webGateway.registerHook('onDisconnected', async (socket) => {
        const presence = (await this.gatewayService.getSocketMetadata(socket))
          ?.presence

        if (presence) {
          this.activityModel.create({
            type: Activity.ReadDuration,
            payload: presence,
          })
        }
      }),
      this.webGateway.registerHook('onLeaveRoom', async (socket, roomName) => {
        const socketMeta = await this.gatewayService.getSocketMetadata(socket)
        if (socketMeta.presence)
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

        switch (type) {
          case 'Note': {
            acc.Note.push(id)
            break
          }
          case 'Post': {
            acc.Post.push(id)

            break
          }
        }
        return acc
      },
      {
        Post: [],
        Note: [],
      } as Record<ActivityLikeSupportType, string[]>,
    )

    const type2Collection: Record<
      ActivityLikeSupportType,
      Collection<Document>
    > = {
      Note: this.databaseService.db.collection('notes'),
      Post: this.databaseService.db.collection('posts'),
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
      Reflect.set(nextAc, 'ref', refModelData.get(ac.payload.id))

      return nextAc
    })

    // @ts-ignore
    transformedPager.data = docsWithRefModel
    return transformedPager
  }

  async likeAndEmit(type: ActivityLikeSupportType, id: string, ip: string) {
    try {
      const res = await this.countingService.updateLikeCountWithIp(type, id, ip)
      if (!res) {
        throw new BadRequestException('你已经支持过啦！')
      }
    } catch (e: any) {
      throw new BadRequestException(e)
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

  async updatePresence(data: UpdatePresenceDto) {
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
    }
    Reflect.deleteProperty(presenceData, 'ts')
    this.webGateway.broadcast(
      BusinessEvents.ACTIVITY_UPDATE_PRESENCE,
      presenceData,
      {
        rooms: [roomName],
      },
    )

    await this.gatewayService.setSocketMetadata(socket, {
      presence: presenceData,
    })

    return presenceData
  }

  async getRoomPresence(roomName: string): Promise<ActivityPresence[]> {
    const roomSocket = await this.webGateway.getSocketsOfRoom(roomName)
    const socketMeta = await Promise.all(
      roomSocket.map((socket) => this.gatewayService.getSocketMetadata(socket)),
    )

    console.log(socketMeta)

    return uniqBy(
      socketMeta
        .filter((x) => x?.presence)
        .map((x) => x.presence)
        .sort((a, b) => {
          if (a && b) return a.updatedAt - b.updatedAt
          return 1
        }) as ActivityPresence[],
      (x) => x.identity,
    )
  }
}
