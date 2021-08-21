import { FastifyAdapter } from '@nestjs/platform-fastify'

export const fastifyApp: FastifyAdapter = new FastifyAdapter({
  trustProxy: true,
})

fastifyApp.getInstance().addHook('onRequest', (request, reply, done) => {
  const origin = request.headers.origin
  if (!origin) {
    request.headers.origin = request.headers.host
  }

  done()
})
