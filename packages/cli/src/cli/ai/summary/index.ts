import { Command } from '@effect/cli'

import { byArticle } from './by-article'
import { del } from './delete'
import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { regen } from './regen'

export const summaryCmd = Command.make('summary').pipe(
  Command.withDescription('manage AI summaries'),
  Command.withSubcommands([regen, list, get, byArticle, edit, del]),
)
