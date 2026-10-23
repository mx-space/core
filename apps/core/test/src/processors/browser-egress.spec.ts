import { request } from 'node:http'

import { describe, expect, it, vi } from 'vitest'

import { createBrowserEgressProxy } from '~/processors/agent-browser/browser-egress-proxy'

vi.mock('~/global/env.global', () => ({ isDev: false }))

describe('browser egress proxy', () => {
  it.each([
    'http://127.0.0.1/private',
    'http://[::ffff:7f00:1]/private',
    'http://localhost/private',
  ])('blocks browser requests to %s before connecting', async (target) => {
    const proxy = await createBrowserEgressProxy()
    try {
      const status = await new Promise((resolve, reject) => {
        const req = request(proxy.url, { path: target }, (res) => {
          res.resume()
          resolve(res.statusCode)
        })
        req.on('error', reject)
        req.end()
      })
      expect(status).toBe(403)
    } finally {
      await proxy.close()
    }
  })
  it('blocks CONNECT tunnels to metadata', async () => {
    const proxy = await createBrowserEgressProxy()
    try {
      const status = await new Promise((resolve, reject) => {
        const req = request(proxy.url, {
          method: 'CONNECT',
          path: '169.254.169.254:80',
        })
        req.on('connect', (res, socket) => {
          socket.destroy()
          resolve(res.statusCode)
        })
        req.on('error', reject)
        req.end()
      })
      expect(status).toBe(403)
    } finally {
      await proxy.close()
    }
  })
})
