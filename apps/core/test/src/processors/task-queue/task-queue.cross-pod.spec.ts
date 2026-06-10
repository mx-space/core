/**
 * Cross-pod Redis SET subscriber gate for `emitToAdminRoom`.
 *
 * Redis sharing strategy: this spec spins up TWO independent `RoomSubsService`
 * instances against a SHARED in-process `redis-memory-server` backend (via the
 * existing `test/helper/redis-mock.helper.ts`). Both services receive their own
 * `IORedis` connection pointed at the same `host:port`, so SADD/SREM/EXISTS
 * operations from one instance are observable from the other — exactly the
 * cross-pod scenario the production Redis cluster provides between Dokploy
 * replicas. We did NOT spin up two physical Redis containers because the shared
 * in-memory backend is functionally equivalent for the gate behaviour we are
 * verifying (a SET membership check on a known key).
 *
 * Asserts:
 *   - pod B adds room → pod A's `emitToAdminRoom` passes the gate and the
 *     broadcast spy is invoked (even though pod A has zero local subscribers);
 *   - no pod holds the room → pod A's `emitToAdminRoom` is suppressed and the
 *     broadcast spy is never called;
 *   - pod B removes the room → pod A's next `emitToAdminRoom` is suppressed
 *     again.
 */
import IORedis, { type Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { BusinessEvents } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RoomSubsService } from '~/processors/task-queue/task-queue.room-subs.service'

import { redisHelper } from '../../../helper/redis-mock.helper'

const ROOM = 'ai-task:detail:T1'

function buildPod(client: Redis) {
  const redisService = { getClient: () => client } as any
  const roomSubs = new RoomSubsService(redisService)
  const adminGateway = {
    broadcast: vi.fn(),
  } as any
  const emitter2 = {
    on: vi.fn(),
  } as any
  const eventManager = new EventManagerService(adminGateway, emitter2, roomSubs)
  return { roomSubs, adminGateway, eventManager }
}

describe('emitToAdminRoom — cross-pod Redis SET gate', () => {
  let sharedClient1: Redis
  let sharedClient2: Redis
  let podA: ReturnType<typeof buildPod>
  let podB: ReturnType<typeof buildPod>

  beforeAll(async () => {
    const helper = await redisHelper
    const upstream = helper.CacheService.getClient()
    const opts = upstream.options
    sharedClient1 = new IORedis(opts.port as number, opts.host as string)
    sharedClient2 = new IORedis(opts.port as number, opts.host as string)
    podA = buildPod(sharedClient1)
    podB = buildPod(sharedClient2)
    // Ensure two distinct podIds — proves RoomSubsService was instantiated twice.
    expect(podA.roomSubs.podId).not.toBe(podB.roomSubs.podId)
    // Clean any leftover state from prior suites that may have touched the key.
    const stale = await sharedClient1.keys('*task-queue:room-subs:*')
    if (stale.length > 0) {
      await sharedClient1.del(...stale)
    }
  })

  afterAll(async () => {
    await sharedClient1.quit()
    await sharedClient2.quit()
  })

  it('pod A emit is SUPPRESSED when no pod holds the room', async () => {
    podA.adminGateway.broadcast.mockClear()
    await podA.eventManager.emitToAdminRoom(
      BusinessEvents.TASK_UPDATE,
      { hello: 'world' },
      ROOM,
    )
    expect(podA.adminGateway.broadcast).not.toHaveBeenCalled()
  })

  it('pod A emit PASSES the gate when pod B holds the room', async () => {
    podA.adminGateway.broadcast.mockClear()
    podB.adminGateway.broadcast.mockClear()

    // Pod B subscribes — pod A has zero local subscribers for ROOM.
    await podB.roomSubs.add(ROOM)

    await podA.eventManager.emitToAdminRoom(
      BusinessEvents.TASK_UPDATE,
      { phase: 'progress', taskId: 'T1' },
      ROOM,
    )

    expect(podA.adminGateway.broadcast).toHaveBeenCalledTimes(1)
    expect(podA.adminGateway.broadcast).toHaveBeenCalledWith(
      BusinessEvents.TASK_UPDATE,
      { phase: 'progress', taskId: 'T1' },
      { rooms: [ROOM] },
    )
    // Pod B's local gateway is unaffected — emit happened on pod A only.
    expect(podB.adminGateway.broadcast).not.toHaveBeenCalled()
  })

  it('pod A emit reverts to SUPPRESSED after pod B removes the room', async () => {
    podA.adminGateway.broadcast.mockClear()

    await podB.roomSubs.remove(ROOM)

    await podA.eventManager.emitToAdminRoom(
      BusinessEvents.TASK_UPDATE,
      { phase: 'progress', taskId: 'T1' },
      ROOM,
    )
    expect(podA.adminGateway.broadcast).not.toHaveBeenCalled()
  })
})
