import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'

import {
  ACK_EVENT,
  buildEnvelope,
  isWsEnvelope,
  type WsEnvelope,
} from '@mx-space/ws-client/protocol'
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter'
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { Test, type TestingModule } from '@nestjs/testing'
import IORedis, { type Redis } from 'ioredis'
import { expect, type Mock, vi } from 'vitest'
import WebSocket from 'ws'

import { AuthService } from '~/modules/auth/auth.service'
import { AdminEventsGateway } from '~/processors/gateway/admin/events.gateway'
import { GatewayService } from '~/processors/gateway/gateway.service'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { createWsAdapter } from '~/processors/gateway/ws/ws-adapter.factory'
import { WsBusService } from '~/processors/gateway/ws/ws-bus.service'
import { WsInboundEvents } from '~/processors/gateway/ws/ws-events'
import { WsPresenceService } from '~/processors/gateway/ws/ws-presence.service'
import {
  REDIS_CLIENT_OPTIONS,
  RedisService,
} from '~/processors/redis/redis.service'
import { RoomSubsService } from '~/processors/task-queue/task-queue.room-subs.service'

export interface RedisConn {
  port: number
  host: string
}

export interface AuthServiceStub {
  getSessionUserFromHeaders: Mock
  verifyApiKey: Mock
  isOwnerReaderId: Mock
}

function buildFakeRedisService(client: Redis) {
  return {
    getClient: () => client,
    duplicateClient: () => client.duplicate(),
    isReady: () => true,
    isUnavailableError: () => false,
    getStatus: () => 'ready',
  }
}

function createAuthServiceStub(): AuthServiceStub {
  return {
    getSessionUserFromHeaders: vi.fn(async () => null),
    verifyApiKey: vi.fn(async () => null),
    isOwnerReaderId: vi.fn(async () => false),
  }
}

export interface GatewayTestApp {
  app: NestFastifyApplication
  moduleRef: TestingModule
  redisClient: Redis
  authService: AuthServiceStub
  webGateway: WebEventsGateway
  adminGateway: AdminEventsGateway
  presence: WsPresenceService
  eventEmitter: EventEmitter2
  webUrl: (query?: string) => string
  adminUrl: (query?: string) => string
  close: () => Promise<void>
}

export async function createGatewayApp(
  redisConn: RedisConn,
): Promise<GatewayTestApp> {
  // Mirrors production RedisService's command timeout so a stalled
  // redis-memory-server round-trip fails fast into the existing graceful
  // degradation path instead of hanging a connect handshake indefinitely.
  const redisClient = new IORedis(redisConn.port, redisConn.host, {
    commandTimeout: REDIS_CLIENT_OPTIONS.commandTimeout,
    maxRetriesPerRequest: REDIS_CLIENT_OPTIONS.maxRetriesPerRequest,
  })
  const authService = createAuthServiceStub()

  const moduleRef = await Test.createTestingModule({
    imports: [EventEmitterModule.forRoot()],
    providers: [
      WebEventsGateway,
      AdminEventsGateway,
      GatewayService,
      WsBusService,
      WsPresenceService,
      RoomSubsService,
      RedisService,
      AuthService,
    ],
  })
    .overrideProvider(RedisService)
    .useValue(buildFakeRedisService(redisClient))
    .overrideProvider(AuthService)
    .useValue(authService)
    .compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  )
  app.useWebSocketAdapter(createWsAdapter(app))
  await app.listen(0, '127.0.0.1')

  const { port } = app.getHttpServer().address() as AddressInfo

  return {
    app,
    moduleRef,
    redisClient,
    authService,
    webGateway: moduleRef.get(WebEventsGateway),
    adminGateway: moduleRef.get(AdminEventsGateway),
    presence: moduleRef.get(WsPresenceService),
    eventEmitter: moduleRef.get(EventEmitter2),
    webUrl: (query = '') =>
      `ws://127.0.0.1:${port}/ws/web${query ? `?${query}` : ''}`,
    adminUrl: (query = '') =>
      `ws://127.0.0.1:${port}/ws/admin${query ? `?${query}` : ''}`,
    async close() {
      await app.close()
      // handleDisconnect fires GatewayService.clearSocketMetadata without
      // awaiting it; give that fire-and-forget write a moment to reach Redis
      // before the connection used to send it is quit.
      await new Promise((resolve) => setTimeout(resolve, 50))
      await redisClient.quit()
    },
  }
}

const DEFAULT_WAIT_MS = 5000

type WaitEntry = {
  predicate: (envelope: WsEnvelope) => boolean
  resolve: (envelope: WsEnvelope) => void
}

export class WsTestClient {
  readonly frames: WsEnvelope[] = []
  closeInfo?: { code: number; reason: string }

  private waiters: WaitEntry[] = []

  private constructor(readonly ws: WebSocket) {
    ws.on('message', (data) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(data.toString())
      } catch {
        return
      }
      if (!isWsEnvelope(parsed)) return

      this.frames.push(parsed)
      this.waiters = this.waiters.filter((waiter) => {
        if (!waiter.predicate(parsed)) return true
        waiter.resolve(parsed)
        return false
      })
    })

    ws.once('close', (code: number, reason: Buffer) => {
      this.closeInfo = { code, reason: reason.toString() }
    })
  }

  static async connect(
    url: string,
    options?: WebSocket.ClientOptions,
  ): Promise<WsTestClient> {
    const ws = new WebSocket(url, options)
    // Construct (and attach the `message`/`close` listeners) before awaiting
    // `open`: on a fast local round-trip the server's greeting can arrive in
    // the same read as the upgrade response, firing `message` synchronously
    // right after `open` — a listener added only after awaiting `open` can
    // lose that first frame.
    const client = new WsTestClient(ws)
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', reject)
    })
    return client
  }

  send(event: string, payload?: unknown, id?: string) {
    this.ws.send(JSON.stringify(buildEnvelope(event, payload, id)))
  }

  sendRaw(raw: string) {
    this.ws.send(raw)
  }

  async waitFor(
    predicate: (envelope: WsEnvelope) => boolean,
    timeoutMs = DEFAULT_WAIT_MS,
  ): Promise<WsEnvelope> {
    const existing = this.frames.find(predicate)
    if (existing) return existing

    return new Promise<WsEnvelope>((resolve, reject) => {
      const onMatch = (envelope: WsEnvelope) => {
        clearTimeout(timer)
        resolve(envelope)
      }
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.resolve !== onMatch)
        reject(
          new Error(
            `Timed out waiting for a matching frame after ${timeoutMs}ms`,
          ),
        )
      }, timeoutMs)

      this.waiters.push({ predicate, resolve: onMatch })
    })
  }

  async waitForAck(
    id: string,
    timeoutMs = DEFAULT_WAIT_MS,
  ): Promise<WsEnvelope> {
    return this.waitFor((e) => e.event === ACK_EVENT && e.id === id, timeoutMs)
  }

  async waitForClose(
    timeoutMs = DEFAULT_WAIT_MS,
  ): Promise<{ code: number; reason: string }> {
    if (this.closeInfo) return this.closeInfo
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(new Error(`Timed out waiting for close after ${timeoutMs}ms`)),
        timeoutMs,
      )
      this.ws.once('close', (code: number, reason: Buffer) => {
        clearTimeout(timer)
        resolve({ code, reason: reason.toString() })
      })
    })
  }

  async assertNotDelivered(predicate: (envelope: WsEnvelope) => boolean) {
    const id = randomUUID()
    this.send(WsInboundEvents.ping, undefined, id)
    await this.waitForAck(id)
    expect(this.frames.find(predicate)).toBeUndefined()
  }

  close() {
    if (
      this.ws.readyState === this.ws.OPEN ||
      this.ws.readyState === this.ws.CONNECTING
    ) {
      this.ws.close()
    }
  }

  async closeAndWait(timeoutMs = DEFAULT_WAIT_MS): Promise<void> {
    if (this.ws.readyState === this.ws.CLOSED) return
    this.close()
    await this.waitForClose(timeoutMs)
  }
}
