import { Command } from '@effect/cli'

import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { set } from './set'

export const configCmd = Command.make('config').pipe(
  Command.withSubcommands([list, get, set, edit]),
)
