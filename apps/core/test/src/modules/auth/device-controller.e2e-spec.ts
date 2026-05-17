import { Module } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { vi } from 'vitest'

import { fastifyApp } from '~/common/adapters/fastify.adapter'
import { extendedZodValidationPipeInstance } from '~/common/zod'
import { AuthInstanceInjectKey } from '~/modules/auth/auth.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { DeviceController } from '~/modules/auth/device.controller'
import { ConfigsService } from '~/modules/configs/configs.service'
import { AssetService } from '~/processors/helper/helper.asset.service'

const ownerSession = {
  user: {
    id: 'owner-1',
    email: 'owner@example.com',
    name: 'Owner',
    role: 'owner',
  },
  session: { token: 'session-token' },
}

const deviceApprove = vi.fn(async () => ({ success: true }))
const deviceDeny = vi.fn(async () => ({ success: true }))
const deviceVerify = vi.fn(async () => ({ status: 'pending' }))

const DEVICE_TEMPLATE_STUB = `<!doctype html>
<html><head><title><%= siteTitle %> · Device authorization</title></head>
<body><h1><%= siteTitle %></h1><p>Device authorization</p>
<p>code: <%= userCode %></p>
<p>user: <%= user.email || user.name || user.id %></p>
<form action="<%= verifyUrl %>"></form></body></html>`

const assetService = {
  getAsset: vi.fn(async (path: string) =>
    path === '/render/device.ejs' ? DEVICE_TEMPLATE_STUB : null,
  ),
}

const configsService = {
  get: vi.fn(async (key: string) =>
    key === 'seo' ? { title: 'Test Site' } : {},
  ),
}

const authInstance = {
  get: () => ({ api: { deviceApprove, deviceDeny, deviceVerify } }),
  set: vi.fn(),
}

const authService = {
  getSessionUserFromHeaders: vi.fn(async () => null as unknown),
}

@Module({
  controllers: [DeviceController],
  providers: [
    { provide: AssetService, useValue: assetService },
    { provide: AuthService, useValue: authService },
    { provide: ConfigsService, useValue: configsService },
    { provide: AuthInstanceInjectKey, useValue: authInstance },
  ],
})
class DeviceControllerTestModule {}

describe('DeviceController (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DeviceControllerTestModule],
    }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(fastifyApp)
    app.useGlobalPipes(extendedZodValidationPipeInstance)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  beforeEach(() => {
    deviceApprove.mockClear()
    deviceDeny.mockClear()
    deviceVerify.mockClear()
    authService.getSessionUserFromHeaders.mockReset()
    authService.getSessionUserFromHeaders.mockResolvedValue(null)
  })

  afterAll(async () => {
    await app.close()
  })

  test('GET /device renders the verification page for an authenticated owner', async () => {
    authService.getSessionUserFromHeaders.mockResolvedValue(ownerSession)

    const res = await app.inject({
      method: 'GET',
      url: '/device?user_code=ABCD1234',
      headers: { cookie: 'session=abc' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('ABCD1234')
    expect(res.body).toContain('Device authorization')
    expect(res.body).toContain('Test Site')
    expect(deviceVerify).toHaveBeenCalledWith({
      query: { user_code: 'ABCD1234' },
      headers: expect.any(Headers),
    })
  })

  test('GET /device normalizes the user code before claiming it', async () => {
    authService.getSessionUserFromHeaders.mockResolvedValue(ownerSession)

    const res = await app.inject({
      method: 'GET',
      url: '/device?user_code=%20ABCD1234%20',
      headers: { cookie: 'session=abc' },
    })

    expect(res.statusCode).toBe(200)
    expect(deviceVerify).toHaveBeenCalledWith({
      query: { user_code: 'ABCD1234' },
      headers: expect.any(Headers),
    })
  })

  test('GET /device redirects unauthenticated requests to the admin login', async () => {
    authService.getSessionUserFromHeaders.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: '/device?user_code=XYZ123',
    })

    expect(res.statusCode).toBe(302)
    const location = res.headers.location as string
    expect(location).toContain('/proxy/qaqdmin')
    expect(location).toContain('redirect=')
    expect(decodeURIComponent(location)).toContain('/device')
    expect(decodeURIComponent(location)).toContain('user_code=XYZ123')
    expect(deviceVerify).not.toHaveBeenCalled()
  })

  test('GET /device redirects when the session is a non-owner reader', async () => {
    authService.getSessionUserFromHeaders.mockResolvedValue({
      user: { id: 'r', role: 'reader' },
      session: { token: 't' },
    })

    const res = await app.inject({ method: 'GET', url: '/device' })
    expect(res.statusCode).toBe(302)
  })

  test('POST /verify approves the device code when action=approve', async () => {
    authService.getSessionUserFromHeaders.mockResolvedValue(ownerSession)

    const res = await app.inject({
      method: 'POST',
      url: '/device/verify',
      headers: { cookie: 'session=abc', 'content-type': 'application/json' },
      payload: { user_code: 'ABCD1234', action: 'approve' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ ok: true, action: 'approve' })
    expect(deviceApprove).toHaveBeenCalledTimes(1)
    expect(deviceApprove.mock.calls[0]![0]).toMatchObject({
      body: { userCode: 'ABCD1234' },
    })
    expect(deviceDeny).not.toHaveBeenCalled()
  })

  test('POST /verify denies the device code when action=deny', async () => {
    authService.getSessionUserFromHeaders.mockResolvedValue(ownerSession)

    const res = await app.inject({
      method: 'POST',
      url: '/device/verify',
      headers: { cookie: 'session=abc', 'content-type': 'application/json' },
      payload: { user_code: 'ABCD1234', action: 'deny' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ ok: true, action: 'deny' })
    expect(deviceDeny).toHaveBeenCalledTimes(1)
    expect(deviceApprove).not.toHaveBeenCalled()
  })

  test('POST /verify rejects unauthenticated callers', async () => {
    authService.getSessionUserFromHeaders.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/device/verify',
      headers: { 'content-type': 'application/json' },
      payload: { user_code: 'ABCD1234', action: 'approve' },
    })

    expect(res.statusCode).toBe(401)
    expect(deviceApprove).not.toHaveBeenCalled()
  })

  test('POST /verify returns a structured error on plugin failure', async () => {
    authService.getSessionUserFromHeaders.mockResolvedValue(ownerSession)
    deviceApprove.mockRejectedValueOnce(
      Object.assign(new Error('not found'), {
        status: 400,
        body: {
          error: 'invalid_request',
          error_description: 'Invalid user code',
        },
      }),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/device/verify',
      headers: { cookie: 'session=abc', 'content-type': 'application/json' },
      payload: { user_code: 'ABCD1234', action: 'approve' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      ok: false,
      code: 'invalid_request',
      message: 'Invalid user code',
    })
  })

  test('POST /verify rejects payloads missing required fields', async () => {
    authService.getSessionUserFromHeaders.mockResolvedValue(ownerSession)

    const res = await app.inject({
      method: 'POST',
      url: '/device/verify',
      headers: { cookie: 'session=abc', 'content-type': 'application/json' },
      payload: { user_code: 'ABCD1234' },
    })

    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
  })
})
