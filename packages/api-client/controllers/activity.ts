import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type { AuthUser } from '~/models'
import type {
  ActivityPresence,
  LastYearPublication,
  RecentActivities,
  RoomsData,
} from '~/models/activity'
import { autoBind } from '~/utils/auto-bind'
import { camelcaseKeys } from '~/utils/camelcase-keys'

import type { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    activity: ActivityController<ResponseWrapper>
  }
}

/**
 * @support core >= 4.3.0
 */
export class ActivityController<ResponseWrapper> implements IController {
  base = 'activity'
  name = 'activity'

  constructor(private client: HTTPClient) {
    autoBind(this)
  }

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  likeIt(type: 'Post' | 'Note', id: string) {
    return this.proxy.like.post<never>({
      data: {
        type: type.toLowerCase(),
        id,
      },
    })
  }

  /**
   *
   * @support core >= 5.0.0
   */
  getPresence(roomName: string) {
    return this.proxy.presence.get<{
      data: Record<string, ActivityPresence>
      readers: Record<string, AuthUser>
    }>({
      params: {
        room_name: roomName,
      },
      transformResponse: (data) => {
        const payload = data as {
          data?: Record<string, unknown>
          readers?: Record<string, unknown>
        }

        return {
          ...camelcaseKeys(
            Object.fromEntries(
              Object.entries(payload).filter(
                ([key]) => key !== 'data' && key !== 'readers',
              ),
            ),
          ),
          data: Object.fromEntries(
            Object.entries(payload.data ?? {}).map(([identity, value]) => [
              identity,
              camelcaseKeys<ActivityPresence>(value),
            ]),
          ),
          readers: Object.fromEntries(
            Object.entries(payload.readers ?? {}).map(([id, value]) => [
              id,
              camelcaseKeys<AuthUser>(value),
            ]),
          ),
        }
      },
    })
  }

  /**
   *
   * @support core >= 5.0.0
   */
  updatePresence({
    identity,
    position,
    roomName,
    sid,
    ts,
    displayName,
    readerId,
  }: {
    roomName: string
    position: number
    identity: string
    sid: string

    displayName?: string
    ts?: number
    readerId?: string
  }) {
    return this.proxy.presence.update.post({
      data: {
        identity,
        position,
        ts: ts || Date.now(),
        roomName,
        sid,
        readerId,
        displayName,
      },
    })
  }

  async getRoomsInfo() {
    return this.proxy.rooms.get<RoomsData>()
  }

  async getRecentActivities() {
    return this.proxy.recent.get<RecentActivities>()
  }

  async getLastYearPublication(): Promise<LastYearPublication> {
    return this.proxy(`last-year`).publication.get<LastYearPublication>()
  }
}
