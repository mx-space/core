import { Command } from '@effect/cli'

import { byArticle } from './by-article'
import { del } from './delete'
import { edit } from './edit'
import { entriesCmd } from './entries'
import { get } from './get'
import { languages } from './languages'
import { list } from './list'
import { run } from './run'

export const translateCmd = Command.make('translate').pipe(
  Command.withDescription('manage AI translations'),
  Command.withSubcommands([
    run,
    list,
    get,
    byArticle,
    languages,
    edit,
    del,
    entriesCmd,
  ]),
)
