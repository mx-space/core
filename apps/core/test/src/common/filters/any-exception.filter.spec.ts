import type { ArgumentsHost } from '@nestjs/common'
import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AllExceptionsFilter } from '~/common/filters/any-exception.filter'
import type { ConfigsService } from '~/modules/configs/configs.service'
import type { BarkPushService } from '~/processors/helper/helper.bark.service'
import type { EventManagerService } from '~/processors/helper/helper.event.service'

function createFilter() {
  const eventManager = { broadcast: vi.fn() }
  const barkService = { throttlePush: vi.fn() }
  const configService = { get: vi.fn() }
  const filter = new AllExceptionsFilter(
    eventManager as unknown as EventManagerService,
    barkService as unknown as BarkPushService,
    configService as unknown as ConfigsService,
  )
  return { filter, eventManager, barkService, configService }
}

function createHost() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  }
  const request = {
    method: 'GET',
    url: '/api/v2/auth/get-session',
    raw: { url: '/api/v2/auth/get-session' },
    headers: {},
  }
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost
  return { host, reply }
}

describe('AllExceptionsFilter status normalization', () => {
  let filter: AllExceptionsFilter

  beforeEach(() => {
    filter = createFilter().filter
  })

  it('coerces a non-numeric status (better-auth APIError) to a numeric code', async () => {
    const { host, reply } = createHost()

    await filter.catch(
      { status: 'INTERNAL_SERVER_ERROR', statusCode: 500, message: 'boom' },
      host,
    )

    expect(reply.status).toHaveBeenCalledWith(500)
    expect(typeof reply.status.mock.calls[0][0]).toBe('number')
  })

  it('prefers the numeric statusCode when status is a string', async () => {
    const { host, reply } = createHost()

    await filter.catch({ status: 'BAD_REQUEST', statusCode: 400 }, host)

    expect(reply.status).toHaveBeenCalledWith(400)
  })

  it('preserves a numeric status', async () => {
    const { host, reply } = createHost()

    await filter.catch({ status: 404 }, host)

    expect(reply.status).toHaveBeenCalledWith(404)
  })

  it('defaults to 500 for an error carrying no status', async () => {
    const { host, reply } = createHost()

    await filter.catch(new Error('unexpected'), host)

    expect(reply.status).toHaveBeenCalledWith(500)
  })

  it('honors HttpException status', async () => {
    const { host, reply } = createHost()

    await filter.catch(new BadRequestException(), host)

    expect(reply.status).toHaveBeenCalledWith(400)
  })
})
