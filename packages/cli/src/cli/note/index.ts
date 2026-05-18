import { Command } from '@effect/cli'

import { create } from './create'
import { del } from './delete'
import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { publish } from './publish'
import { unpublish } from './unpublish'
import { update } from './update'

export const noteCmd = Command.make('note').pipe(
  Command.withDescription('manage notes'),
  Command.withSubcommands([
    list,
    get,
    create,
    edit,
    update,
    del,
    publish,
    unpublish,
  ]),
)
