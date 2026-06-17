import { Command } from '@effect/cli'

import { del } from './delete'
import { edit } from './edit'
import { generate } from './generate'
import { list } from './list'

export const entriesCmd = Command.make('entries').pipe(
  Command.withDescription('manage translation entries (i18n dictionary)'),
  Command.withSubcommands([list, generate, edit, del]),
)
