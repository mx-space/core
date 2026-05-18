import { Command } from '@effect/cli'

import { create } from './create'
import { del } from './delete'
import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { update } from './update'

export const pageCmd = Command.make('page').pipe(
  Command.withSubcommands([list, get, create, edit, update, del]),
)
