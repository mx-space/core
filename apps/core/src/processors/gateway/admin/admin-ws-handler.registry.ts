import { Injectable } from '@nestjs/common'

import {
  type WsHandler,
  type WsHandlerContext,
  WsHandlerRegistry,
} from '../ws/ws-handler.registry'

export type AdminWsContext = WsHandlerContext

export type AdminWsHandler = WsHandler<AdminWsContext>

@Injectable()
export class AdminWsHandlerRegistry extends WsHandlerRegistry<AdminWsContext> {}
