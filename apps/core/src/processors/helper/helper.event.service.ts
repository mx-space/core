import { merge } from 'lodash'
import type { BusinessEvents } from '~/constants/business-event.constant'
import type { EventBusEvents } from '~/constants/event-bus.constant'

import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

import { EventScope } from '~/constants/business-event.constant'
import { scheduleManager } from '~/utils'

import { AdminEventsGateway } from '../gateway/admin/events.gateway'
import { BroadcastBaseGateway } from '../gateway/base.gateway'
import { SystemEventsGateway } from '../gateway/system/events.gateway'
import { WebEventsGateway } from '../gateway/web/events.gateway'

export type EventManagerOptions = {
  scope?: EventScope

  nextTick?: boolean
}

type EventHandler = {
  event: string
  payload: any
  scope: EventScope
}

export type IEventManagerHandlerDisposer = () => void

@Injectable()
export class EventManagerService {
  private readonly logger: Logger
  private readonly defaultOptions: Required<EventManagerOptions> = {
    scope: EventScope.TO_SYSTEM,
    nextTick: false,
  }

  constructor(
    private readonly webGateway: WebEventsGateway,

    private readonly adminGateway: AdminEventsGateway,
    private readonly systemGateway: SystemEventsGateway,

    private readonly emitter2: EventEmitter2,
  ) {
    this.logger = new Logger(EventManagerService.name)

    this.listenSystemEvents()
  }

  private mapScopeToInstance: Record<
    EventScope,
    (
      | WebEventsGateway
      | AdminEventsGateway
      | EventEmitter2
      | SystemEventsGateway
    )[]
  > = {
    [EventScope.ALL]: [
      this.webGateway,
      this.adminGateway,
      this.emitter2,
      this.systemGateway,
    ],
    [EventScope.TO_VISITOR]: [this.webGateway, this.emitter2],
    [EventScope.TO_ADMIN]: [this.adminGateway, this.emitter2],
    [EventScope.TO_SYSTEM]: [this.emitter2, this.systemGateway],
    [EventScope.TO_VISITOR_ADMIN]: [
      this.webGateway,
      this.adminGateway,
      this.emitter2,
    ],

    [EventScope.TO_SYSTEM_VISITOR]: [
      this.emitter2,
      this.webGateway,
      this.systemGateway,
    ],
    [EventScope.TO_SYSTEM_ADMIN]: [
      this.emitter2,
      this.adminGateway,
      this.systemGateway,
    ],
  }

  #key = 'event-manager'

  emit(
    event: BusinessEvents,
    data?: any,
    options?: EventManagerOptions,
  ): Promise<void>
  emit(
    event: EventBusEvents,
    data?: any,
    options?: EventManagerOptions,
  ): Promise<void>
  async emit(event: string, data: any = null, _options?: EventManagerOptions) {
    const options = merge(
      {},
      this.defaultOptions,
      _options,
    ) as EventManagerOptions
    const {
      scope = this.defaultOptions.scope,
      nextTick = this.defaultOptions.nextTick,
    } = options

    const instances = this.mapScopeToInstance[scope]

    const tasks = Promise.all(
      instances.map((instance) => {
        if (instance instanceof EventEmitter2) {
          const isObjectLike = typeof data === 'object' && data !== null
          const payload = isObjectLike ? data : { data }

          return instance.emit(this.#key, {
            event,
            payload,
            scope,
          })
        } else if (instance instanceof BroadcastBaseGateway) {
          return instance.broadcast(event as any, data)
        }
      }),
    )

    if (nextTick) {
      scheduleManager.schedule(async () => await tasks)
    } else {
      await tasks
    }
  }

  // TODO 补充类型
  on(
    event: BusinessEvents,
    handler: (data: any) => void,
    options?: Pick<EventManagerOptions, 'scope'>,
  ): IEventManagerHandlerDisposer
  on(
    event: EventBusEvents,
    handler: (data: any) => void,
    options?: Pick<EventManagerOptions, 'scope'>,
  ): IEventManagerHandlerDisposer

  on(
    event: string,
    handler: (data: any) => void,
  ): IEventManagerHandlerDisposer {
    const handler_ = (payload) => {
      if (payload.event === event) {
        handler(payload.payload)
      }
    }
    const cleaner = this.emitter2.on(this.#key, handler_)

    return () => {
      cleaner.off(this.#key, handler_)
    }
  }

  #handlers: ((type: string, data: any, scope: EventScope) => void)[] = []

  registerHandler(
    handler: (type: EventBusEvents, data: any, scope: EventScope) => void,
  ): IEventManagerHandlerDisposer
  registerHandler(
    handler: (type: BusinessEvents, data: any, scope: EventScope) => void,
  ): IEventManagerHandlerDisposer
  registerHandler(handler: Function) {
    this.#handlers.push(handler as any)
    return () => {
      const index = this.#handlers.findIndex((h) => h === handler)
      this.#handlers.splice(index, 1)
    }
  }

  private listenSystemEvents() {
    this.emitter2.on(this.#key, (data) => {
      const { event, payload, scope } = data
      console.debug(`[${scope}]: Received event: [${event}]`, payload)

      // emit current event directly
      this.emitter2.emit(event, payload)

      this.#handlers.forEach((handler) => handler(event, payload, scope))
    })
  }

  get broadcast() {
    return this.emit
  }
}
