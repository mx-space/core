import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { allHeadlessNodes } from '@haklex/rich-headless'
import { createLoroBinding, type LoroBinding } from '@haklex/rich-collab-loro'
import { createHeadlessEditor } from '@lexical/headless'
import { Effect } from 'effect'
import {
  $getRoot,
  $isElementNode,
  $isTextNode,
  type LexicalEditor,
} from 'lexical'
import { LoroDoc } from 'loro-crdt'
import { afterEach, describe, expect, it } from 'vitest'

import { openAuthorDocument } from '../../../src/cli/author/document'
import { nodeSessionFs } from '../../../src/cli/author/fs'
import type { AuthorCodec } from '../../../src/cli/author/server'
import {
  type AuthorSession,
  createAuthorSession,
} from '../../../src/cli/author/session'
import { Lexical, type LexicalState } from '../../../src/services/Lexical'

const service = Effect.runSync(Effect.provide(Lexical, Lexical.Default))
const codec: AuthorCodec = {
  litexmlToLexical: (xml) => Effect.runSync(service.litexmlToPayload(xml)),
  lexicalToLitexml: (state) =>
    Effect.runSync(service.payloadToLitexml(state as LexicalState)),
}

interface Client {
  binding: LoroBinding
  doc: LoroDoc
  editor: LexicalEditor
}

const texts = (editor: LexicalEditor): string[] =>
  editor.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .map((node) => node.getTextContent()),
  )

const setBlockText = (client: Client, index: number, text: string) => {
  client.editor.update(
    () => {
      const block = $getRoot().getChildAtIndex(index)
      if (!$isElementNode(block)) throw new Error('no block')
      const first = block.getFirstChild()
      if (!$isTextNode(first)) throw new Error('no text')
      first.setTextContent(text)
    },
    { discrete: true },
  )
}

describe('createAuthorSession', () => {
  const sessions: AuthorSession[] = []
  const logs: string[] = []

  afterEach(async () => {
    while (sessions.length > 0) await sessions.pop()?.close()
    logs.length = 0
  })

  const boot = async (
    source: string,
    dir?: string,
    timing: {
      stepDelayMs?: number
      cursorLingerMs?: number
      writeDelayMs?: number
      fs?: typeof nodeSessionFs
    } = {
      stepDelayMs: 0,
    },
  ) => {
    const root = dir ?? (await mkdtemp(join(tmpdir(), 'mxs-session-')))
    const filePath = join(root, 'article.xml')
    if (!dir) await writeFile(filePath, source)
    const text = await readFile(filePath, 'utf8')
    const session = await createAuthorSession({
      doc: openAuthorDocument(filePath, text),
      codec,
      log: (line) => logs.push(line),
      ...timing,
      fs: timing.fs ?? nodeSessionFs,
    })
    sessions.push(session)
    return { dir: root, filePath, session }
  }

  const connect = (session: AuthorSession): Client => {
    const doc = new LoroDoc()
    doc.import(session.snapshot())
    const editor = createHeadlessEditor({
      nodes: allHeadlessNodes,
      onError: (err) => {
        throw err
      },
    })
    const binding = createLoroBinding(editor, doc)
    doc.subscribeLocalUpdates((bytes) => session.importUpdate(bytes))
    session.subscribe((event) => {
      if (event.type === 'update') binding.import(event.bytes)
    })
    return { binding, doc, editor }
  }

  it('serves the file content to a connecting editor', async () => {
    const { session } = await boot('<p>alpha</p><p>beta</p>')
    const client = connect(session)
    expect(texts(client.editor)).toEqual(['alpha', 'beta'])
  })

  it('writes browser edits to the file and the diff sidecar', async () => {
    const { filePath, session } = await boot('<p>alpha</p>')
    const client = connect(session)
    setBlockText(client, 0, 'alpha edited')
    await session.flush()
    expect(await readFile(filePath, 'utf8')).toContain('alpha edited')
    expect(await readFile(`${filePath}.diff`, 'utf8')).toContain(
      '+<p>alpha edited</p>',
    )
  })

  it('merges an agent file edit without reverting concurrent browser text', async () => {
    const { filePath, session } = await boot('<p>alpha</p><p>beta</p>')
    const client = connect(session)
    await session.flush()
    const agentBase = await readFile(filePath, 'utf8')
    setBlockText(client, 0, 'alpha typed in browser')
    const agentText = agentBase.replace('beta', 'beta from agent')
    await writeFile(filePath, agentText)
    session.onFileText(agentText)
    expect(texts(client.editor)).toEqual([
      'alpha typed in browser',
      'beta from agent',
    ])
    expect(logs.some((line) => line.startsWith('agent edit merged'))).toBe(true)
    await session.flush()
    const written = await readFile(filePath, 'utf8')
    expect(written).toContain('alpha typed in browser')
    expect(written).toContain('beta from agent')
  })

  it('ignores its own writes', async () => {
    const { filePath, session } = await boot('<p>alpha</p>')
    connect(session)
    await session.flush()
    session.onFileText(await readFile(filePath, 'utf8'))
    expect(logs.filter((line) => line.startsWith('agent edit'))).toEqual([])
  })

  it('rejects a broken envelope, pauses writes, and resumes once it parses', async () => {
    const envelope = (body: string) =>
      `<mxpost><meta><title>t</title></meta><content>${body}</content></mxpost>`
    const { filePath, session } = await boot(envelope('<p>alpha</p>'))
    const client = connect(session)
    await session.flush()
    const broken = '<mxpost><meta><title>t</title></meta><content><p>alpha</p>'
    await writeFile(filePath, broken)
    session.onFileText(broken)
    expect(logs.some((line) => line.startsWith('agent edit rejected'))).toBe(
      true,
    )
    expect(session.invalid()).not.toBeNull()
    setBlockText(client, 0, 'still typing')
    await session.flush()
    expect(await readFile(filePath, 'utf8')).toBe(broken)
    const fixed = envelope('<p>alpha</p><p>fixed</p>')
    await writeFile(filePath, fixed)
    session.onFileText(fixed)
    expect(session.invalid()).toBeNull()
    expect(texts(client.editor)).toEqual(['still typing', 'fixed'])
  })

  it('resumes history from the snapshot after a restart', async () => {
    const first = await boot('<p>alpha</p>')
    const client = connect(first.session)
    setBlockText(client, 0, 'alpha v2')
    await first.session.flush()
    const before = first.session.history().length
    await sessions.pop()!.close()
    const second = await boot('', first.dir)
    const reconnected = connect(second.session)
    expect(texts(reconnected.editor)).toEqual(['alpha v2'])
    expect(second.session.history().length).toBeGreaterThan(before)
    expect(
      second.session
        .history()
        .filter((entry) => entry.message?.startsWith('session')),
    ).toHaveLength(2)
  })

  it('restores an earlier version as a new change and keeps later history', async () => {
    const { filePath, session } = await boot('<p>alpha</p>')
    const client = connect(session)
    const initial = session.history()[0]!
    setBlockText(client, 0, 'alpha v2')
    const lengthBefore = session.history().length
    expect(
      (session.preview(initial.id).root.children as unknown[]).length,
    ).toBe(1)
    session.restore(initial.id)
    expect(texts(client.editor)).toEqual(['alpha'])
    expect(session.history().length).toBeGreaterThan(lengthBefore)
    expect(session.history()[0]!.message).toMatch(/^restore /)
    await session.flush()
    expect(await readFile(filePath, 'utf8')).toContain('<p>alpha</p>')
  })

  it('rejects an update from a different document lineage', async () => {
    const { session } = await boot('<p>alpha</p>')
    const client = connect(session)
    const foreign = new LoroDoc()
    const editor = createHeadlessEditor({
      nodes: allHeadlessNodes,
      onError: (err) => {
        throw err
      },
    })
    createLoroBinding(editor, foreign)
    expect(() =>
      session.importUpdate(foreign.export({ mode: 'update' })),
    ).toThrow(/different document/)
    expect(texts(client.editor)).toEqual(['alpha'])
    expect(session.lineage()).toBe(client.doc.getTree('lexical').roots()[0]!.id)
  })

  it('merges two quick agent edits without duplicating inserted blocks', async () => {
    const { filePath, session } = await boot('<p>alpha</p><p>beta</p>')
    const client = connect(session)
    const first = (await readFile(filePath, 'utf8')).replace(
      '<p>beta</p>',
      '<p>beta</p><p>inserted by agent</p>',
    )
    await writeFile(filePath, first)
    session.onFileText(first)
    const second = first.replace('<p>alpha</p>', '<p>alpha edited</p>')
    await writeFile(filePath, second)
    session.onFileText(second)
    expect(texts(client.editor)).toEqual([
      'alpha edited',
      'beta',
      'inserted by agent',
    ])
  })

  it('streams an agent edit as typed steps with an agent cursor', async () => {
    const { filePath, session } = await boot('<p>alpha</p>', undefined, {
      stepDelayMs: 1,
      cursorLingerMs: 5,
    })
    const client = connect(session)
    const events: string[] = []
    session.subscribe((event) => {
      if (event.type === 'update') events.push('update')
      if (event.type === 'cursor') events.push(event.cursor ? 'cursor' : 'hide')
    })
    const agentText = `<p>alpha</p><p>${'streamed text '.repeat(6)}</p>`
    await writeFile(filePath, agentText)
    session.onFileText(agentText)
    await session.flush()
    expect(await readFile(filePath, 'utf8')).toContain('streamed text streamed')
    await session.settled()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(events.filter((event) => event === 'update').length).toBeGreaterThan(
      3,
    )
    expect(events).toContain('cursor')
    expect(events.at(-1)).toBe('hide')
    expect(texts(client.editor)[1]).toBe('streamed text '.repeat(6))
  })

  it('keeps an agent meta-only edit through later browser autosaves', async () => {
    const envelope = (title: string, body: string) =>
      `<mxpost><meta><title>${title}</title></meta><content>${body}</content></mxpost>`
    const { filePath, session } = await boot(envelope('old', '<p>alpha</p>'))
    const client = connect(session)
    const agentText = envelope('new title', '<p>alpha</p>')
    await writeFile(filePath, agentText)
    session.onFileText(agentText)
    expect(logs.at(-1)).toBe('agent edit merged: +0 ~0 -0 blocks')
    setBlockText(client, 0, 'alpha typed later')
    await session.flush()
    const written = await readFile(filePath, 'utf8')
    expect(written).toContain('<title>new title</title>')
    expect(written).toContain('alpha typed later')
  })

  it('keeps an unprocessed agent write on disk while its stream plays', async () => {
    const { filePath, session } = await boot('<p>alpha</p>', undefined, {
      stepDelayMs: 20,
    })
    const client = connect(session)
    await session.flush()
    setBlockText(client, 0, 'alpha typed')
    const agentText = `<p>alpha</p><p>${'agent words '.repeat(8)}</p>`
    await writeFile(filePath, agentText)
    await session.flush()
    expect(await readFile(filePath, 'utf8')).toBe(agentText)
    await session.settled()
    await session.flush()
    const merged = await readFile(filePath, 'utf8')
    expect(merged).toContain('alpha typed')
    expect(merged).toContain('agent words agent words')
  })

  it('does not duplicate text when a surviving tab reconnects after a crash', async () => {
    const first = await boot('<p>alpha</p>')
    await sessions.pop()!.close()
    const crashed = await boot('', first.dir)
    const tab = connect(crashed.session)
    setBlockText(tab, 0, 'alpha typed before crash')
    await crashed.session.flush()
    const restarted = await boot('', first.dir)
    restarted.session.importUpdate(tab.doc.export({ mode: 'update' }))
    const fresh = connect(restarted.session)
    expect(texts(fresh.editor)).toEqual(['alpha typed before crash'])
  })

  it('queues a restore behind a playing stream', async () => {
    const { filePath, session } = await boot('<p>alpha</p>', undefined, {
      stepDelayMs: 5,
    })
    const client = connect(session)
    const initial = session.history()[0]!
    const agentText = `<p>alpha</p><p>${'streamed '.repeat(10)}</p>`
    await writeFile(filePath, agentText)
    session.onFileText(agentText)
    await session.restore(initial.id)
    await session.settled()
    expect(texts(client.editor)).toEqual(['alpha'])
  })

  it('logs instead of crashing when a scheduled autosave fails', async () => {
    let failing = false
    const flaky = {
      ...nodeSessionFs,
      writeFile: (path: string, data: string) =>
        failing
          ? Promise.reject(new Error('disk full'))
          : nodeSessionFs.writeFile(path, data),
    }
    const { session } = await boot('<p>alpha</p>', undefined, {
      stepDelayMs: 0,
      writeDelayMs: 5,
      fs: flaky,
    })
    const client = connect(session)
    failing = true
    setBlockText(client, 0, 'alpha typed')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(logs.some((line) => line.includes('disk full'))).toBe(true)
    failing = false
  })

  it('rejects an agent write with mismatched tags instead of re-nesting blocks', async () => {
    const { filePath, session } = await boot('<h2>Title</h2><p>para</p>')
    const client = connect(session)
    const broken = '<h2>Title</h3><p>para</p>'
    await writeFile(filePath, broken)
    session.onFileText(broken)
    expect(logs.at(-1)).toMatch(/^agent edit rejected: <\/h3> closes <h2>/)
    expect(session.invalid()).not.toBeNull()
    expect(texts(client.editor)).toEqual(['Title', 'para'])
  })
})
