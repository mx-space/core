import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const PUSH_SIGNATURE_HEADERS = {
  source: 'x-push-source',
  delivery: 'x-push-delivery',
  timestamp: 'x-push-timestamp',
  signature: 'x-push-signature',
} as const

export const sha256Hex = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex')

export const canonicalPushSignatureInput = (
  timestamp: string,
  deliveryId: string,
  rawBody: string | Buffer,
) => `v1\n${timestamp}\n${deliveryId}\n${sha256Hex(rawBody)}`

export const signPushRequest = (input: {
  secret: string
  timestamp: string
  deliveryId: string
  rawBody: string | Buffer
}) => {
  const canonical = canonicalPushSignatureInput(
    input.timestamp,
    input.deliveryId,
    input.rawBody,
  )
  return `v1=${createHmac('sha256', input.secret).update(canonical).digest('hex')}`
}

export const verifyPushRequestSignature = (input: {
  secret: string
  timestamp: string
  deliveryId: string
  rawBody: string | Buffer
  signature: string
}) => {
  const expected = signPushRequest(input)
  const actualBytes = Buffer.from(input.signature)
  const expectedBytes = Buffer.from(expected)
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}

export const isPushTimestampFresh = (
  value: string,
  now = Date.now(),
  maximumSkewMs = 5 * 60 * 1000,
) => {
  if (!/^\d{10,16}$/.test(value)) return false
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) return false
  return Math.abs(now - parsed) <= maximumSkewMs
}
