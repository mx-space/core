import type { ArgumentsHost } from '@nestjs/common'
import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'

import { AppException } from '~/common/errors/exception.types'
import { AppExceptionFilter } from '~/common/filters/app-exception.filter'

interface FakeReply {
  statusCode?: number
  contentType?: string
  body?: any
  status: (code: number) => FakeReply
  type: (value: string) => FakeReply
  send: (body: any) => FakeReply
}

const createReply = (): FakeReply => {
  const reply: FakeReply = {
    status(code) {
      reply.statusCode = code
      return reply
    },
    type(value) {
      reply.contentType = value
      return reply
    },
    send(body) {
      reply.body = body
      return reply
    },
  }
  return reply
}

const createHost = (
  reply: FakeReply,
  request: Record<string, unknown> = {},
): ArgumentsHost =>
  ({
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => request,
    }),
  }) as unknown as ArgumentsHost

describe('AppExceptionFilter', () => {
  const filter = new AppExceptionFilter()

  test('maps an AppException to a coded error envelope with its status', () => {
    const reply = createReply()
    filter.catch(
      new AppException('POST_NOT_FOUND', 'Post not found', 404, { id: '7' }),
      createHost(reply),
    )

    expect(reply.statusCode).toBe(404)
    expect(reply.body).toEqual({
      error: {
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        details: { id: '7' },
      },
    })
  })

  test('omits details when the AppException has none', () => {
    const reply = createReply()
    filter.catch(
      new AppException('AUTH_SESSION_EXPIRED', 'Session expired', 401),
      createHost(reply),
    )

    expect(reply.statusCode).toBe(401)
    expect(reply.body.error.details).toBeUndefined()
  })

  test('maps a ZodError to a 400 VALIDATION_FAILED envelope carrying issues', () => {
    const reply = createReply()
    const zodError = z.string().safeParse(123).error!
    filter.catch(zodError, createHost(reply))

    expect(reply.statusCode).toBe(400)
    expect(reply.body.error.code).toBe('VALIDATION_FAILED')
    expect(Array.isArray(reply.body.error.details.issues)).toBe(true)
  })

  test('maps a generic HttpException to an HTTP_ERROR envelope with its status', () => {
    const reply = createReply()
    filter.catch(new BadRequestException('bad input'), createHost(reply))

    expect(reply.statusCode).toBe(400)
    expect(reply.body.error.code).toBe('HTTP_ERROR')
    expect(reply.body.error.message).toBe('bad input')
  })

  test('does not infer a feature protocol from the request path', () => {
    const reply = createReply()
    filter.catch(
      new BadRequestException('bad input'),
      createHost(reply, {
        method: 'PUT',
        url: '/companion/presence',
        raw: { url: '/companion/presence' },
      }),
    )

    expect(reply.statusCode).toBe(400)
    expect(reply.body).toEqual({
      error: { code: 'HTTP_ERROR', message: 'bad input' },
    })
  })

  test('maps an unknown error to a 500 INTERNAL_ERROR envelope', () => {
    const reply = createReply()
    filter.catch(new Error('boom'), createHost(reply))

    expect(reply.statusCode).toBe(500)
    expect(reply.body.error.code).toBe('INTERNAL_ERROR')
  })

  test('sends every error envelope as application/json', () => {
    const reply = createReply()
    filter.catch(new Error('boom'), createHost(reply))

    expect(reply.contentType).toBe('application/json')
  })
})
