import type { WsAckPayload } from './protocol.js'

export interface WsRequestError extends Error {
  code?: string
  ack?: WsAckPayload
}

export function createWsError(
  message: string,
  code: string,
  ack?: WsAckPayload,
): WsRequestError {
  const error = new Error(message) as WsRequestError
  error.code = code
  if (ack) error.ack = ack
  return error
}
