import { Command } from '@effect/cli'

import { create } from './create'
import { del } from './delete'
import { get } from './get'
import { list } from './list'
import { update } from './update'

export const topicCmd = Command.make('topic').pipe(
  Command.withSubcommands([list, get, create, update, del]),
)
