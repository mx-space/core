import type { INestApplicationContext } from '@nestjs/common'
import { WsAdapter } from '@nestjs/platform-ws'

import { wsIncomingEnvelopeSchema } from './ws-envelope'

export function createWsAdapter(app: INestApplicationContext): WsAdapter {
  return new WsAdapter(app, {
    messageParser: (raw) => {
      const msg = wsIncomingEnvelopeSchema.parse(
        JSON.parse(raw.toString()) as unknown,
      )
      return { event: msg.event, data: msg }
    },
  })
}
