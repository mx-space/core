import { FastifyAdapter } from '@nestjs/platform-fastify'
import FastifyMultipart from 'fastify-multipart'
export const fastifyApp: FastifyAdapter = new FastifyAdapter({
  trustProxy: true,
})

fastifyApp.register(FastifyMultipart, {
  limits: {
    fields: 10, // Max number of non-file fields
    fileSize: 1024 * 1024 * 6, // limit size 6M
    files: 5, // Max number of file fields
  },
})

fastifyApp.getInstance().addHook('onRequest', (request, reply, done) => {
  const origin = request.headers.origin
  if (!origin) {
    request.headers.origin = request.headers.host
  }

  done()
})
