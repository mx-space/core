import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { insightsCmd } from './insights'
import { overviewCmd } from './overview'
import { summaryCmd } from './summary'
import { translateCmd } from './translate'
import { ttsCmd } from './tts'

const help = registerCommandHelp({
  name: 'ai',
  description:
    'manage AI artifacts (summary, translation, insights, tts, overview)',
  skillChapter: 'commands-ai',
  verbs: [
    {
      name: 'summary',
      args: ['<verb>', '...'],
      description:
        'manage AI summaries (regen, translate, list, get, by-article, edit, delete)',
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
        'manage AI insights (refresh, translate, list, get, by-article, edit, delete)',
    },
    {
      name: 'tts',
      args: ['<verb>', '...'],
      description:
        'manage AI narrations (run, list, by-article, voices, delete)',
    },
    {
      name: 'overview',
      args: ['<verb>', '...'],
      description: 'inspect the per-article AI overview board (list, by-article)',
    },
  ],
})

export const aiCmd = Command.make('ai').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([
    summaryCmd,
    translateCmd,
    insightsCmd,
    ttsCmd,
    overviewCmd,
  ]),
)
