import { createLoroBinding, type LoroBinding } from '@haklex/rich-collab-loro'
import { blockIdState } from '@haklex/rich-editor'
import {
  caretAtBlock,
  type DocFields,
  type DocFieldsPatch,
  editDocAt,
  editDocFields,
  type Frontiers,
  readDocFields,
} from '@mx-space/editor/loro'
import {
  $getSelection,
  $getState,
  $isElementNode,
  $isRangeSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type PointType,
  type RangeSelection,
  type SerializedEditorState,
} from 'lexical'
import { LoroDoc } from 'loro-crdt'

import type { ApiRequestError } from '~/api/http'

import type { CollabChannel } from './collab-channel'
import {
  type CaretPoint,
  createCollabPresence,
  type IncomingPresence,
  type RemotePresence,
  type SelectedBlock,
  type SelectionInput,
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
const MAX_SELECTED_BLOCKS = 50

export interface AgentTurn {
  apply: (target: SerializedEditorState, focusBlockId?: string) => void
  end: () => void
  markView: () => void
}

const randomPeer = (): `${number}` => {
  const [value] = crypto.getRandomValues(new BigUint64Array(1))
  return `${value}` as `${number}`
}

const offsetInBlock = (point: PointType, block: LexicalNode) => {
  if (point.type !== 'text' || !$isElementNode(block)) return undefined
  const target = point.getNode()
  let offset = point.offset
  for (const text of block.getAllTextNodes()) {
    if (text.is(target)) return offset
    offset += text.getTextContentSize()
  }
  return undefined
}

const $selectionOf = (selection: RangeSelection): SelectionInput => {
  const [start, end] = selection.isBackward()
    ? [selection.focus, selection.anchor]
    : [selection.anchor, selection.focus]
  const startBlock = start.getNode().getTopLevelElement()
  const endBlock = end.getNode().getTopLevelElement()
  const seen = new Set<NodeKey>()
  const blocks: SelectedBlock[] = []
  for (const node of selection.getNodes()) {
    const block = node.getTopLevelElement()
    if (!block || seen.has(block.getKey())) continue
    seen.add(block.getKey())
    const id = $getState(block, blockIdState)
    if (!id) continue
    blocks.push({
      ...(block.is(startBlock) && { startOffset: offsetInBlock(start, block) }),
      ...(block.is(endBlock) && { endOffset: offsetInBlock(end, block) }),
      id,
    })
  }
  return {
    blocks: blocks.slice(0, MAX_SELECTED_BLOCKS),
    collapsed: selection.isCollapsed(),
  }
}

export interface ChannelHooks {
  onJoined?: (connectionId: string) => void
  onPeerJoined?: (connectionId: string) => void
  onPeerLeft?: (connectionId: string) => void
  onPresence?: (frame: IncomingPresence) => void
  onReconnect: () => void
  onRemote: (bytes: Uint8Array) => void
  onReset?: () => void
  onRevoked?: (reason?: string) => void
}

export type SessionChannel = Pick<
  CollabChannel,
  'dispose' | 'live' | 'pull' | 'push' | 'sendPresence'
>

export interface CrdtDraftSessionOptions {
  author?: string
  channel?: (hooks: ChannelHooks) => SessionChannel
  onRejected?: (error: ApiRequestError) => void
  onRemoteFields?: (fields: DocFields) => void
  onRemoteTitle?: (title: string) => void
  onReset?: () => void
  onRevoked?: (reason?: string) => void
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
  fields: () => DocFields | undefined
  setFields: (patch: DocFieldsPatch) => void
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

  let lastFields: string | null = null
  const reportFields = () => {
    const fields = readDocFields(doc)
    const key = JSON.stringify(fields ?? null)
    if (key === lastFields) return
    lastFields = key
    if (fields) options.onRemoteFields?.(fields)
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
          selection: $selectionOf(selection),
        }
      })
      presence.setCursor(
        caret?.anchor ?? null,
        caret?.focus ?? null,
        caret?.selection,
      )
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
    onReset: () => options.onReset?.(),
    onRevoked: (reason) => options.onRevoked?.(reason),
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
        reportFields()
      },
      doc,
      onGone: () => options.onRevoked?.('deleted'),
      onRejected: options.onRejected,
      onStale: () => options.onReset?.(),
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
  reportFields()

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
    fields: () => readDocFields(doc),
    flush: () => ready.flush(),
    live: () => channel?.live() ?? false,
    peers: () => presence.remotes(),
    pending: () => ready.pending(),
    pull: () => ready.pull(),
    resolveCaret: (point) => {
      const key = binding?.keyOf(point.id as never)
      return key ? { key, offset: point.offset } : null
    },
    setFields: (patch) => {
      const update = editDocFields(
        doc,
        doc.frontiers(),
        patch,
        bindingOptions.commitMessage,
        { peer: doc.peerIdStr },
      )
      if (!update.length) return
      if (binding) binding.import(update)
      else doc.import(update)
      lastFields = JSON.stringify(readDocFields(doc) ?? null)
      ready.touch()
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
