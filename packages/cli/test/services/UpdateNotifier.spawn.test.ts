import { EventEmitter } from 'node:events'

import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({ spawn: spawnMock }))

import { make } from '../../src/services/UpdateNotifier'

const makeFetchOK = () => async () => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  async json() {
    return { version: '9.9.9', engines: { node: '>=22' } }
  },
  async text() {
    return ''
  },
})

const makeChild = () => {
  const child = new EventEmitter() as EventEmitter & {
    stderr: EventEmitter
  }
  child.stderr = new EventEmitter()
  return child
}

describe('UpdateNotifier default spawn adapter', () => {
  beforeEach(() => {
    spawnMock.mockReset()
  })

  it('uses child_process.spawn when no spawn override is supplied', async () => {
    spawnMock.mockImplementation(() => {
      const child = makeChild()
      queueMicrotask(() => {
        child.stderr.emit('data', Buffer.from('npm notice\n'))
        child.emit('exit', 0)
      })
      return child
    })
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    try {
      const svc = make({ fetchImpl: makeFetchOK() })
      const res = await Effect.runPromise(
        svc.runUpdate({
          currentVersion: '0.2.0',
          entrypoint:
            '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
          yes: true,
          json: true,
        }),
      )
      expect(res.upgraded).toBe(true)
      expect(spawnMock).toHaveBeenCalledWith(
        'npm',
        ['install', '-g', '@mx-space/cli@latest'],
        expect.objectContaining({
          stdio: ['ignore', 'inherit', 'pipe'],
        }),
      )
    } finally {
      stderrSpy.mockRestore()
    }
  })

  it('turns child spawn errors into a failed update result', async () => {
    spawnMock.mockImplementation(() => {
      const child = makeChild()
      queueMicrotask(() => {
        child.emit('error', new Error('spawn denied'))
      })
      return child
    })
    const svc = make({ fetchImpl: makeFetchOK() })
    const exit = await Effect.runPromiseExit(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        yes: true,
        json: true,
      }),
    )
    expect(exit._tag).toBe('Failure')
  })
})
