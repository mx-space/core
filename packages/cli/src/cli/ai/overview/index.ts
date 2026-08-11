import { Command } from '@effect/cli'

import { byArticle } from './by-article'
import { list } from './list'

export const overviewCmd = Command.make('overview').pipe(
  Command.withDescription('inspect the per-article AI overview board'),
  Command.withSubcommands([list, byArticle]),
)
