import { Controller, Get, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { afterEach, describe, expect, it } from 'vitest'

import { allowAllCors } from '~/utils/cors.util'

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return 'pong'
  }
}

@Module({ controllers: [PingController] })
class PingModule {}

describe('allowAllCors', () => {
  let app: NestFastifyApplication | undefined

  const boot = async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      PingModule,
      new FastifyAdapter(),
      { logger: false },
    )
    app.enableCors(allowAllCors)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    return app.getHttpAdapter().getInstance()
  }

  afterEach(async () => {
    await app?.close()
    app = undefined
  })

  it('serves a request that carries no Origin header', async () => {
    const server = await boot()

    const response = await server.inject({ method: 'GET', url: '/ping' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('echoes the Origin of a cross-site request', async () => {
    const server = await boot()

    const response = await server.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'http://localhost:9528' },
    })

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:9528',
    )
  })
})
