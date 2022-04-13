import type { FastifyRequest } from 'fastify'
import fastifyCookie from 'fastify-cookie'
import FastifyMultipart from 'fastify-multipart'

import { Logger } from '@nestjs/common'
import { FastifyAdapter } from '@nestjs/platform-fastify'

import { getIp } from '~/utils'

const app: FastifyAdapter = new FastifyAdapter({
  trustProxy: true,
})
export { app as fastifyApp }

app.register(FastifyMultipart, {
  limits: {
    fields: 10, // Max number of non-file fields
    fileSize: 1024 * 1024 * 6, // limit size 6M
    files: 5, // Max number of file fields
  },
})

app.getInstance().addHook('onRequest', (request, reply, done) => {
  // set undefined origin
  const origin = request.headers.origin
  if (!origin) {
    request.headers.origin = request.headers.host
  }

  // forbidden php

  const url = request.url
  const ua = request.raw.headers['user-agent']
  if (url.endsWith('.php')) {
    reply.raw.statusMessage =
      'Eh. PHP is not support on this machine. Yep, I also think PHP is bestest programming language. But for me it is beyond my reach.'
    logWarn('PHP 是世界上最好的语言！！！！！', request, 'GodPHP')

    return reply.code(418).send()
  } else if (url.match(/\/(adminer|admin|wp-login|phpMyAdmin|\.env)$/gi)) {
    const isMxSpaceClient = ua?.match('mx-space')
    reply.raw.statusMessage = 'Hey, What the fuck are you doing!'
    reply.raw.statusCode = isMxSpaceClient ? 666 : 200
    logWarn(
      '注意了，有人正在搞渗透，让我看看是谁，是哪个小坏蛋这么不听话。\n',
      request,
      'Security',
    )

    return reply.send('Check request header to find an egg.')
  }

  // skip favicon request
  if (url.match(/favicon\.ico$/) || url.match(/manifest\.json$/)) {
    return reply.code(204).send()
  }

  done()
})

app.register(fastifyCookie, {
  secret: 'cookie-secret', // 这个 secret 不太重要, 不存鉴权相关, 无关紧要
})

const logWarn = (desc: string, req: FastifyRequest, context: string) => {
  const ua = req.raw.headers['user-agent']
  Logger.warn(
    // prettier-ignore
    `${desc}\n` +
      `Path: ${req.url}\n` +
      `IP: ${getIp(req)}\n` +
      `UA: ${ua}`,
    'GodPHP',
  )
}
