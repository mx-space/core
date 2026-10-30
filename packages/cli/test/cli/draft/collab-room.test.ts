import type { AddressInfo } from 'node:net'

import { LoroDoc } from 'loro-crdt'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocketServer } from 'ws'

import {
  gatewayUrlFor,
  openRoom,
  RoomAuthError,
  RoomError,
} from '../../../src/cli/draft/collab/room'

interface Frame {
  v: number
  event: string
  payload?: any
  id?: string
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

function seededDoc() {
  const doc = new LoroDoc()
  doc.getText('title').insert(0, 'Hello')
  doc.commit()
  return doc
}

function startServer(options: {
  token?: string
  joinPresence?: Frame['payload'][]
  rejectUpdate?: string
} = {}) {
  const wss = new WebSocketServer({ port: 0 })
  const received: Frame[] = []
  const headers: Record<string, string | string[] | undefined>[] = []
  const doc = seededDoc()
  wss.on('connection', (ws, req) => {
    headers.push(req.headers)
    const send = (frame: Frame) => ws.send(JSON.stringify(frame))
    if (req.headers.authorization !== `Bearer ${options.token ?? 'good'}`) {
      send({ v: 1, event: 'auth.failed', payload: 'Authentication failed' })
      ws.close(4401, 'auth failed')
      return
    }
    send({ v: 1, event: 'gateway.connect', payload: 'WebSocket connected' })
    ws.on('message', (raw) => {
      const frame = JSON.parse(String(raw)) as Frame
      received.push(frame)
      const ack = (payload: unknown) =>
        send({ v: 1, event: 'ack', id: frame.id, payload })
      if (frame.event === 'collab.join') {
        ack({
          ok: true,
          data: {
            connectionId: 'conn-cli',
            documentId: 'doc-1',
            update: b64(doc.export({ mode: 'snapshot' })),
          },
        })
        for (const presence of options.joinPresence ?? []) {
          send({ v: 1, event: 'collab.presence', payload: presence })
        }
      } else if (frame.event === 'collab.update') {
        ack(
          options.rejectUpdate
            ? { ok: false, code: options.rejectUpdate }
            : { ok: true },
        )
      } else {
        ack({ ok: true })
      }
    })
  })
  const url = () =>
    `ws://127.0.0.1:${(wss.address() as AddressInfo).port}/ws/admin`
  return { wss, received, headers, url }
}

let servers: WebSocketServer[] = []
afterEach(async () => {
  await Promise.all(
    servers.map((s) => new Promise((resolve) => s.close(resolve))),
  )
  servers = []
})

function server(options?: Parameters<typeof startServer>[0]) {
  const s = startServer(options)
  servers.push(s.wss)
  return s
}

describe('gatewayUrlFor', () => {
  it('maps an https api base with a version prefix to the admin socket', () => {
    expect(gatewayUrlFor('https://mx.example.com/api/v2')).toBe(
      'wss://mx.example.com/ws/admin',
    )
  })

  it('keeps a path prefix in front of the api version', () => {
    expect(gatewayUrlFor('https://host.dev/mx/api/v2')).toBe(
      'wss://host.dev/mx/ws/admin',
    )
  })

  it('prefers the gateway url the server advertises', () => {
    expect(
      gatewayUrlFor('https://mx.example.com/api/v2', 'https://gw.example.com/'),
    ).toBe('wss://gw.example.com/ws/admin')
  })

  it('ignores an advertised loopback gateway when the api is remote', () => {
    expect(
      gatewayUrlFor('https://mx.example.com/api/v2', 'http://localhost:2333'),
    ).toBe('wss://mx.example.com/ws/admin')
  })

  it('maps a local http api base', () => {
    expect(gatewayUrlFor('http://127.0.0.1:2333')).toBe(
      'ws://127.0.0.1:2333/ws/admin',
    )
  })
})

describe('openRoom', () => {
  it('joins with the auth headers and imports the snapshot', async () => {
    const s = server()
    const room = await openRoom({
      url: s.url(),
      headers: { authorization: 'Bearer good' },
      draftId: 'draft-1',
    })
    try {
      expect(room.doc.getText('title').toString()).toBe('Hello')
      expect(room.documentId).toBe('doc-1')
      expect(s.headers[0].authorization).toBe('Bearer good')
      expect(s.received[0]).toMatchObject({
        event: 'collab.join',
        payload: { draftId: 'draft-1' },
      })
    } finally {
      room.close()
    }
  })

  it('throws RoomAuthError when the server closes with 4401', async () => {
    const s = server()
    await expect(
      openRoom({
        url: s.url(),
        headers: { authorization: 'Bearer bad' },
        draftId: 'draft-1',
      }),
    ).rejects.toBeInstanceOf(RoomAuthError)
  })

  it('pushes an update and resolves with the ack', async () => {
    const s = server()
    const room = await openRoom({
      url: s.url(),
      headers: { authorization: 'Bearer good' },
      draftId: 'draft-1',
    })
    try {
      const update = new Uint8Array([1, 2, 3])
      await room.push(update)
      const sent = s.received.find((f) => f.event === 'collab.update')
      expect(sent?.payload).toEqual({ draftId: 'draft-1', update: b64(update) })
    } finally {
      room.close()
    }
  })

  it('turns a rejected update into a RoomError carrying the code', async () => {
    const s = server({ rejectUpdate: 'DRAFT_CRDT_UPDATE_REJECTED' })
    const room = await openRoom({
      url: s.url(),
      headers: { authorization: 'Bearer good' },
      draftId: 'draft-1',
    })
    try {
      await expect(room.push(new Uint8Array([1]))).rejects.toMatchObject({
        code: 'DRAFT_CRDT_UPDATE_REJECTED',
      })
      await expect(room.push(new Uint8Array([1]))).rejects.toBeInstanceOf(
        RoomError,
      )
    } finally {
      room.close()
    }
  })

  it('collects presence frames other members send after the join', async () => {
    const presence = {
      caret: { anchor: null, focus: null, selection: { at: 1, blocks: [] } },
      connectionId: 'conn-browser',
      documentId: 'doc-1',
      entry: null,
      user: { avatar: null, id: 'owner', name: 'Innei' },
    }
    const s = server({ joinPresence: [presence] })
    const room = await openRoom({
      url: s.url(),
      headers: { authorization: 'Bearer good' },
      draftId: 'draft-1',
    })
    try {
      await room.waitForPresence(200)
      expect(room.presences()).toEqual([presence])
    } finally {
      room.close()
    }
  })

  it('sends presence for an agent entry', async () => {
    const s = server()
    const room = await openRoom({
      url: s.url(),
      headers: { authorization: 'Bearer good' },
      draftId: 'draft-1',
    })
    try {
      await room.presence({ caret: { label: 'Claude Code' }, entry: 'agent:r1' })
      expect(s.received.at(-1)).toMatchObject({
        event: 'collab.presence',
        payload: {
          caret: { label: 'Claude Code' },
          draftId: 'draft-1',
          entry: 'agent:r1',
        },
      })
    } finally {
      room.close()
    }
  })
})
