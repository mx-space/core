import { createHash, randomUUID } from 'node:crypto'

import { LOBEHUB_BASE_URL, registerLobeHubRuntime } from '@mx-space/ai/runtime'
import type { OnModuleInit } from '@nestjs/common'
import { Inject, Injectable } from '@nestjs/common'
import type pkg from 'pg'
import { z } from 'zod'

import { AppException } from '~/common/errors/exception.types'
import { PG_POOL_TOKEN } from '~/constants/system.constant'
import { OptionsRepository } from '~/modules/configs/options.repository'
import { withAdvisoryLock } from '~/processors/database/postgres.lock'
import { RedisService } from '~/processors/redis/redis.service'
import { EncryptUtil } from '~/utils/encrypt.util'
import { getRedisKey } from '~/utils/redis.util'

import {
  LobeHubCredentialSchema,
  LobeHubPendingSchema,
  LobeHubViews,
} from './lobehub.schema'

const SESSION_KEY = '__secret_ai_lobehub_session'
const ACTIVE_KEY = getRedisKey('ai:lobehub:active')
const LOCK_KEY = createHash('sha256')
  .update('mx-core:lobehub-session:v1')
  .digest()
  .readBigInt64BE()
const deviceKey = (flowId: string) => getRedisKey(`ai:lobehub:device:${flowId}`)
const protocolError = () =>
  new AppException(
    'LOBEHUB_PROTOCOL_ERROR',
    'Invalid LobeHub authorization response',
    502,
  )
const reconnect = () =>
  new AppException(
    'LOBEHUB_RECONNECT_REQUIRED',
    'Reconnect your LobeHub account',
    400,
  )
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
})
const deviceSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.url(),
  verification_uri_complete: z.url().optional(),
  expires_in: z.number().int().positive().max(3600),
  interval: z.number().int().positive().default(5),
})

@Injectable()
export class LobeHubService implements OnModuleInit {
  private readonly baseUrl = (
    process.env.LOBEHUB_CLOUD_URL || LOBEHUB_BASE_URL
  ).replace(/\/+$/, '')
  private readonly clientId =
    process.env.LOBEHUB_OAUTH_CLIENT_ID || 'lca_nciA1nZ536BtbF09HiWi2cyJ'

  constructor(
    private readonly options: OptionsRepository,
    private readonly redis: RedisService,
    @Inject(PG_POOL_TOKEN) private readonly pool: pkg.Pool,
  ) {}

  onModuleInit() {
    registerLobeHubRuntime({
      baseUrl: this.baseUrl,
      getAccessToken: () => this.getAccessToken(),
    })
  }

  private locked<T>(fn: () => Promise<T>) {
    return withAdvisoryLock(this.pool, LOCK_KEY, fn)
  }

  private async postForm(path: string, body: Record<string, string>) {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: this.clientId, ...body }),
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      throw new AppException(
        'LOBEHUB_UNAVAILABLE',
        'LobeHub authorization is temporarily unavailable',
        503,
      )
    }
    const result = z
      .record(z.string(), z.unknown())
      .safeParse(await response.json().catch(() => null))
    if (!result.success) throw protocolError()
    if (!response.ok && typeof result.data.error !== 'string')
      throw protocolError()
    return result.data
  }

  private async readCredential() {
    const encrypted = await this.options.get<string>(SESSION_KEY)
    return encrypted
      ? LobeHubCredentialSchema.parse(
          JSON.parse(EncryptUtil.decrypt(encrypted, SESSION_KEY)),
        )
      : null
  }

  private async saveToken(body: unknown, previousRefresh?: string) {
    const parsed = tokenSchema.safeParse(body)
    if (!parsed.success) throw protocolError()
    const refreshToken = parsed.data.refresh_token || previousRefresh
    if (!refreshToken) throw protocolError()
    const credential = {
      accessToken: parsed.data.access_token,
      refreshToken,
      expiresAt: Date.now() + parsed.data.expires_in * 1000,
    }
    await this.options.upsert(
      SESSION_KEY,
      EncryptUtil.encrypt(JSON.stringify(credential), SESSION_KEY),
    )
    return credential
  }

  async startDeviceLogin() {
    EncryptUtil.assertConfigured()
    return this.locked(async () => {
      const parsed = deviceSchema.safeParse(
        await this.postForm('/oidc/device/auth', {
          resource: 'urn:lobehub:chat',
          scope: 'openid profile email offline_access',
        }),
      )
      if (!parsed.success) throw protocolError()
      const login = parsed.data
      const origin = new URL(this.baseUrl).origin
      if (
        [login.verification_uri, login.verification_uri_complete].some(
          (url) => url && new URL(url).origin !== origin,
        )
      )
        throw protocolError()
      const flowId = randomUUID()
      const expiresAt = Date.now() + login.expires_in * 1000
      const pending = {
        deviceCode: login.device_code,
        expiresAt,
        intervalSeconds: login.interval,
        nextPollAt: Date.now() + login.interval * 1000,
      }
      const redis = this.redis.getClient()
      await redis.set(
        deviceKey(flowId),
        EncryptUtil.encrypt(JSON.stringify(pending), deviceKey(flowId)),
        'EX',
        login.expires_in,
      )
      await redis.set(ACTIVE_KEY, flowId, 'EX', login.expires_in)
      return LobeHubViews.login.parse({
        flowId,
        userCode: login.user_code,
        verificationUri: login.verification_uri,
        verificationUriComplete: login.verification_uri_complete,
        intervalSeconds: login.interval,
        expiresAt: new Date(expiresAt).toISOString(),
      })
    })
  }

  async pollDeviceLogin(flowId: string) {
    return this.locked(async () => {
      const redis = this.redis.getClient()
      if ((await redis.get(ACTIVE_KEY)) !== flowId)
        return { status: 'expired' as const }
      const stored = await redis.get(deviceKey(flowId))
      if (stored === 'connected') return { status: 'connected' as const }
      if (!stored) return { status: 'expired' as const }
      const pending = LobeHubPendingSchema.parse(
        JSON.parse(EncryptUtil.decrypt(stored, deviceKey(flowId))),
      )
      if (Date.now() >= pending.expiresAt) {
        await redis.del(ACTIVE_KEY, deviceKey(flowId))
        return { status: 'expired' as const }
      }
      if (Date.now() < pending.nextPollAt)
        return {
          status: 'pending' as const,
          intervalSeconds: pending.intervalSeconds,
        }
      const body = await this.postForm('/oidc/token', {
        device_code: pending.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      })
      if (
        body.error === 'authorization_pending' ||
        body.error === 'slow_down'
      ) {
        if (body.error === 'slow_down') pending.intervalSeconds += 5
        pending.nextPollAt = Date.now() + pending.intervalSeconds * 1000
        const ttl = Math.ceil((pending.expiresAt - Date.now()) / 1000)
        if (ttl <= 0) return { status: 'expired' as const }
        await redis.set(
          deviceKey(flowId),
          EncryptUtil.encrypt(JSON.stringify(pending), deviceKey(flowId)),
          'EX',
          ttl,
        )
        return {
          status: 'pending' as const,
          intervalSeconds: pending.intervalSeconds,
        }
      }
      if (body.error === 'access_denied' || body.error === 'expired_token') {
        await redis.del(ACTIVE_KEY, deviceKey(flowId))
        return {
          status:
            body.error === 'access_denied'
              ? ('denied' as const)
              : ('expired' as const),
        }
      }
      if (body.error) throw protocolError()
      await this.saveToken(body)
      await redis.set(deviceKey(flowId), 'connected', 'EX', 60)
      return { status: 'connected' as const }
    })
  }

  async cancelDeviceLogin(flowId: string) {
    await this.locked(async () => {
      const redis = this.redis.getClient()
      if ((await redis.get(ACTIVE_KEY)) === flowId) await redis.del(ACTIVE_KEY)
      await redis.del(deviceKey(flowId))
    })
  }

  async getAccessToken() {
    // Read again under the shared lock: refresh tokens may rotate on another replica.
    return this.locked(async () => {
      let credential = await this.readCredential()
      if (!credential) throw reconnect()
      if (credential.expiresAt <= Date.now() + 60_000) {
        const body = await this.postForm('/oidc/token', {
          grant_type: 'refresh_token',
          refresh_token: credential.refreshToken,
        })
        if (body.error) throw reconnect()
        credential = await this.saveToken(body, credential.refreshToken)
      }
      return credential.accessToken
    })
  }

  async getAccount() {
    const disconnected = {
      status: 'disconnected' as const,
      name: null,
      email: null,
    }
    if (!(await this.readCredential())) return disconnected
    let token: string
    try {
      token = await this.getAccessToken()
    } catch (error) {
      if (
        error instanceof AppException &&
        error.code === 'LOBEHUB_RECONNECT_REQUIRED'
      )
        return { ...disconnected, status: 'refresh_required' as const }
      throw error
    }
    const response = await fetch(`${this.baseUrl}/oidc/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null)
    if (response?.status === 401 || response?.status === 403)
      return { ...disconnected, status: 'refresh_required' as const }
    const profile = z
      .object({ name: z.string().nullish(), email: z.string().nullish() })
      .safeParse(response?.ok ? await response.json().catch(() => null) : null)
    return {
      status: 'connected' as const,
      name: profile.success ? (profile.data.name ?? null) : null,
      email: profile.success ? (profile.data.email ?? null) : null,
    }
  }

  async disconnect() {
    await this.locked(async () => {
      const credential = await this.readCredential()
      await this.options.deleteByName(SESSION_KEY)
      await this.redis.getClient().del(ACTIVE_KEY)
      if (credential) {
        // Local logout succeeds even when the remote revocation endpoint is down.
        await this.postForm('/token/revocation', {
          token: credential.refreshToken,
          token_type_hint: 'refresh_token',
        }).catch(() => {})
      }
    })
  }
}
