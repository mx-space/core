import { FastifyAdapter } from '@nestjs/platform-fastify'
import fastifyCookie from 'fastify-cookie'
import FastifyMultipart from 'fastify-multipart'

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

  if (url.endsWith('.php')) {
    reply.raw.statusMessage =
      'Eh. PHP is not support on this machine. Yep, I also think PHP is bestest programming language. But for me it is beyond my reach.'

    return reply.code(418).send()
  } else if (url.match(/\/(adminer|admin|wp-login)$/g)) {
    reply.raw.statusMessage = 'Hey, What the fuck are you doing!'
    return reply.code(200).send()
  }

  // skip favicon request
  if (url.match(/favicon.ico$/) || url.match(/manifest.json$/)) {
    return reply.code(204).send()
  }

  done()
})

app.register(fastifyCookie, {
  secret: 'cookie-secret', // 这个 secret 不太重要, 不存鉴权相关, 无关紧要
})
