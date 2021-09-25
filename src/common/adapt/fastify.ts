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
  const origin = request.headers.origin
  if (!origin) {
    request.headers.origin = request.headers.host
  }

  done()
})

app.register(fastifyCookie, {
  secret: 'cookie-secret', // 这个 secret 不太重要, 不存鉴权相关, 无关紧要
})
