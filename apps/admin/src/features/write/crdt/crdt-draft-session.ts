import {
  createLoroBinding,
  type LoroBinding,
  TREE_NAME,
} from '@haklex/rich-collab-loro'
import { editDocAt, type Frontiers } from '@mx-space/editor/loro'
import {
  $getSelection,
  $isRangeSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  type LexicalEditor,
  type NodeKey,
  type PointType,
  type SerializedEditorState,
} from 'lexical'
import { LoroDoc, type LoroTreeNode } from 'loro-crdt'

import type { ApiRequestError } from '~/api/http'

import type { CollabChannel } from './collab-channel'
import {
  type CaretPoint,
  createCollabPresence,
  type IncomingPresence,
  type RemotePresence,
} from './collab-presence'
import {
  type CrdtSync,
  type CrdtSyncStatus,
  type CrdtTransport,
  createCrdtSync,
} from './crdt-sync'

const HUMAN_MESSAGE = 'human:owner'
const TITLE = 'title'
const CARET_DEBOUNCE_MS = 50
const TEXT_KEY = '#text'

export interface AgentTurn {
  apply: (target: SerializedEditorState, focusBlockId?: string) => void
  end: () => void
  markView: () => void
}

const randomPeer = (): `${number}` => {
  const [value] = crypto.getRandomValues(new BigUint64Array(1))
  return `${value}` as `${number}`
}

const lastTextIn = (node: LoroTreeNode): CaretPoint | null => {
  const children = node.children() ?? []
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const found = lastTextIn(children[index])
    if (found) return found
  }
  const text = node.data.get(TEXT_KEY)
  return text === undefined
    ? null
    : { id: node.id, offset: String(text).length }
}

const caretAtBlock = (doc: LoroDoc, blockId: string): CaretPoint | null => {
  for (const node of doc.getTree(TREE_NAME).nodes()) {
    const state = node.data.get('$') as { blockId?: string } | undefined
    if (state?.blockId === blockId && !node.isDeleted()) {
      return lastTextIn(node) ?? { id: node.id, offset: 0 }
    }
  }
  return null
}

export interface ChannelHooks {
  onJoined?: (connectionId: string) => void
  onPeerJoined?: (connectionId: string) => void
  onPeerLeft?: (connectionId: string) => void
  onPresence?: (frame: IncomingPresence) => void
  onReconnect: () => void
  onRemote: (bytes: Uint8Array) => void
  onRevoked?: () => void
}

export type SessionChannel = Pick<
  CollabChannel,
  'dispose' | 'live' | 'pull' | 'push' | 'sendPresence'
>

export interface CrdtDraftSessionOptions {
  author?: string
  channel?: (hooks: ChannelHooks) => SessionChannel
  onRejected?: (error: ApiRequestError) => void
  onRemoteTitle?: (title: string) => void
  onRevoked?: () => void
  onStatus?: (status: CrdtSyncStatus) => void
  presence?: boolean
  transport?: CrdtTransport
}

export interface BindOptions {
  adopt?: boolean
}

export interface CrdtDraftSession {
  bindEditor: (editor: LexicalEditor | null, options?: BindOptions) => void
  dispose: () => void
  flush: () => Promise<void>
  live: () => boolean
  peers: () => RemotePresence[]
  pending: () => boolean
  pull: () => Promise<void>
  resolveCaret: (point: CaretPoint) => { key: NodeKey; offset: number } | null
  setTitle: (title: string) => void
  startAgentTurn: (message: string) => AgentTurn
  subscribePeers: (listener: (peers: RemotePresence[]) => void) => () => void
}

export async function createCrdtDraftSession(
  options: CrdtDraftSessionOptions,
): Promise<CrdtDraftSession> {
  const doc = new LoroDoc()
  doc.setRecordTimestamp(true)
  const bindingOptions = { commitMessage: options.author ?? HUMAN_MESSAGE }
  let binding: LoroBinding | null = null
  let lastTitle: string | null = null

  const reportTitle = () => {
    const title = doc.getText(TITLE).toString()
    if (title === lastTitle) return
    lastTitle = title
    options.onRemoteTitle?.(title)
  }

  let sync: CrdtSync | null = null
  let disposed = false
  const early: Uint8Array[] = []
  let reconnected = false
  const presence = createCollabPresence({
    send: (frame) => channel?.sendPresence(frame),
  })
  let caretTimer: ReturnType<typeof setTimeout> | undefined
  let stopCaret: (() => void) | null = null

  const pointOf = (point: PointType): CaretPoint | null => {
    const id = binding?.idOf(point.key)
    return id ? { id, offset: point.offset } : null
  }

  const trackCaret = (editor: LexicalEditor) => {
    const report = () => {
      const caret = editor.getEditorState().read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return null
        return {
          anchor: pointOf(selection.anchor),
          focus: pointOf(selection.focus),
        }
      })
      presence.setCursor(caret?.anchor ?? null, caret?.focus ?? null)
    }
    const offUpdate = editor.registerUpdateListener(() => {
      clearTimeout(caretTimer)
      caretTimer = setTimeout(report, CARET_DEBOUNCE_MS)
    })
    const offBlur = editor.registerCommand(
      BLUR_COMMAND,
      () => {
        clearTimeout(caretTimer)
        presence.setCursor(null, null)
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
    return () => {
      clearTimeout(caretTimer)
      offUpdate()
      offBlur()
    }
  }

  const channel: SessionChannel | undefined = options.channel?.({
    onJoined: () => {
      if (options.presence) presence.start()
    },
    onPeerJoined: () => presence.announce(),
    onPeerLeft: (connectionId) => presence.removeConnection(connectionId),
    onPresence: (frame) => presence.apply(frame),
    onRevoked: () => options.onRevoked?.(),
    onReconnect: () => {
      if (sync) void sync.pull().catch(() => undefined)
      else reconnected = true
    },
    onRemote: (bytes) => {
      if (sync) sync.receive(bytes)
      else early.push(bytes)
    },
  })
  const transport = channel ?? options.transport
  if (!transport) throw new Error('A CRDT session needs a transport')

  try {
    sync = await createCrdtSync({
      apply: (bytes) => {
        if (binding) binding.import(bytes)
        else doc.import(bytes)
        reportTitle()
      },
      doc,
      onRejected: options.onRejected,
      onStatus: options.onStatus,
      transport,
    })
  } catch (error) {
    channel?.dispose()
    presence.dispose()
    throw error
  }
  const ready = sync
  for (const bytes of early.splice(0)) ready.receive(bytes)
  if (reconnected) void ready.pull().catch(() => undefined)
  reportTitle()

  return {
    bindEditor: (editor, bind) => {
      stopCaret?.()
      stopCaret = null
      binding?.dispose()
      binding = null
      if (!editor) return
      const kept = bind?.adopt ? editor.getEditorState() : null
      binding = createLoroBinding(editor, doc, bindingOptions)
      if (kept) editor.setEditorState(kept)
      stopCaret = trackCaret(editor)
    },
    dispose: () => {
      disposed = true
      stopCaret?.()
      stopCaret = null
      binding?.dispose()
      binding = null
      ready.dispose()
      channel?.dispose()
      presence.dispose()
    },
    flush: () => ready.flush(),
    live: () => channel?.live() ?? false,
    peers: () => presence.remotes(),
    pending: () => ready.pending(),
    pull: () => ready.pull(),
    resolveCaret: (point) => {
      const key = binding?.keyOf(point.id as never)
      return key ? { key, offset: point.offset } : null
    },
    setTitle: (title) => {
      const text = doc.getText(TITLE)
      if (text.toString() === title) return
      lastTitle = title
      text.update(title)
      doc.commit({ message: bindingOptions.commitMessage })
    },
    startAgentTurn: (message) => {
      const peer = randomPeer()
      const key = `agent:${peer}`
      let title = doc.getText(TITLE).toString()
      let view: Frontiers = doc.frontiers()
      let ended = false
      presence.setExtra(key, { anchor: null, focus: null })
      return {
        apply: (target, focusBlockId) => {
          if (ended || disposed) {
            throw new Error(
              'The document session for this agent turn has closed',
            )
          }
          const update = editDocAt(
            doc,
            view,
            { content: JSON.stringify(target), title },
            message,
            { peer },
          )
          if (binding) binding.import(update)
          else doc.import(update)
          // Imported ops are not local updates to the sync loop, so ask it to send them.
          ready.touch()
          const end = doc.oplogVersion().get(peer)
          if (end) view = [{ counter: end - 1, peer }]
          presence.setExtra(key, {
            anchor: null,
            focus: focusBlockId ? caretAtBlock(doc, focusBlockId) : null,
          })
        },
        end: () => {
          if (ended) return
          ended = true
          if (!disposed) presence.setExtra(key, null)
        },
        markView: () => {
          view = doc.frontiers()
          title = doc.getText(TITLE).toString()
        },
      }
    },
    subscribePeers: (listener) => presence.subscribe(listener),
  }
}
