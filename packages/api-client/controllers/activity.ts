import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type { ActivityPresence } from '~/models/activity'
import type { HTTPClient } from '../core'

import { autoBind } from '~/utils/auto-bind'

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
        type,
        id,
      },
    })
  }

  /**
   *
   * @support core >= 5.0.0
   */
  getPresence(roomName: string) {
    return this.proxy.presence.get<Record<string, ActivityPresence>>({
      params: {
        room_name: roomName,
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

    displayName,
  }: {
    roomName: string
    position: number
    identity: string
    sid: string

    displayName?: string
  }) {
    return this.proxy.presence.update.post({
      data: {
        identity,
        position,
        ts: Date.now(),
        roomName,
        sid,

        displayName,
      },
    })
  }
}
