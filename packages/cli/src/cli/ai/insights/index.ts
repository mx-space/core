import { Command } from '@effect/cli'

import { byArticle } from './by-article'
import { del } from './delete'
import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { refresh } from './refresh'

export const insightsCmd = Command.make('insights').pipe(
  Command.withDescription('manage AI insights'),
  Command.withSubcommands([refresh, list, get, byArticle, edit, del]),
)
