import {
  $reconcileRoot,
  createLoroBinding,
  editAtVersion,
} from '@haklex/rich-collab-loro'
import { LoroDoc, type OpId } from 'loro-crdt'

import type { LexicalState } from '../../services/Lexical'
import { annotateDiffNotes, resolveDiffNotes } from './diff-note'
import {
  applyAuthorBody,
  type AuthorDocument,
  type AuthorFs,
  currentAuthorBody,
  diffLines,
  persistAuthorSave,
} from './document'
import { createAuthorHeadlessEditor } from './headless'
import type { AuthorCodec } from './server'

export interface SessionFs extends AuthorFs {
  readonly readFile: (path: string) => Promise<Uint8Array | undefined>
  readonly writeBinary: (path: string, data: Uint8Array) => Promise<void>
}

export interface HistoryEntry {
  readonly id: OpId
  readonly lamport: number
  readonly timestamp: number
  readonly message: string | undefined
}

export type AuthorEvent =
  | { readonly type: 'update'; readonly bytes: Uint8Array }
  | { readonly type: 'status'; readonly invalid: string | null }

export interface AuthorSessionOptions {
  readonly doc: AuthorDocument
  readonly codec: AuthorCodec
  readonly fs: SessionFs
  readonly base?: LexicalState
  readonly log?: (line: string) => void
  readonly writeDelayMs?: number
  readonly snapshotIntervalMs?: number
}

export interface AuthorSession {
  readonly snapshot: () => Uint8Array
  readonly importUpdate: (bytes: Uint8Array) => void
  readonly onFileText: (text: string) => void
  readonly subscribe: (listener: (event: AuthorEvent) => void) => () => void
  readonly flush: () => Promise<void>
  readonly history: () => HistoryEntry[]
  readonly preview: (id: OpId) => LexicalState
  readonly restore: (id: OpId) => void
  readonly invalid: () => string | null
  readonly close: () => Promise<void>
}

const WRITTEN_LIMIT = 50

const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

const blockStats = (before: LexicalState, after: LexicalState): string => {
  const ops = diffLines(
    before.root.children.map((block) => JSON.stringify(block)),
    after.root.children.map((block) => JSON.stringify(block)),
  )
  const added = ops.filter(([type]) => type === 'add').length
  const removed = ops.filter(([type]) => type === 'del').length
  const changed = Math.min(added, removed)
  return `+${added - changed} ~${changed} -${removed - changed} blocks`
}

export async function createAuthorSession(
  options: AuthorSessionOptions,
): Promise<AuthorSession> {
  const { doc, codec, fs, log = () => undefined } = options
  const writeDelayMs = options.writeDelayMs ?? 300
  const snapshotPath = `${doc.filePath}.loro`
  const listeners = new Set<(event: AuthorEvent) => void>()
  const emit = (event: AuthorEvent) => {
    for (const listener of listeners) listener(event)
  }
  const parseBody = (fileText: string) =>
    codec.litexmlToLexical(
      currentAuthorBody({ ...doc, lastFileText: fileText }),
    ) as LexicalState

  const loro = new LoroDoc()
  loro.setRecordTimestamp(true)
  const stored = await fs.readFile(snapshotPath)
  if (stored) {
    try {
      loro.import(stored)
    } catch (err) {
      log(`snapshot unreadable, starting fresh: ${messageOf(err)}`)
      await fs.rename(snapshotPath, `${snapshotPath}.bak`)
    }
  }

  const editor = createAuthorHeadlessEditor()
  const binding = createLoroBinding(editor, loro)
  loro.subscribeLocalUpdates((bytes) => emit({ type: 'update', bytes }))

  const initial = parseBody(doc.lastFileText)
  loro.getList('sessions').push(Date.now())
  loro.setNextCommitMessage(`session ${new Date().toISOString()}`)
  editor.update(
    () =>
      $reconcileRoot(
        (options.base ? annotateDiffNotes(options.base, initial) : initial)
          .root as never,
      ),
    { discrete: true },
  )
  loro.commit()

  const written = new Map<string, ReturnType<LoroDoc['frontiers']>>()
  const remember = (fileText: string) => {
    written.delete(fileText)
    written.set(fileText, loro.frontiers())
    if (written.size > WRITTEN_LIMIT) {
      written.delete(written.keys().next().value!)
    }
  }
  remember(doc.lastFileText)

  let invalidMessage: string | null = null
  const setInvalid = (message: string | null) => {
    if (message === invalidMessage) return
    invalidMessage = message
    emit({ type: 'status', invalid: message })
  }

  let writeTimer: NodeJS.Timeout | undefined
  let snapshotDirty = false
  let writing = Promise.resolve()

  const applyRemote = (bytes: Uint8Array) => {
    binding.import(bytes)
    emit({ type: 'update', bytes })
    scheduleWrite()
  }

  const onFileText = (text: string) => {
    if (text === doc.lastFileText) return
    let target: LexicalState
    try {
      target = parseBody(text)
    } catch (err) {
      const message = messageOf(err)
      log(`agent edit rejected: ${message}`)
      setInvalid(message)
      return
    }
    const baseText = doc.lastFileText
    const frontiers = written.get(baseText) ?? loro.frontiers()
    const stats = blockStats(parseBody(baseText), target)
    doc.lastFileText = text
    remember(text)
    applyRemote(
      editAtVersion(
        loro,
        frontiers,
        createAuthorHeadlessEditor,
        target as never,
        `agent: ${stats}`,
      ),
    )
    setInvalid(null)
    log(`agent edit merged: ${stats}`)
  }

  const write = async () => {
    clearTimeout(writeTimer)
    writeTimer = undefined
    if (invalidMessage !== null) return
    const onDisk = await fs.readFile(doc.filePath)
    if (onDisk) {
      const text = new TextDecoder().decode(onDisk)
      if (text !== doc.lastFileText) onFileText(text)
      if (invalidMessage !== null) return
    }
    const body = codec.lexicalToLitexml(
      resolveDiffNotes(editor.getEditorState().toJSON(), 'proposed'),
    )
    const applied = applyAuthorBody(doc, body)
    if (applied.fileText === doc.lastFileText && doc.saved) return
    await persistAuthorSave(doc, applied.fileText, applied.diff, fs)
    remember(applied.fileText)
  }

  const flush = () => {
    writing = writing.then(write, write)
    return writing
  }

  function scheduleWrite() {
    snapshotDirty = true
    clearTimeout(writeTimer)
    writeTimer = setTimeout(() => void flush(), writeDelayMs)
  }

  const saveSnapshot = async () => {
    if (!snapshotDirty) return
    snapshotDirty = false
    const tmp = `${snapshotPath}.tmp`
    await fs.writeBinary(tmp, loro.export({ mode: 'snapshot' }))
    await fs.rename(tmp, snapshotPath)
  }
  snapshotDirty = true
  const snapshotTimer = setInterval(
    () => void saveSnapshot().catch((err) => log(messageOf(err))),
    options.snapshotIntervalMs ?? 5000,
  )

  const preview = (id: OpId): LexicalState => {
    const editorAt = createAuthorHeadlessEditor()
    const unbind = createLoroBinding(editorAt, loro.forkAt([id]))
    unbind.dispose()
    return editorAt.getEditorState().toJSON() as unknown as LexicalState
  }

  return {
    snapshot: () => loro.export({ mode: 'snapshot' }),
    importUpdate: (bytes) => {
      binding.import(bytes)
      scheduleWrite()
    },
    onFileText,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    flush,
    history: () =>
      [...loro.getAllChanges().values()]
        .flat()
        .filter((change) => change.message !== undefined)
        .sort((a, b) => b.lamport - a.lamport)
        .map((change) => ({
          id: {
            peer: change.peer,
            counter: change.counter + change.length - 1,
          },
          lamport: change.lamport,
          timestamp: change.timestamp,
          message: change.message,
        })),
    preview,
    restore: (id) => {
      applyRemote(
        editAtVersion(
          loro,
          loro.frontiers(),
          createAuthorHeadlessEditor,
          preview(id) as never,
          `restore ${id.counter}@${id.peer}`,
        ),
      )
    },
    invalid: () => invalidMessage,
    close: async () => {
      clearInterval(snapshotTimer)
      await flush()
      await saveSnapshot()
      binding.dispose()
      listeners.clear()
    },
  }
}
