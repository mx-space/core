import { spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'

import {
  createContentDoc,
  readDocContent,
} from '@mx-space/editor/loro'
import { LoroDoc } from 'loro-crdt'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocketServer } from 'ws'

import { makeTmpHome } from './_helpers'

const bin =
  process.env.MXS_TEST_BIN ??
  fileURLToPath(new URL('../../src/bin/mxs.ts', import.meta.url))

interface Frame {
  v: number
  event: string
  payload?: any
  id?: string
}

const paragraph = (text: string) => ({
  children: [
    { detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 },
  ],
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
})

const seedDoc = () =>
  createContentDoc(
    {
      content: JSON.stringify({
        root: {
          children: [
            { ...paragraph('背景'), tag: 'h2', type: 'heading' },
            paragraph('第一段，价格 $5/月。'),
            paragraph('第二段。'),
          ],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      }),
      fields: {
        meta: null,
        typeSpecificData: { categoryId: 'c1', slug: 'hello', tags: ['a'] },
      },
      title: '测试文章',
    },
    'init',
  )

const blockIds = (doc: LoroDoc) =>
  (
    JSON.parse(readDocContent(doc).content).root.children as {
      $?: { blockId?: string }
    }[]
  ).map((child) => child.$?.blockId ?? '')

interface Fake {
  server: Server
  doc: LoroDoc
  frames: Frame[]
  http: { method: string; url: string }[]
  presenceOnJoin: unknown[]
  url: string
}

async function startFake(): Promise<Fake> {
  const doc = seedDoc()
  const fake: Fake = {
    server: createServer(),
    doc,
    frames: [],
    http: [],
    presenceOnJoin: [],
    url: '',
  }
  fake.server.on('request', (req, res) => {
    fake.http.push({ method: req.method!, url: req.url! })
    res.setHeader('content-type', 'application/json')
    if (req.url?.startsWith('/api/v2/categories')) {
      res.end(
        JSON.stringify({ data: [{ id: 'c1', name: '技术', slug: 'tech' }] }),
      )
      return
    }
    res.statusCode = 404
    res.end(JSON.stringify({ message: 'not found' }))
  })
  const wss = new WebSocketServer({ server: fake.server, path: '/ws/admin' })
  wss.on('connection', (ws) => {
    const send = (frame: Frame) => ws.send(JSON.stringify(frame))
    send({ v: 1, event: 'gateway.connect', payload: 'WebSocket connected' })
    ws.on('message', (raw) => {
      const frame = JSON.parse(String(raw)) as Frame
      fake.frames.push(frame)
      const ack = (payload: unknown) =>
        send({ v: 1, event: 'ack', id: frame.id, payload })
      if (frame.event === 'collab.join') {
        ack({
          ok: true,
          data: {
            connectionId: 'conn-cli',
            documentId: 'doc-1',
            update: Buffer.from(fake.doc.export({ mode: 'snapshot' })).toString(
              'base64',
            ),
          },
        })
        for (const presence of fake.presenceOnJoin) {
          send({ v: 1, event: 'collab.presence', payload: presence })
        }
        return
      }
      if (frame.event === 'collab.update') {
        fake.doc.import(new Uint8Array(Buffer.from(frame.payload.update, 'base64')))
      }
      ack({ ok: true })
    })
  })
  await new Promise<void>((resolve) =>
    fake.server.listen(0, '127.0.0.1', resolve),
  )
  fake.url = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}/api/v2`
  return fake
}

function run(fake: Fake, args: string[], stdin?: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn('npx', ['tsx', bin, '--api-url', fake.url, ...args], {
        env: { ...process.env, CLAUDECODE: '1', AI_AGENT: '' },
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk) => (stdout += chunk))
      child.stderr.on('data', (chunk) => (stderr += chunk))
      child.on('error', reject)
      child.on('close', (code) => resolve({ code, stdout, stderr }))
      child.stdin.end(stdin ?? '')
    },
  )
}

let fake: Fake
let cleanup: () => void

beforeEach(async () => {
  cleanup = makeTmpHome()
  fake = await startFake()
})

afterEach(async () => {
  await new Promise<void>((resolve) => fake.server.close(() => resolve()))
  cleanup()
})

describe('mxs draft cat', () => {
  it('prints the envelope with metadata and block ids', async () => {
    const { code, stdout, stderr } = await run(fake, ['draft', 'cat', 'd1'])
    expect(stderr).not.toMatch(/error/i)
    expect(code).toBe(0)
    expect(stdout).toContain('<title>测试文章</title>')
    expect(stdout).toContain('<category>tech</category>')
    expect(stdout).toContain(`<p id="${blockIds(fake.doc)[1]}">第一段，价格 $5/月。</p>`)
    expect(fake.frames[0]).toMatchObject({ event: 'collab.join', payload: { draftId: 'd1' } })
  }, 60_000)

  it('prints an outline', async () => {
    const { code, stdout } = await run(fake, ['draft', 'cat', 'd1', '--outline'])
    expect(code).toBe(0)
    expect(stdout).toContain('# 测试文章')
    expect(stdout).toContain(`## 背景 [${blockIds(fake.doc)[0]}] — 2 blocks`)
  }, 60_000)

  it('prints the latest human selection from presence', async () => {
    const ids = blockIds(fake.doc)
    const human = (connectionId: string, at: number, id: string) => ({
      caret: { anchor: null, focus: null, selection: { at, blocks: [{ id }], collapsed: false } },
      connectionId,
      documentId: 'doc-1',
      entry: null,
      user: { avatar: null, id: 'owner', name: 'Innei' },
    })
    fake.presenceOnJoin = [human('tab-1', 100, ids[1]), human('tab-2', 200, ids[2])]
    const { code, stdout } = await run(fake, ['draft', 'cat', 'd1', '--selection'])
    expect(code).toBe(0)
    expect(stdout).toContain('第二段。')
    expect(stdout).not.toContain('第一段')
  }, 60_000)

  it('says so when nobody has a selection', async () => {
    const { code, stdout } = await run(fake, ['draft', 'cat', 'd1', '--selection'])
    expect(code).toBe(0)
    expect(stdout).toMatch(/no selection/i)
  }, 60_000)
})

const patchBlock = (search: string, replace: string) =>
  `<<<<<<< SEARCH\n${search}\n=======\n${replace}\n>>>>>>> REPLACE\n`

const waitFor = async (check: () => boolean, ms = 5000) => {
  const until = Date.now() + ms
  while (!check() && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return check()
}

const updates = (fake: Fake) => fake.frames.filter((f) => f.event === 'collab.update')

describe('mxs draft patch', () => {
  it('applies a block as one agent update and leaves other blocks alone', async () => {
    const ids = blockIds(fake.doc)
    const { code, stdout, stderr } = await run(
      fake,
      ['draft', 'patch', 'd1'],
      patchBlock(
        `<p id="${ids[1]}">第一段，价格 $5/月。</p>`,
        `<p id="${ids[1]}">第一段改写，价格 $5/月 &amp; 年付。</p>`,
      ),
    )
    expect(stderr).not.toMatch(/error/i)
    expect(code).toBe(0)
    expect(stdout).toMatch(/applied/)
    expect(updates(fake)).toHaveLength(1)
    const texts = (
      JSON.parse(readDocContent(fake.doc).content).root.children as {
        children: { text: string }[]
      }[]
    ).map((c) => c.children.map((t) => t.text).join(''))
    expect(texts).toEqual(['背景', '第一段改写，价格 $5/月 & 年付。', '第二段。'])
    const messages = [...fake.doc.getAllChanges().values()]
      .flat()
      .map((change) => change.message)
    expect(messages.some((m) => m?.startsWith('agent:'))).toBe(true)
  }, 60_000)

  it('leaves blocks the patch did not touch exactly as they were', async () => {
    const ids = blockIds(fake.doc)
    const children = () =>
      JSON.parse(readDocContent(fake.doc).content).root.children as unknown[]
    const [heading, first] = children()
    const { code } = await run(
      fake,
      ['draft', 'patch', 'd1'],
      patchBlock(`<p id="${ids[2]}">第二段。</p>`, `<p id="${ids[2]}">第二段，改。</p>`),
    )
    expect(code).toBe(0)
    expect(children().slice(0, 2)).toEqual([heading, first])
  }, 60_000)

  it('refuses a stale SEARCH, shows the current block and sends nothing', async () => {
    const ids = blockIds(fake.doc)
    const { code, stdout, stderr } = await run(
      fake,
      ['draft', 'patch', 'd1'],
      patchBlock(`<p id="${ids[1]}">第一段，已被人改过。</p>`, `<p id="${ids[1]}">x</p>`),
    )
    expect(code).toBe(1)
    expect(stdout + stderr).toMatch(/not found/)
    expect(stdout + stderr).toContain('第一段，价格 $5/月。')
    expect(updates(fake)).toHaveLength(0)
  }, 60_000)

  it('writes metadata edits in the same Loro update, without HTTP writes', async () => {
    const { code, stdout } = await run(
      fake,
      ['draft', 'patch', 'd1'],
      patchBlock('<slug>hello</slug>', '<slug>world</slug>'),
    )
    expect(code).toBe(0)
    expect(stdout).toContain('meta: slug')
    expect(updates(fake)).toHaveLength(1)
    expect(readDocContent(fake.doc).fields?.typeSpecificData).toMatchObject({ slug: 'world' })
    expect(fake.http.filter((r) => r.method !== 'GET')).toEqual([])
  }, 60_000)

  it('rejects a replacement whose tag the editor would drop', async () => {
    const ids = blockIds(fake.doc)
    const { code, stdout, stderr } = await run(
      fake,
      ['draft', 'patch', 'd1'],
      patchBlock(`<p id="${ids[2]}">第二段。</p>`, `<p id="${ids[2]}">第二段 <blink>闪</blink></p>`),
    )
    expect(code).not.toBe(0)
    expect(stdout + stderr).toContain('<blink>')
    expect(updates(fake)).toHaveLength(0)
  }, 60_000)

  it('shows an agent caret named after the detected agent', async () => {
    const ids = blockIds(fake.doc)
    await run(
      fake,
      ['draft', 'patch', 'd1'],
      patchBlock(`<p id="${ids[2]}">第二段。</p>`, `<p id="${ids[2]}">第二段，改。</p>`),
    )
    const seen = await waitFor(() =>
      fake.frames.some((f) => f.event === 'collab.presence' && /^agent:/.test(f.payload?.entry ?? '')),
    )
    expect(seen).toBe(true)
    const frame = fake.frames.find((f) => f.event === 'collab.presence')!
    expect(frame.payload.caret.label).toBe('Claude Code')
    expect(frame.payload.caret.focus).toMatchObject({ offset: '第二段，改。'.length })
  }, 60_000)
})
