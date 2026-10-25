import { Injectable } from '@nestjs/common'

import {
  type WsHandler,
  type WsHandlerContext,
  WsHandlerRegistry,
} from '../ws/ws-handler.registry'

export interface WebWsContext extends WsHandlerContext {
  readerId: string | undefined
}

export type WebWsHandler = WsHandler<WebWsContext>

@Injectable()
export class WebWsHandlerRegistry extends WsHandlerRegistry<WebWsContext> {}
