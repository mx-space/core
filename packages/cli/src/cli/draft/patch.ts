import { readFileSync } from 'node:fs'

import {
  createContentDoc,
  editDocAt,
  readDocContent,
} from '@mx-space/editor/loro'
import { Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { Generic, ServerError, ValidationFailed } from '../../domain/errors'
import { readDraftEdit, renderDraftEnvelope } from './collab/document'
import {
  applyPatchBlocks,
  findDroppedReplacements,
  parsePatchBlocks,
  PatchError,
} from './collab/patch'
import {
  agentCaret,
  holdPresenceInBackground,
  newAgentEntry,
  pendingHold,
  randomPeer,
  runHold,
} from './collab/presence'
import { withDraftRoom } from './collab/session'

const id = Argument.String('id')
const message = Flag.String('message').pipe(
  Flag.optional,
  Flag.withDescription('summary for the history entry (default: block counts)'),
)

interface Block {
  readonly $?: { readonly blockId?: string }
}

const blocksOf = (content: string): Block[] =>
  JSON.parse(content).root.children as Block[]

const idOf = (block: Block) => block.$?.blockId ?? ''

function changes(before: string, after: string) {
  const old = new Map(blocksOf(before).map((b) => [idOf(b), JSON.stringify(b)]))
  const next = blocksOf(after)
  const kept = new Set(next.map(idOf))
  const added = next.filter((b) => !old.has(idOf(b))).length
  const changed = next.filter(
    (b) => old.has(idOf(b)) && old.get(idOf(b)) !== JSON.stringify(b),
  ).length
  const removed = [...old.keys()].filter((key) => !kept.has(key)).length
  const touched = next.filter((b) => old.get(idOf(b)) !== JSON.stringify(b))
  return {
    stats: `+${added} ~${changed} -${removed} blocks`,
    lastTouched: touched.length ? idOf(touched.at(-1)!) : null,
  }
}

const fail = (error: unknown) =>
  error instanceof PatchError && error.reason !== 'malformed'
    ? new Generic({
        message: error.message,
        hint: 'run `mxs draft cat` again and copy the SEARCH text from its output',
      })
    : new ValidationFailed({ message: (error as Error).message })

export const patch = Command.make('patch', { id, message }, ({ id, message }) =>
  Effect.gen(function* () {
    const hold = pendingHold()
    if (hold) return yield* Effect.promise(() => runHold(hold))

    const input = yield* Effect.try({
      try: () => readFileSync(0, 'utf8'),
      catch: () =>
        new ValidationFailed({
          message: 'could not read SEARCH/REPLACE blocks from stdin',
        }),
    })
    const blocks = yield* Effect.try({
      try: () => parsePatchBlocks(input),
      catch: fail,
    })
    yield* withDraftRoom(id, 'POST', ({ room, categories, url, headers }) =>
      Effect.gen(function* () {
        const frontiers = room.doc.frontiers()
        const current = readDocContent(room.doc)
        const before = renderDraftEnvelope(room.doc, categories)
        const after = yield* Effect.try({
          try: () => applyPatchBlocks(before, blocks),
          catch: fail,
        })
        if (after === before) {
          return yield* Effect.sync(() =>
            process.stdout.write('no-op: the patch changes nothing\n'),
          )
        }
        const target = yield* Effect.try({
          try: () => readDraftEdit(before, after, current, categories),
          catch: (error) =>
            new ValidationFailed({
              message: `the patched article is not valid LiteXML: ${(error as Error).message}`,
            }),
        })
        const dropped = findDroppedReplacements(
          blocks,
          renderDraftEnvelope(createContentDoc(target, 'preview'), categories),
        )
        if (dropped.length) {
          return yield* Effect.fail(
            new ValidationFailed({
              message: `the editor would drop part of the replacement (unknown tag?): ${dropped.join('; ')}`,
            }),
          )
        }
        const summary = Option.getOrUndefined(message)
        const update = editDocAt(
          room.doc,
          frontiers,
          target,
          `agent:${summary ?? 'patch'}`,
          { peer: randomPeer() },
        )
        yield* Effect.tryPromise({
          try: () => room.push(update),
          catch: (error) =>
            new ServerError({ message: (error as Error).message }),
        })
        room.doc.import(update)
        const { stats, lastTouched } = changes(
          current.content,
          readDocContent(room.doc).content,
        )
        holdPresenceInBackground({
          url,
          headers,
          draftId: id,
          entry: newAgentEntry(),
          caret: agentCaret(room.doc, lastTouched),
        })
        yield* Effect.sync(() => process.stdout.write(`applied: ${stats}\n`))
      }),
    )
  }),
).pipe(
  Command.withDescription(
    'apply SEARCH/REPLACE blocks from stdin to the live draft (all or nothing; SEARCH must match the current text exactly once)',
  ),
)
