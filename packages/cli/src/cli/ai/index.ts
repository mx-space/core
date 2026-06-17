import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { insightsCmd } from './insights'
import { summaryCmd } from './summary'
import { translateCmd } from './translate'

const help = registerCommandHelp({
  name: 'ai',
  description: 'manage AI artifacts (summary, translation, insights)',
  verbs: [
    {
      name: 'summary',
      args: ['<verb>', '...'],
      description:
        'manage AI summaries (regen, list, get, by-article, edit, delete)',
    },
    {
      name: 'translate',
      args: ['<verb>', '...'],
      description:
        'manage AI translations (run, list, get, by-article, languages, edit, delete, entries)',
    },
    {
      name: 'insights',
      args: ['<verb>', '...'],
      description:
        'manage AI insights (refresh, list, get, by-article, edit, delete)',
    },
  ],
})

export const aiCmd = Command.make('ai').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([summaryCmd, translateCmd, insightsCmd]),
)
