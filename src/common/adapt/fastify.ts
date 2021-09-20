import { FastifyAdapter } from '@nestjs/platform-fastify'
import FastifyMultipart from 'fastify-multipart'
import secureSession from 'fastify-secure-session'
import { SECURITY } from '~/app.config'

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

app.register(secureSession, {
  secret: SECURITY.secret.slice(10).repeat(4),
  salt: SECURITY.salt,
  cookie: {
    path: '/',
    httpOnly: true,
  },
})
