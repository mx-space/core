import type { WsAckPayload } from '@mx-space/ws-client/protocol'
import { Injectable, Logger } from '@nestjs/common'

export interface AdminWsContext {
  connectionId: string
  join: (room: string) => Promise<void>
  leave: (room: string) => Promise<void>
  send: (event: string, payload: unknown) => void
}

export type AdminWsHandler = (
  context: AdminWsContext,
  payload: unknown,
) => WsAckPayload | Promise<WsAckPayload>

@Injectable()
export class AdminWsHandlerRegistry {
  private readonly logger = new Logger(AdminWsHandlerRegistry.name)
  private readonly handlers = new Map<string, AdminWsHandler>()
  private readonly disconnectListeners = new Set<
    (connectionId: string) => void
  >()

  register(event: string, handler: AdminWsHandler) {
    this.handlers.set(event, handler)
    return () => {
      if (this.handlers.get(event) === handler) this.handlers.delete(event)
    }
  }

  onDisconnect(listener: (connectionId: string) => void) {
    this.disconnectListeners.add(listener)
    return () => {
      this.disconnectListeners.delete(listener)
    }
  }

  async dispatch(
    event: string,
    context: AdminWsContext,
    payload: unknown,
  ): Promise<WsAckPayload> {
    const handler = this.handlers.get(event)
    if (!handler) return { ok: false, code: 'UNSUPPORTED_EVENT' }
    try {
      return await handler(context, payload)
    } catch (error) {
      this.logger.warn(`${event} handler failed: ${(error as Error).message}`)
      return { ok: false, code: 'INTERNAL_ERROR' }
    }
  }

  notifyDisconnect(connectionId: string) {
    for (const listener of this.disconnectListeners) listener(connectionId)
  }
}
