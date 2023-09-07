import type { IncomingMessage, ServerResponse } from 'http'

export async function trackResponseTimeMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: Function,
) {
  const now = req.headers['x-request-time'] || new Date().getTime()

  await next()
  res.setHeader('Content-Type', 'application/json')
  res.write(
    JSON.stringify({
      t2: now,
      t3: new Date().getTime(),
    }),
  )

  res.end()
}
