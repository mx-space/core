import type { FastifyCorsOptions } from '@fastify/cors'

export const allowAllCors: FastifyCorsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  origin: (origin, callback) => callback(null, origin || false),
}
