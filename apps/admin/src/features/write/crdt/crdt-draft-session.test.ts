import { createLoroBinding } from '@haklex/rich-collab-loro'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  type ElementNode,
  type LexicalEditor,
} from 'lexical'
import { LoroDoc, VersionVector } from 'loro-crdt'
import { describe, expect, it, vi } from 'vitest'

import { ApiRequestError } from '~/api/http'

import {
  type ChannelHooks,
  createCrdtDraftSession,
  type SessionChannel,
} from './crdt-draft-session'
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

describe('createCrdtDraftSession over a live channel', () => {
  const otherTabEdit = async (server: LoroDoc, ...values: string[]) => {
    const other = await createCrdtDraftSession({
      transport: transportFor(server),
    })
    const editor = newEditor()
    other.bindEditor(editor)
    const before = server.oplogVersion()
    write(editor, ...values)
    await other.flush()
    other.dispose()
    return server.export({ from: before, mode: 'update' })
  }

  it('applies relayed updates, including ones that land during the join', async () => {
    const server = seededServer('T', 'p1')
    const early = await otherTabEdit(server, 'p1', 'early')
    const late = await otherTabEdit(server, 'p1', 'early', 'late')
    const base = new LoroDoc()
    base.import(server.export({ mode: 'snapshot' }))
    let hooks: {
      onReconnect: () => void
      onRemote: (bytes: Uint8Array) => void
    }
    const http = transportFor(server)
    const session = await createCrdtDraftSession({
      channel: (next) => {
        hooks = next
        return {
          dispose: () => undefined,
          live: () => true,
          pull: async (since) => {
            if (!since) next.onRemote(early)
            return http.pull(since)
          },
          push: http.push,
          sendPresence: () => undefined,
        }
      },
    })
    const editor = newEditor()
    session.bindEditor(editor)

    hooks!.onRemote(late)

    expect(read(editor)).toEqual(['p1', 'early', 'late'])
    expect(session.live()).toBe(true)
    session.dispose()
  })

  it('pulls what it missed when the channel reconnects', async () => {
    const server = seededServer('T', 'p1')
    let hooks: {
      onReconnect: () => void
      onRemote: (bytes: Uint8Array) => void
    }
    const http = transportFor(server)
    const pull = vi.fn(http.pull)
    const session = await createCrdtDraftSession({
      channel: (next) => {
        hooks = next
        return {
          dispose: () => undefined,
          live: () => true,
          pull,
          push: http.push,
          sendPresence: () => undefined,
        }
      },
    })
    const editor = newEditor()
    session.bindEditor(editor)
    await otherTabEdit(server, 'p1', 'missed')

    hooks!.onReconnect()
    await vi.waitFor(() => expect(read(editor)).toEqual(['p1', 'missed']))

    expect(pull).toHaveBeenLastCalledWith(expect.any(Uint8Array))
    session.dispose()
  })
})

describe('createCrdtDraftSession presence', () => {
  const owner = { avatar: null, id: 'owner', name: 'Owner' }

  const fakeRoom = (server: LoroDoc) => {
    const members: { hooks: ChannelHooks; id: string }[] = []
    let next = 0
    const others = (id: string) => members.filter((member) => member.id !== id)
    return (hooks: ChannelHooks): SessionChannel => {
      const id = `conn-${++next}`
      return {
        dispose: () => {
          members.splice(
            members.findIndex((member) => member.id === id),
            1,
          )
          for (const member of others(id)) member.hooks.onPeerLeft?.(id)
        },
        live: () => true,
        pull: async (since) => {
          if (!members.some((member) => member.id === id)) {
            members.push({ hooks, id })
            hooks.onJoined?.(id)
            for (const member of others(id)) member.hooks.onPeerJoined?.(id)
          }
          return since
            ? server.export({
                from: VersionVector.decode(since),
                mode: 'update',
              })
            : server.export({ mode: 'snapshot' })
        },
        push: async (bytes) => {
          server.import(bytes)
          for (const member of others(id)) member.hooks.onRemote(bytes)
        },
        sendPresence: (bytes) => {
          for (const member of others(id)) member.hooks.onPresence?.(bytes)
        },
      }
    }
  }

  const caretAt = (editor: LexicalEditor, block: number, offset: number) =>
    editor.update(
      () => {
        const text = $getRoot()
          .getChildAtIndex<ElementNode>(block)!
          .getFirstDescendant()!
        ;(text as ReturnType<typeof $createTextNode>).select(offset, offset)
      },
      { discrete: true },
    )

  const textKey = (editor: LexicalEditor, block: number) =>
    editor
      .getEditorState()
      .read(() =>
        $getRoot()
          .getChildAtIndex<ElementNode>(block)!
          .getFirstDescendant()!
          .getKey(),
      )

  it('shows where the other member is typing, mapped into this editor', async () => {
    const server = seededServer('T', 'p1', 'p2')
    const room = fakeRoom(server)
    const a = await createCrdtDraftSession({
      channel: room,
      presence: { user: () => owner },
    })
    const b = await createCrdtDraftSession({
      channel: room,
      presence: { user: () => owner },
    })
    const editorA = newEditor()
    const editorB = newEditor()
    a.bindEditor(editorA)
    b.bindEditor(editorB)

    caretAt(editorA, 1, 1)

    await vi.waitFor(() => expect(b.peers()[0]?.focus).toBeTruthy())
    expect(b.peers()).toHaveLength(1)
    expect(b.resolveCaret(b.peers()[0].focus!)).toEqual({
      key: textKey(editorB, 1),
      offset: 1,
    })
    a.dispose()
    expect(b.peers()).toHaveLength(0)
    b.dispose()
  })
})

describe('createCrdtDraftSession agent turns', () => {
  const stateOf = (...values: string[]) => {
    const editor = newEditor()
    write(editor, ...values)
    return editor.getEditorState().toJSON()
  }

  it('merges an agent write at the version it read, under its own peer', async () => {
    const server = seededServer('T', 'p1', 'p2')
    const session = await createCrdtDraftSession({
      presence: { user: () => ({ avatar: null, id: 'owner', name: 'Owner' }) },
      transport: transportFor(server),
    })
    const editor = newEditor()
    session.bindEditor(editor)

    const turn = session.startAgentTurn('agent:rewrite p1')
    editor.update(
      () => {
        const text = $getRoot()
          .getChildAtIndex<ElementNode>(1)!
          .getFirstDescendant() as ReturnType<typeof $createTextNode>
        text.setTextContent('p2 human')
      },
      { discrete: true },
    )
    turn.apply(stateOf('P1 agent', 'p2'))
    turn.apply(stateOf('P1 agent', 'p2', 'p3 agent'))
    turn.end()
    await session.flush()

    expect(read(editor)).toEqual(['P1 agent', 'p2 human', 'p3 agent'])
    expect(serverTexts(server)).toEqual(['P1 agent', 'p2 human', 'p3 agent'])
    const agentPeers = [...server.getAllChanges().entries()]
      .filter(([, changes]) =>
        changes.some((change) => change.message === 'agent:rewrite p1'),
      )
      .map(([peer]) => peer)
    expect(agentPeers).toHaveLength(1)
    expect(
      server
        .getAllChanges()
        .get(agentPeers[0])!
        .every((change) => change.message === 'agent:rewrite p1'),
    ).toBe(true)
    session.dispose()
  })

  it('shows the agent as a member while its turn runs', async () => {
    const server = seededServer('T', 'p1')
    const session = await createCrdtDraftSession({
      channel: (hooks) => ({
        dispose: () => undefined,
        live: () => true,
        pull: async (since) => {
          if (!since) hooks.onJoined?.('conn-1')
          return transportFor(server).pull(since)
        },
        push: transportFor(server).push,
        sendPresence: () => undefined,
      }),
      presence: { user: () => ({ avatar: null, id: 'owner', name: 'Owner' }) },
    })
    session.bindEditor(newEditor())

    const turn = session.startAgentTurn('agent:x')
    expect(session.peers().map((peer) => peer.user.name)).toEqual(['AI'])
    turn.end()
    expect(session.peers()).toEqual([])
    session.dispose()
  })
})
