import type { FastifyReply } from 'fastify'
import { describe, expect, it, vi } from 'vitest'

import { DeviceController } from '~/modules/auth/device.controller'

const makeReply = () => {
  const reply = {
    status: vi.fn(),
    type: vi.fn(),
    send: vi.fn(),
    header: vi.fn(),
    redirect: vi.fn(),
  }
  reply.status.mockReturnValue(reply)
  reply.type.mockReturnValue(reply)
  reply.send.mockReturnValue(reply)
  reply.header.mockReturnValue(reply)
  reply.redirect.mockReturnValue(reply)
  return reply
}

const makeController = () => {
  const verifyOneTimeToken = vi.fn().mockResolvedValue({
    headers: {
      getSetCookie: () => ['better-auth.session_token=session; HttpOnly'],
    },
  })
  const configsService = {
    get: vi
      .fn()
      .mockResolvedValue({ adminUrl: 'https://mx.example.com/admin' }),
  }
  const controller = new DeviceController(
    {} as never,
    {} as never,
    configsService as never,
    { get: () => ({ api: { verifyOneTimeToken } }) } as never,
  )
  return { controller, verifyOneTimeToken }
}

describe('DeviceController web handoff', () => {
  it('consumes the one-time token, sets the shared session cookie, and redirects', async () => {
    const { controller, verifyOneTimeToken } = makeController()
    const reply = makeReply()

    await controller.webHandoff(
      'single-use-token',
      'comments',
      reply as unknown as FastifyReply,
    )

    expect(verifyOneTimeToken).toHaveBeenCalledWith({
      body: { token: 'single-use-token' },
      returnHeaders: true,
    })
    expect(reply.header).toHaveBeenCalledWith('set-cookie', [
      'better-auth.session_token=session; HttpOnly',
    ])
    expect(reply.header).toHaveBeenCalledWith('cache-control', 'no-store')
    expect(reply.redirect).toHaveBeenCalledWith(
      'https://mx.example.com/admin#/comments',
      302,
    )
  })

  it('rejects targets outside the fixed route map before consuming a token', async () => {
    const { controller, verifyOneTimeToken } = makeController()
    const reply = makeReply()

    await controller.webHandoff(
      'single-use-token',
      'https://attacker.example',
      reply as unknown as FastifyReply,
    )

    expect(reply.status).toHaveBeenCalledWith(400)
    expect(reply.send).toHaveBeenCalledWith('Invalid handoff')
    expect(verifyOneTimeToken).not.toHaveBeenCalled()
  })
})
