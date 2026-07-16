import fastifyCookie from '@fastify/cookie'
import FastifyMultipart from '@fastify/multipart'
import { Logger } from '@nestjs/common'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import type { FastifyRequest } from 'fastify'

import {
  FASTIFY_ROUTE_OPTIONS_CONFIG,
  type FastifyRouteOptions,
} from '~/common/decorators/fastify-route-options.decorator'
import { getIp } from '~/utils/ip.util'

const logger = new Logger('Fastify')

function logWarn(desc: string, req: FastifyRequest, _context: string) {
  const ua = req.raw.headers['user-agent']
  logger.warn(
    // prettier-ignore
    `${desc}\n` +
      `Path: ${req.url}\n` +
      `IP: ${getIp(req)}\n` +
      `UA: ${ua}`,
  )
}

// Trust model: the deployment sits behind exactly one reverse proxy hop
// (Dokploy / Cloudflare). `trustProxy: true` would trust the entire
// `X-Forwarded-For` chain and let a client spoof its IP by prepending a
// segment. We instead trust a fixed number of hops (default 1 — the immediate
// proxy) so Fastify's `request.ip` resolves to the proxy-attested client IP.
// Override with TRUST_PROXY (an integer hop count, or a comma-separated list
// of trusted proxy IPs/CIDRs) only if the deployment has more proxy layers.
const resolveTrustProxy = (): number | string[] => {
  const raw = process.env.TRUST_PROXY?.trim()
  if (!raw) return 1
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10)
  return raw.split(',').map((s) => s.trim())
}

const app: FastifyAdapter = new FastifyAdapter({
  trustProxy: resolveTrustProxy(),
  logger: false,
})
export { app as fastifyApp }

// Nest places RouteConfig metadata under Fastify's inert `config` object.
// Promote the small, explicitly supported subset that must run before Nest's
// controller pipeline, while keeping protocol-specific handlers in modules.
app.getInstance().addHook('onRoute', (route) => {
  const config = route.config as Record<PropertyKey, unknown> | undefined
  const options = config?.[FASTIFY_ROUTE_OPTIONS_CONFIG] as
    FastifyRouteOptions | undefined
  if (!options) return

  if (options.bodyLimit !== undefined) route.bodyLimit = options.bodyLimit
  if (options.errorHandler !== undefined) {
    route.errorHandler = options.errorHandler
  }
})

app.register(FastifyMultipart, {
  limits: {
    fieldNameSize: 100,
    files: 1,
    fileSize: 1024 * 1024 * 6,
  },
})

app.getInstance().addHook('onRequest', (request, reply, done) => {
  const origin = request.headers.origin
  if (!origin) {
    request.headers.origin = request.headers.host
  }

  const url = request.url
  const ua = request.raw.headers['user-agent']
  if (url.endsWith('.php')) {
    reply.raw.statusMessage =
      'Eh. PHP is not support on this machine. Yep, I also think PHP is bestest programming language. But for me it is beyond my reach.'
    logWarn('PHP is the best language in the world!!!!!', request, 'GodPHP')

    return reply.code(418).send()
  } else if (/\/(?:adminer|admin|wp-login|phpmyadmin|\.env)$/i.test(url)) {
    const isMxSpaceClient = ua?.match('mx-space')
    reply.raw.statusMessage = 'Hey, What the fuck are you doing!'
    reply.raw.statusCode = isMxSpaceClient ? 666 : 200
    logWarn(
      'Heads up — someone is probing for vulnerabilities. Let me see which little troublemaker this is.\n',
      request,
      'Security',
    )

    return reply.send('Check request header to find an egg.')
  }

  if (/favicon\.ico$/.test(url) || /manifest\.json$/.test(url)) {
    return reply.code(204).send()
  }

  done()
})

app.register(fastifyCookie, {
  secret: 'cookie-secret',
})
