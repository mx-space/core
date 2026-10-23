import { lookup } from 'node:dns/promises'
import { createServer, request as httpRequest } from 'node:http'
import { connect, isIP, type Socket } from 'node:net'

import { isDev } from '~/global/env.global'

import {
  isPrivateIp,
  parseAndValidateUrl,
  stripIpv6Brackets,
  UnsafeUrlError,
} from './url-guard'

export interface BrowserEgressProxy {
  url: string
  close: () => Promise<void>
}

/** Chromium sends every navigation, redirect, subresource and WebSocket through this proxy. */
export async function createBrowserEgressProxy(): Promise<BrowserEgressProxy> {
  const sockets = new Set<Socket>()
  let closing = false
  const track = (socket: Socket) => {
    sockets.add(socket)
    socket.on('error', () => socket.destroy())
    socket.setTimeout(30_000, () => socket.destroy())
    socket.once('close', () => sockets.delete(socket))
    return socket
  }
  const resolve = async (raw: string) => {
    const url = parseAndValidateUrl(raw)
    const host = stripIpv6Brackets(url.hostname)
    const addresses = isIP(host)
      ? [{ address: host, family: isIP(host) }]
      : await lookup(host, { all: true })
    if (
      !addresses.length ||
      (!isDev && addresses.some((a) => isPrivateIp(a.address, a.family)))
    )
      throw new UnsafeUrlError('Private browser destination')
    return { url, address: addresses[0].address }
  }
  const server = createServer(async (incoming, outgoing) => {
    try {
      const { url, address } = await resolve(incoming.url || '')
      if (closing || incoming.destroyed || outgoing.destroyed) return
      if (url.protocol !== 'http:')
        throw new UnsafeUrlError('Expected proxy HTTP URL')
      const upstream = httpRequest(
        {
          hostname: address,
          port: url.port || 80,
          method: incoming.method,
          path: `${url.pathname}${url.search}`,
          headers: { ...incoming.headers, host: url.host },
        },
        (response) => {
          outgoing.writeHead(response.statusCode || 502, response.headers)
          response.pipe(outgoing)
        },
      )
      upstream.on('socket', track)
      upstream.on('error', () => {
        if (!outgoing.headersSent) outgoing.writeHead(502)
        outgoing.end()
      })
      outgoing.on('close', () => upstream.destroy())
      incoming.pipe(upstream)
    } catch {
      outgoing.writeHead(403).end()
    }
  })
  server.maxConnections = 64
  server.on('connection', track)
  server.on('connect', (request, client, head) => {
    void (async () => {
      try {
        const { url, address } = await resolve(`https://${request.url}`)
        if (closing || client.destroyed) return
        const upstream = track(
          connect({ host: address, port: Number(url.port || 443) }),
        )
        upstream.on('error', () => client.destroy())
        client.on('error', () => upstream.destroy())
        client.on('close', () => upstream.destroy())
        upstream.on('close', () => client.destroy())
        upstream.once('connect', () => {
          if (client.destroyed) {
            upstream.destroy()
            return
          }
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
          if (head.length) upstream.write(head)
          client.pipe(upstream).pipe(client)
        })
      } catch {
        client.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n')
      }
    })()
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  const port = (server.address() as { port: number }).port
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        closing = true
        for (const socket of sockets) socket.destroy()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}
