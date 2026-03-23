import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  RedisIoAdapter,
  RedisIoAdapterKey,
} from '~/common/adapters/socket.adapter'

const {
  createAdapterMock,
  createIOServerMock,
  duplicateClientMock,
  serverAdapterMock,
  waitForReadyMock,
} = vi.hoisted(() => {
  return {
    createAdapterMock: vi.fn(),
    createIOServerMock: vi.fn(),
    duplicateClientMock: vi.fn(),
    serverAdapterMock: vi.fn(),
    waitForReadyMock: vi.fn(),
  }
})

vi.mock('@nestjs/platform-socket.io', () => {
  return {
    IoAdapter: class {
      createIOServer(...args: any[]) {
        return createIOServerMock(...args)
      }
    },
  }
})

vi.mock('@socket.io/redis-adapter', () => {
  return {
    createAdapter: createAdapterMock,
  }
})

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('RedisIoAdapter', () => {
  afterEach(() => {
    createAdapterMock.mockReset()
    createIOServerMock.mockReset()
    duplicateClientMock.mockReset()
    serverAdapterMock.mockReset()
    waitForReadyMock.mockReset()
  })

  it('attaches the redis adapter only after redis is ready', async () => {
    let resolveReady: () => void
    const waitForReadyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve
    })
    const redisAdapterFactory = vi.fn()
    const fakeServer = { adapter: serverAdapterMock }
    const pubClient = { id: 'pub-client' }
    const subClient = { id: 'sub-client' }
    const redisService = {
      duplicateClient: duplicateClientMock,
      waitForReady: waitForReadyMock,
    }

    createIOServerMock.mockReturnValue(fakeServer)
    createAdapterMock.mockReturnValue(redisAdapterFactory)
    duplicateClientMock
      .mockReturnValueOnce(pubClient)
      .mockReturnValueOnce(subClient)
    waitForReadyMock.mockReturnValue(waitForReadyPromise)

    const adapter = new RedisIoAdapter({} as any, redisService as any)
    const server = adapter.createIOServer(2333)

    expect(server).toBe(fakeServer)
    expect(duplicateClientMock).toHaveBeenCalledTimes(2)
    expect(waitForReadyMock).toHaveBeenCalledTimes(2)
    expect(waitForReadyMock).toHaveBeenNthCalledWith(1, pubClient)
    expect(waitForReadyMock).toHaveBeenNthCalledWith(2, subClient)
    expect(createAdapterMock).not.toHaveBeenCalled()
    expect(serverAdapterMock).not.toHaveBeenCalled()

    resolveReady!()
    await flushPromises()

    expect(createAdapterMock).toHaveBeenCalledWith(
      { id: 'pub-client' },
      { id: 'sub-client' },
      {
        key: RedisIoAdapterKey,
        requestsTimeout: 5000,
        publishOnSpecificResponseChannel: true,
      },
    )
    expect(serverAdapterMock).toHaveBeenCalledWith(redisAdapterFactory)
  })
})
