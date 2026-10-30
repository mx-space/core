import { readDocContent } from '@mx-space/editor/loro'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import {
  renderDraftEnvelope,
  renderOutline,
  selectionBlocks,
} from './collab/document'
import { latestSelection, withDraftRoom } from './collab/session'

const id = Argument.String('id')
const outline = Flag.Boolean('outline').pipe(
  Flag.withDefault(false),
  Flag.withDescription('print headings with block ids and block counts'),
)
const selection = Flag.Boolean('selection').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'print the blocks a person last selected in the online editor',
  ),
)

const SELECTION_WAIT_MS = 500

const write = (text: string) =>
  Effect.sync(() => {
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`)
  })

export const cat = Command.make(
  'cat',
  { id, outline, selection },
  ({ id, outline, selection }) =>
    withDraftRoom(id, 'GET', ({ room, categories }) =>
      Effect.gen(function* () {
        if (selection)
          yield* Effect.promise(() => room.waitForPresence(SELECTION_WAIT_MS))
        const xml = renderDraftEnvelope(room.doc, categories)
        if (outline) return yield* write(renderOutline(xml))
        if (!selection) return yield* write(xml)
        const picked = latestSelection(room.presences())
        const blocks = picked
          ? selectionBlocks(readDocContent(room.doc).content, picked.ids)
          : ''
        if (!blocks) {
          return yield* write(
            'no selection: nobody has text selected in the online editor (ask which passage they mean)',
          )
        }
        return yield* write(blocks)
      }),
    ),
).pipe(
  Command.withDescription(
    'print a draft as a LiteXML envelope (live collaborative state, block ids included)',
  ),
)
