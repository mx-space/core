import { randomUUID } from 'node:crypto'

import { redisHelper } from 'test/helper/redis-mock.helper'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { BusinessEvents } from '~/constants/business-event.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'

import {
  createGatewayApp,
  type GatewayTestApp,
  WsTestClient,
} from './gateway-e2e.harness'

vi.setConfig({ testTimeout: 15_000 })

async function assertLiveConnection(client: WsTestClient) {
  const pingId = randomUUID()
  client.send('ping', undefined, pingId)
  const ack = await client.waitForAck(pingId)
  expect(ack.payload).toMatchObject({ ok: true })
}

describe('AdminEventsGateway e2e', () => {
  let testApp: GatewayTestApp

  beforeAll(async () => {
    const helper = await redisHelper
    const opts = helper.CacheService.getClient().options
    testApp = await createGatewayApp({
      port: opts.port as number,
      host: opts.host as string,
    })
  })

  afterAll(async () => {
    await testApp.close()
  })

  it('connects via a cookie owner session', async () => {
    testApp.authService.getSessionUserFromHeaders.mockResolvedValueOnce({
      user: { id: 'owner-1', role: 'owner' },
      session: { token: 'tok-cookie' },
    })

    const client = await WsTestClient.connect(testApp.adminUrl(), {
      headers: { cookie: 'better-auth.session=abc' },
    })
    try {
      await client.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)
      await assertLiveConnection(client)
    } finally {
      await client.closeAndWait()
    }
  })

  it('connects via a valid x-api-key header', async () => {
    testApp.authService.verifyApiKey.mockResolvedValueOnce({
      referenceId: 'reader-1',
    })
    testApp.authService.isOwnerReaderId.mockResolvedValueOnce(true)

    const client = await WsTestClient.connect(testApp.adminUrl(), {
      headers: { 'x-api-key': 'valid-key' },
    })
    try {
      await client.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)
      await assertLiveConnection(client)
    } finally {
      await client.closeAndWait()
    }
  })

  it('connects via a valid query token', async () => {
    testApp.authService.verifyApiKey.mockResolvedValueOnce({
      referenceId: 'reader-2',
    })
    testApp.authService.isOwnerReaderId.mockResolvedValueOnce(true)

    const client = await WsTestClient.connect(
      testApp.adminUrl('token=valid-query-token'),
    )
    try {
      await client.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)
      await assertLiveConnection(client)
    } finally {
      await client.closeAndWait()
    }
  })

  it('sends auth.failed then closes with 4401 when the api key is invalid', async () => {
    testApp.authService.verifyApiKey.mockResolvedValueOnce(null)

    const client = await WsTestClient.connect(testApp.adminUrl(), {
      headers: { 'x-api-key': 'bad-key' },
    })
    try {
      await client.waitFor((e) => e.event === BusinessEvents.AUTH_FAILED)
      const close = await client.waitForClose()
      expect(close.code).toBe(4401)
    } finally {
      await client.closeAndWait()
    }
  })

  it('delivers ai_task.subscribe broadcasts only to the subscriber', async () => {
    testApp.authService.verifyApiKey.mockResolvedValueOnce({
      referenceId: 'reader-3',
    })
    testApp.authService.isOwnerReaderId.mockResolvedValueOnce(true)
    const subscriber = await WsTestClient.connect(testApp.adminUrl(), {
      headers: { 'x-api-key': 'sub-key' },
    })

    testApp.authService.verifyApiKey.mockResolvedValueOnce({
      referenceId: 'reader-4',
    })
    testApp.authService.isOwnerReaderId.mockResolvedValueOnce(true)
    const bystander = await WsTestClient.connect(testApp.adminUrl(), {
      headers: { 'x-api-key': 'bystander-key' },
    })

    try {
      await subscriber.waitFor(
        (e) => e.event === BusinessEvents.GATEWAY_CONNECT,
      )
      await bystander.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)

      const subId = randomUUID()
      subscriber.send('ai_task.subscribe', { taskId: 'task-1' }, subId)
      const ack = await subscriber.waitForAck(subId)
      expect(ack.payload).toMatchObject({ ok: true })

      testApp.adminGateway.broadcast(
        BusinessEvents.TASK_UPDATE,
        { taskId: 'task-1', status: 'done' },
        { rooms: ['ai-task:detail:task-1'] },
      )

      const received = await subscriber.waitFor(
        (e) => e.event === BusinessEvents.TASK_UPDATE,
      )
      expect(received.payload).toMatchObject({ taskId: 'task-1' })

      await bystander.assertNotDelivered(
        (e) => e.event === BusinessEvents.TASK_UPDATE,
      )
    } finally {
      await subscriber.closeAndWait()
      await bystander.closeAndWait()
    }
  })

  it('closes the socket when its bound token expires', async () => {
    testApp.authService.getSessionUserFromHeaders.mockResolvedValueOnce({
      user: { id: 'owner-2', role: 'owner' },
      session: { token: 'tok-expiring' },
    })

    const client = await WsTestClient.connect(testApp.adminUrl(), {
      headers: { cookie: 'better-auth.session=xyz' },
    })
    try {
      await client.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)

      testApp.eventEmitter.emit(EventBusEvents.TokenExpired, 'tok-expiring')

      const close = await client.waitForClose()
      expect(close.code).toBe(4401)
    } finally {
      await client.closeAndWait()
    }
  })
})
