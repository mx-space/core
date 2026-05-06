import type { IncomingMessage, ServerResponse } from 'node:http'

export async function trackResponseTimeMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void> | void,
) {
  const requestTimeFromHeader = Number(req.headers['x-request-time'])
  const t2 = Number.isNaN(requestTimeFromHeader)
    ? Date.now()
    : requestTimeFromHeader

  res.setHeader('Content-Type', 'application/json')
  res.setHeader(
    'Access-Control-Allow-Origin',
    req.headers.origin || req.headers.referer || req.headers.host || '*',
  )
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Max-Age', '86400')
  await next()

  res.write(JSON.stringify({ t2, t3: Date.now() }))
  res.end()
}
