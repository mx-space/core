import { Command } from '@effect/cli'

import { byArticle } from './by-article'
import { del } from './delete'
import { list } from './list'
import { run } from './run'
import { voices } from './voices'

export const ttsCmd = Command.make('tts').pipe(
  Command.withDescription('manage AI narrations (text-to-speech)'),
  Command.withSubcommands([run, list, byArticle, voices, del]),
)
