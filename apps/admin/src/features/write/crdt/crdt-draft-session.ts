import { createLoroBinding, type LoroBinding } from '@haklex/rich-collab-loro'
import {
  $getSelection,
  $isRangeSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  type LexicalEditor,
  type NodeKey,
  type PointType,
} from 'lexical'
import { LoroDoc } from 'loro-crdt'

import type { ApiRequestError } from '~/api/http'

import type { CollabChannel } from './collab-channel'
import {
  type CaretPoint,
  createCollabPresence,
  type PresenceUser,
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

export interface ChannelHooks {
  onJoined?: (connectionId: string) => void
  onPeerJoined?: (connectionId: string) => void
  onPeerLeft?: (connectionId: string) => void
  onPresence?: (state: Uint8Array) => void
  onReconnect: () => void
  onRemote: (bytes: Uint8Array) => void
}

export type SessionChannel = Pick<
  CollabChannel,
  'dispose' | 'live' | 'pull' | 'push' | 'sendPresence'
>

export interface CrdtDraftSessionOptions {
  channel?: (hooks: ChannelHooks) => SessionChannel
  onRejected?: (error: ApiRequestError) => void
  onRemoteTitle?: (title: string) => void
  onStatus?: (status: CrdtSyncStatus) => void
  presence?: { user: () => PresenceUser }
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
  setCommitMessage: (message: string | null) => void
  setTitle: (title: string) => void
  subscribePeers: (listener: (peers: RemotePresence[]) => void) => () => void
}

export async function createCrdtDraftSession(
  options: CrdtDraftSessionOptions,
): Promise<CrdtDraftSession> {
  const doc = new LoroDoc()
  doc.setRecordTimestamp(true)
  // The binding reads `commitMessage` on every commit, so mutating it relabels later edits.
  const bindingOptions = { commitMessage: HUMAN_MESSAGE }
  let binding: LoroBinding | null = null
  let lastTitle: string | null = null

  const reportTitle = () => {
    const title = doc.getText(TITLE).toString()
    if (title === lastTitle) return
    lastTitle = title
    options.onRemoteTitle?.(title)
  }

  let sync: CrdtSync | null = null
  const early: Uint8Array[] = []
  const presence = createCollabPresence({
    send: (bytes) => channel?.sendPresence(bytes),
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
    onJoined: (connectionId) => {
      if (options.presence)
        presence.start(connectionId, options.presence.user())
    },
    onPeerJoined: () => presence.announce(),
    onPeerLeft: (connectionId) => presence.remove(connectionId),
    onPresence: (state) => presence.apply(state),
    onReconnect: () => {
      void sync?.pull().catch(() => undefined)
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
    setCommitMessage: (message) => {
      bindingOptions.commitMessage = message ?? HUMAN_MESSAGE
    },
    setTitle: (title) => {
      const text = doc.getText(TITLE)
      if (text.toString() === title) return
      lastTitle = title
      text.update(title)
      doc.commit({ message: bindingOptions.commitMessage })
    },
    subscribePeers: (listener) => presence.subscribe(listener),
  }
}
