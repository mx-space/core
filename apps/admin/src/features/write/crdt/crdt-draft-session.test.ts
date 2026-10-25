import { createLoroBinding } from '@haklex/rich-collab-loro'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  type LexicalEditor,
} from 'lexical'
import { LoroDoc, VersionVector } from 'loro-crdt'
import { describe, expect, it, vi } from 'vitest'

import { ApiRequestError } from '~/api/http'

import { createCrdtDraftSession } from './crdt-draft-session'
import type { CrdtTransport } from './crdt-sync'

const newEditor = () =>
  createEditor({
    onError: (error) => {
      throw error
    },
  })

const write = (editor: LexicalEditor, ...values: string[]) =>
  editor.update(
    () => {
      const root = $getRoot()
      root.clear()
      for (const value of values) {
        root.append($createParagraphNode().append($createTextNode(value)))
      }
    },
    { discrete: true },
  )

const read = (editor: LexicalEditor) =>
  editor.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .map((node) => node.getTextContent()),
  )

const seededServer = (title: string, ...values: string[]) => {
  const server = new LoroDoc()
  server.getText('title').insert(0, title)
  const editor = newEditor()
  write(editor, ...values)
  createLoroBinding(editor, server, { commitMessage: 'import 1' }).dispose()
  return server
}

const transportFor = (server: LoroDoc): CrdtTransport => ({
  pull: async (since) =>
    since
      ? server.export({ from: VersionVector.decode(since), mode: 'update' })
      : server.export({ mode: 'snapshot' }),
  push: async (bytes) => {
    server.import(bytes)
  },
})

const serverTexts = (server: LoroDoc) => {
  const editor = newEditor()
  createLoroBinding(editor, server.fork()).dispose()
  return read(editor)
}

describe('createCrdtDraftSession', () => {
  it('fills a bound editor and the title from the server document', async () => {
    const server = seededServer('Hello', 'p1')
    const onRemoteTitle = vi.fn()
    const session = await createCrdtDraftSession({
      onRemoteTitle,
      transport: transportFor(server),
    })
    const editor = newEditor()

    session.bindEditor(editor)

    expect(read(editor)).toEqual(['p1'])
    expect(onRemoteTitle).toHaveBeenCalledWith('Hello')
    session.dispose()
  })

  it('sends editor edits and title changes to the server', async () => {
    const server = seededServer('T', 'p1')
    const session = await createCrdtDraftSession({
      transport: transportFor(server),
    })
    const editor = newEditor()
    session.bindEditor(editor)

    write(editor, 'p1', 'p2')
    session.setTitle('T2')
    await session.flush()

    expect(serverTexts(server)).toEqual(['p1', 'p2'])
    expect(server.getText('title').toString()).toBe('T2')
    session.dispose()
  })

  it('pulls a remote edit into the editor and reports the remote title', async () => {
    const server = seededServer('T', 'p1')
    const onRemoteTitle = vi.fn()
    const session = await createCrdtDraftSession({
      onRemoteTitle,
      transport: transportFor(server),
    })
    const editor = newEditor()
    session.bindEditor(editor)
    const other = await createCrdtDraftSession({
      transport: transportFor(server),
    })
    const otherEditor = newEditor()
    other.bindEditor(otherEditor)
    write(otherEditor, 'p1', 'from other tab')
    other.setTitle('Other title')
    await other.flush()

    await session.pull()

    expect(read(editor)).toEqual(['p1', 'from other tab'])
    expect(onRemoteTitle).toHaveBeenLastCalledWith('Other title')
    session.dispose()
    other.dispose()
  })

  it('labels commits with the current commit message', async () => {
    const server = seededServer('T', 'p1')
    const session = await createCrdtDraftSession({
      transport: transportFor(server),
    })
    const editor = newEditor()
    session.bindEditor(editor)

    session.setCommitMessage('agent:summarize')
    write(editor, 'p1', 'agent text')
    session.setCommitMessage(null)
    write(editor, 'p1', 'agent text', 'human text')
    await session.flush()

    const messages = [...server.getAllChanges().values()]
      .flat()
      .map((change) => change.message)
    expect(messages).toContain('agent:summarize')
    expect(messages).toContain('human:owner')
    session.dispose()
  })

  it('reports a rejected update to the caller', async () => {
    const server = seededServer('T', 'p1')
    const transport = transportFor(server)
    transport.push = async () => {
      throw new ApiRequestError('no', 'DRAFT_CRDT_UPDATE_REJECTED', 400)
    }
    const onRejected = vi.fn()
    const session = await createCrdtDraftSession({ onRejected, transport })
    const editor = newEditor()
    session.bindEditor(editor)

    write(editor, 'p1', 'bad')
    await session.flush().catch(() => undefined)

    expect(onRejected).toHaveBeenCalledTimes(1)
    session.dispose()
  })
})

describe('createCrdtDraftSession adopt', () => {
  it('keeps editor content typed before binding when asked to adopt it', async () => {
    const server = seededServer('T', 'p1')
    const session = await createCrdtDraftSession({
      transport: transportFor(server),
    })
    const editor = newEditor()
    write(editor, 'p1', 'typed before bind')

    session.bindEditor(editor, { adopt: true })
    await session.flush()

    expect(read(editor)).toEqual(['p1', 'typed before bind'])
    expect(serverTexts(server)).toEqual(['p1', 'typed before bind'])
    session.dispose()
  })
})
