import { Command } from '@effect/cli'

import { ls } from './ls'
import { mark } from './mark'
import { rm } from './rm'
import { show } from './show'
import { use } from './use'

export const profileCmd = Command.make('profile').pipe(
  Command.withDescription('manage mxs profiles'),
  Command.withSubcommands([ls, show, use, mark, rm]),
)
