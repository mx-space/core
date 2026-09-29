import {
  $reconcileRoot,
  createLoroBinding,
  editAtVersion,
  streamAtVersion,
  type StreamStep,
  TREE_NAME,
} from '@haklex/rich-collab-loro'
import { LoroDoc, type OpId, type TreeID } from 'loro-crdt'

import type { LexicalState } from '../../services/Lexical'
import { unbalancedTag } from './balance'
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
  readonly deps: readonly OpId[]
}

export interface AgentCursor {
  readonly id: TreeID
  readonly offset: number
}

export interface SelectedBlock {
  readonly id: string
  readonly text: string
}

export interface AuthorSelection {
  readonly collapsed: boolean
  readonly text: string
  readonly blocks: readonly SelectedBlock[]
}

export type AuthorEvent =
  | { readonly type: 'update'; readonly bytes: Uint8Array }
  | { readonly type: 'status'; readonly invalid: string | null }
  | { readonly type: 'cursor'; readonly cursor: AgentCursor | null }

export interface AuthorSessionOptions {
  readonly doc: AuthorDocument
  readonly codec: AuthorCodec
  readonly fs: SessionFs
  readonly base?: LexicalState
  readonly log?: (line: string) => void
  readonly writeDelayMs?: number
  readonly snapshotIntervalMs?: number
  readonly stepDelayMs?: number
}

export interface AuthorSession {
  readonly snapshot: () => Uint8Array
  readonly importUpdate: (bytes: Uint8Array) => void
  readonly onFileText: (text: string) => void
  readonly subscribe: (listener: (event: AuthorEvent) => void) => () => void
  readonly flush: () => Promise<void>
  readonly settled: () => Promise<void>
  readonly history: () => HistoryEntry[]
  readonly preview: (frontiers: readonly OpId[]) => LexicalState
  readonly restore: (id: OpId) => Promise<void>
  readonly invalid: () => string | null
  readonly cursor: () => AgentCursor | null
  readonly writeSelection: (selection: AuthorSelection) => Promise<void>
  readonly lineage: () => string
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
  const stepDelayMs = options.stepDelayMs ?? 35
  const snapshotPath = `${doc.filePath}.loro`
  const selectionPath = `${doc.filePath}.selection.json`
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
  const remember = (fileText: string, frontiers = loro.frontiers()) => {
    written.delete(fileText)
    written.set(fileText, frontiers)
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
  let playing = Promise.resolve()
  let streaming = 0
  let lastCursor: AgentCursor | null = null
  let selectionWrite = Promise.resolve()

  const applyRemote = (bytes: Uint8Array) => {
    binding.import(bytes)
    emit({ type: 'update', bytes })
    scheduleWrite()
  }

  const prepareAgentEdit = (
    baseText: string,
    text: string,
    target: LexicalState,
  ) => {
    const baseState = parseBody(baseText)
    const stats = blockStats(baseState, target)
    const { frontiers, steps } = streamAtVersion(
      loro,
      written.get(baseText) ?? loro.frontiers(),
      createAuthorHeadlessEditor,
      baseState as never,
      target as never,
      `agent: ${stats}`,
    )
    remember(text, frontiers)
    return { stats, steps }
  }

  const applyStep = (step: StreamStep) => {
    binding.import(step.update)
    emit({ type: 'update', bytes: step.update })
    if (step.cursor) {
      lastCursor = step.cursor
      emit({ type: 'cursor', cursor: step.cursor })
    }
  }

  const onFileText = (text: string) => {
    if (text === doc.lastFileText) return
    let target: LexicalState
    try {
      const unbalanced = unbalancedTag(
        currentAuthorBody({ ...doc, lastFileText: text }),
      )
      if (unbalanced) throw new Error(unbalanced)
      target = parseBody(text)
    } catch (err) {
      const message = messageOf(err)
      log(`agent edit rejected: ${message}`)
      setInvalid(message)
      return
    }
    const baseText = doc.lastFileText
    doc.lastFileText = text
    setInvalid(null)
    if (stepDelayMs === 0 && streaming === 0) {
      const { stats, steps } = prepareAgentEdit(baseText, text, target)
      for (const step of steps) applyStep(step)
      scheduleWrite()
      log(`agent edit merged: ${stats}`)
      return
    }
    streaming += 1
    playing = playing.then(async () => {
      try {
        const { stats, steps } = prepareAgentEdit(baseText, text, target)
        for (const step of steps) {
          applyStep(step)
          await new Promise((resolve) =>
            setTimeout(resolve, stepDelayMs * (0.6 + Math.random() * 0.8)),
          )
        }
        log(`agent edit merged: ${stats}`)
      } catch (err) {
        log(`agent edit failed: ${messageOf(err)}`)
      } finally {
        streaming -= 1
        scheduleWrite()
      }
    })
  }

  const write = async () => {
    clearTimeout(writeTimer)
    writeTimer = undefined
    if (invalidMessage !== null || streaming > 0) return
    const onDisk = await fs.readFile(doc.filePath)
    if (onDisk) {
      const text = new TextDecoder().decode(onDisk)
      if (text !== doc.lastFileText) onFileText(text)
      if (invalidMessage !== null || streaming > 0) return
    }
    const body = codec.lexicalToLitexml(
      resolveDiffNotes(editor.getEditorState().toJSON(), 'proposed'),
    )
    const applied = applyAuthorBody(doc, body)
    if (applied.fileText === doc.lastFileText && doc.saved) return
    await persistAuthorSave(doc, applied.fileText, applied.diff, fs)
    remember(applied.fileText)
    // The snapshot must never lag the file: a restart replays a newer file
    // onto an older snapshot, and a surviving tab would then re-add the same text.
    snapshotDirty = true
    await saveSnapshot()
  }

  const flush = () => {
    const previous = writing
    writing = playing.then(() => previous).then(write, write)
    return writing
  }

  function scheduleWrite() {
    snapshotDirty = true
    clearTimeout(writeTimer)
    writeTimer = setTimeout(
      () =>
        void flush().catch((err) => log(`autosave failed: ${messageOf(err)}`)),
      writeDelayMs,
    )
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

  const preview = (frontiers: readonly OpId[]): LexicalState => {
    const editorAt = createAuthorHeadlessEditor()
    const unbind = createLoroBinding(editorAt, loro.forkAt([...frontiers]))
    unbind.dispose()
    return editorAt.getEditorState().toJSON() as unknown as LexicalState
  }

  return {
    snapshot: () => loro.export({ mode: 'snapshot' }),
    importUpdate: (bytes) => {
      // ponytail: forks the whole doc per batch to vet it; vet by root ops only if docs get large
      const probe = loro.fork()
      probe.import(bytes)
      if (probe.getTree(TREE_NAME).roots().length > 1) {
        throw new Error(
          'update belongs to a different document; reload the editor',
        )
      }
      binding.import(bytes)
      scheduleWrite()
    },
    onFileText,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    flush,
    settled: () => playing,
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
          deps: change.deps,
        })),
    preview,
    restore: (id) => {
      const apply = () =>
        applyRemote(
          editAtVersion(
            loro,
            loro.frontiers(),
            createAuthorHeadlessEditor,
            preview([id]) as never,
            `restore ${id.counter}@${id.peer}`,
          ),
        )
      if (streaming === 0) {
        apply()
        return Promise.resolve()
      }
      playing = playing.then(apply)
      return playing
    },
    invalid: () => invalidMessage,
    cursor: () => lastCursor,
    writeSelection: (selection) => {
      const payload = JSON.stringify(
        { updatedAt: new Date().toISOString(), ...selection },
        null,
        2,
      )
      const tmp = `${selectionPath}.tmp`
      selectionWrite = selectionWrite
        .catch(() => undefined)
        .then(async () => {
          await fs.writeFile(tmp, payload)
          await fs.rename(tmp, selectionPath)
        })
      return selectionWrite
    },
    lineage: () => loro.getTree(TREE_NAME).roots()[0]!.id,
    close: async () => {
      clearInterval(snapshotTimer)
      await flush()
      await saveSnapshot()
      binding.dispose()
      listeners.clear()
    },
  }
}
