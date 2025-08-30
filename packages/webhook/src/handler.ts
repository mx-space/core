import assert from 'node:assert'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { InvalidSignatureError } from './error'
import type { BusinessEvents } from './event.enum'
import type { ExtendedEventEmitter, GenericEvent } from './types'

interface CreateHandlerOptions {
  secret: string
  // events?: 'all' | BusinessEvents[]
}
export type RequestWithJSONBody = IncomingMessage & Request & { body: object }
type Handler = {
  (req: RequestWithJSONBody, res: ServerResponse): void
} & {
  emitter: ExtendedEventEmitter
}

export const createHandler = (options: CreateHandlerOptions): Handler => {
  const { secret } = options

  const handler: Handler = async function (req, res) {
    try {
      const data = await readDataFromRequest({ req, secret })

      const { type: event, payload } = data

      handler.emitter.emit(event as any, payload)
      handler.emitter.emit('*', {
        type: event,
        payload,
      })
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: 1 }))
    } catch (error) {
      if (error instanceof InvalidSignatureError) {
        handler.emitter.emit('error', new Error('invalidate signature'))

        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: 0, message: 'Invalid Signature' }))
        return
      }
      res.statusCode = 500
      res.end(JSON.stringify({ ok: 0, message: error.message }))
    }
  }

  handler.emitter = new EventEmitter()
  return handler
}

export const readDataFromRequest = async ({
  req,
  secret,
}: {
  secret: string
  req: RequestWithJSONBody
}) => {
  const signature = req.headers['x-webhook-signature']
  assert(typeof signature === 'string', 'X-Webhook-Signature must be string')
  const event = req.headers['x-webhook-event']
  const signature256 = req.headers['x-webhook-signature256']
  assert(
    typeof signature256 === 'string',
    'X-Webhook-Signature256 must be string',
  )

  const obj = req.body
  const stringifyPayload = JSON.stringify(obj)
  const isValid =
    verifyWebhook(secret, stringifyPayload, signature256 as string) &&
    verifyWebhookSha1(secret, stringifyPayload, signature as string)

  if (isValid) {
    return {
      type: event as BusinessEvents,
      payload: obj as any,
    } as GenericEvent
  } else {
    console.error('revice a invalidate webhook payload', req.headers)
    throw new InvalidSignatureError()
  }
}

export function verifyWebhook(
  secret: string,
  payload: string,
  receivedSignature: string,
): boolean {
  const hmac = createHmac('sha256', secret)
  hmac.update(payload)

  // 安全地比较两个签名，以防止时间攻击
  return timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(hmac.digest('hex')),
  )
}

export function verifyWebhookSha1(
  secret: string,
  payload: string,
  receivedSignature: string,
): boolean {
  const hmac = createHmac('sha1', secret)
  hmac.update(payload)

  // 安全地比较两个签名，以防止时间攻击
  return timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(hmac.digest('hex')),
  )
}
