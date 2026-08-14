import {
  ACK_EVENT,
  buildEnvelope,
  type WsAckPayload,
  type WsEnvelope,
} from '@mx-space/ws-client/protocol'
import { z } from 'zod'

export const wsIncomingEnvelopeSchema = z
  .object({
    v: z.literal(1),
    event: z.string().min(1).max(128),
    payload: z.unknown().optional(),
    id: z.string().min(1).max(64).optional(),
  })
  .passthrough()

export function buildAck(id: string, payload: WsAckPayload): WsEnvelope {
  return buildEnvelope(ACK_EVENT, payload, id)
}

export function serializeEnvelope(envelope: WsEnvelope): string {
  return JSON.stringify(envelope)
}
