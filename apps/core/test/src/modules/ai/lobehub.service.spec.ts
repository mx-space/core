import { AIProviderType, registerLobeHubRuntime } from '@mx-space/ai/runtime'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { AiController } from '~/modules/ai/ai.controller'
import { LobeHubService } from '~/modules/ai/lobehub/lobehub.service'
import { AISchema } from '~/modules/configs/configs.schema'
import { EncryptUtil } from '~/utils/encrypt.util'

const values = new Map<string, unknown>()
const cache = new Map<string, string>()
let now = 1_800_000_000_000
let tokenCalls = 0
let tokenReply: unknown
const repository = {
  get: async (key: string) => values.get(key) ?? null,
  upsert: async (key: string, value: unknown) => {
    values.set(key, value)
  },
  deleteByName: async (key: string) => {
    values.delete(key)
  },
}
const redis = {
  getClient: () => ({
    get: async (key: string) => cache.get(key) ?? null,
    set: async (key: string, value: string) => {
      cache.set(key, value)
    },
    del: async (...keys: string[]) => {
      keys.forEach((key) => cache.delete(key))
    },
  }),
}
let release = Promise.resolve()
const pool = {
  connect: async () => {
    let unlock: () => void
    return {
      query: async (sql: string) => {
        if (sql.includes('pg_advisory_lock(')) {
          const previous = release
          release = new Promise<void>((resolve) => {
            unlock = resolve
          })
          await previous
        } else if (sql.includes('pg_advisory_unlock(')) unlock!()
      },
      release() {},
    }
  },
}
function service() {
  return new LobeHubService(repository as any, redis as any, pool as any)
}

beforeEach(() => {
  values.clear()
  cache.clear()
  release = Promise.resolve()
  tokenCalls = 0
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  tokenReply = {
    access_token: 'access-secret',
    refresh_token: 'refresh-secret',
    expires_in: 3600,
  }
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.endsWith('/oidc/device/auth'))
      return Response.json({
        device_code: 'device-secret',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://app.lobehub.com/oidc/device',
        expires_in: 600,
        interval: 5,
      })
    if (url.endsWith('/oidc/token')) {
      tokenCalls++
      return Response.json(tokenReply)
    }
    if (url.endsWith('/oidc/me'))
      return Response.json({ name: 'Example', email: 'example@example.com' })
    return new Response(null, { status: 200 })
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('keeps device codes and OAuth tokens on the server, encrypting stored credentials', async () => {
  const cloud = service()
  const login = await cloud.startDeviceLogin()
  expect(JSON.stringify(login)).not.toContain('device-secret')
  expect(login.userCode).toBe('ABCD-EFGH')
  now += 5000
  expect(await cloud.pollDeviceLogin(login.flowId)).toEqual({
    status: 'connected',
  })
  expect(JSON.stringify([...values.values()])).not.toContain('access-secret')
  expect(JSON.stringify([...values.values()])).not.toContain('refresh-secret')
  expect(await cloud.getAccessToken()).toBe('access-secret')
  expect(await cloud.getAccount()).toMatchObject({
    status: 'connected',
    email: 'example@example.com',
  })
})

it('honors polling intervals, slow_down, denial and expiry', async () => {
  const cloud = service()
  const login = await cloud.startDeviceLogin()
  expect(await cloud.pollDeviceLogin(login.flowId)).toMatchObject({
    status: 'pending',
  })
  expect(tokenCalls).toBe(0)
  now += 5000
  tokenReply = { error: 'slow_down' }
  expect(await cloud.pollDeviceLogin(login.flowId)).toEqual({
    status: 'pending',
    intervalSeconds: 10,
  })
  now += 10_000
  tokenReply = { error: 'access_denied' }
  expect(await cloud.pollDeviceLogin(login.flowId)).toEqual({
    status: 'denied',
  })
  expect(await cloud.getAccount()).toMatchObject({ status: 'disconnected' })
  const next = await cloud.startDeviceLogin()
  now += 601_000
  expect(await cloud.pollDeviceLogin(next.flowId)).toEqual({
    status: 'expired',
  })
})

it('shares pending authorization across replicas and refreshes a rotated token only once', async () => {
  const first = service(),
    second = service()
  const login = await first.startDeviceLogin()
  now += 5000
  await second.pollDeviceLogin(login.flowId)
  now += 3_600_000
  tokenReply = {
    access_token: 'rotated-access',
    refresh_token: 'rotated-refresh',
    expires_in: 3600,
  }
  tokenCalls = 0
  expect(
    await Promise.all([first.getAccessToken(), second.getAccessToken()]),
  ).toEqual(['rotated-access', 'rotated-access'])
  expect(tokenCalls).toBe(1)
})

it('cancels pending authorization without removing an existing connection, and logout invalidates pending flows', async () => {
  const cloud = service()
  const login = await cloud.startDeviceLogin()
  now += 5000
  await cloud.pollDeviceLogin(login.flowId)
  const next = await cloud.startDeviceLogin()
  await cloud.cancelDeviceLogin(next.flowId)
  now += 5000
  expect(await cloud.pollDeviceLogin(next.flowId)).toEqual({
    status: 'expired',
  })
  expect(await cloud.getAccessToken()).toBe('access-secret')
  const last = await cloud.startDeviceLogin()
  await cloud.disconnect()
  now += 5000
  expect(await cloud.pollDeviceLogin(last.flowId)).toEqual({
    status: 'expired',
  })
  expect(await cloud.getAccount()).toMatchObject({ status: 'disconnected' })
})

it('rejects malformed token responses without replacing a working session', async () => {
  const cloud = service()
  const login = await cloud.startDeviceLogin()
  now += 5000
  await cloud.pollDeviceLogin(login.flowId)
  const next = await cloud.startDeviceLogin()
  now += 5000
  tokenReply = { refresh_token: 'bad' }
  await expect(cloud.pollDeviceLogin(next.flowId)).rejects.toThrow()
  expect(await cloud.getAccessToken()).toBe('access-secret')
  expect(
    [...values.values()].every((value) =>
      EncryptUtil.isEncryptedString(value as string),
    ),
  ).toBe(true)
})

it('accepts OAuth providers without weakening API key validation for other providers', () => {
  const provider = {
    id: 'cloud',
    name: 'Cloud',
    type: 'lobehub',
    apiKey: '',
    enabled: true,
    defaultModel: '',
  }
  expect(AISchema.safeParse({ providers: [provider] }).success).toBe(true)
  expect(
    AISchema.safeParse({ providers: [{ ...provider, type: 'anthropic' }] })
      .success,
  ).toBe(false)
})

it('makes saved and unsaved OAuth providers available to model discovery without an API key', async () => {
  const provider = {
    id: 'cloud',
    name: 'Cloud',
    type: AIProviderType.LobeHub,
    apiKey: '',
    enabled: true,
    defaultModel: 'chat-a',
  }
  registerLobeHubRuntime({ getAccessToken: async () => 'access' })
  vi.stubGlobal('fetch', async () =>
    Response.json({ models: [{ id: 'chat-a', type: 'chat' }] }),
  )
  const controller = new AiController(
    {
      get: async () => ({ providers: [provider] }),
      getAiProviderById: async () => provider,
    } as any,
    {} as any,
  )
  expect(await controller.getAvailableModels()).toMatchObject([
    { providerId: 'cloud', models: [{ id: 'chat-a' }] },
  ])
  expect(
    await controller.fetchModelsList({ type: AIProviderType.LobeHub }),
  ).toEqual({ models: [{ id: 'chat-a', name: 'chat-a' }] })
})
