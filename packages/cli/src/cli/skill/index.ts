import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { Renderer } from '../../services/Renderer'
import { Skill } from '../../services/Skill'
import { registerCommandHelp } from '../help/registry'
import { all } from './all'
import { get } from './get'
import { list } from './list'
import { search } from './search'
import { skillListView } from './views'

const help = registerCommandHelp({
  name: 'skill',
  description: 'read bundled AI skill chapters (commands, authoring, liteXML)',
  verbs: [
    { name: 'list', description: 'list all chapters (default verb)' },
    {
      name: 'get',
      args: ['<slug>'],
      description: 'print one chapter as raw markdown',
    },
    { name: 'all', description: 'concatenate every chapter in registry order' },
    {
      name: 'search',
      args: ['<keyword>'],
      description: 'substring search across chapter title, description, body',
    },
  ],
})

export const skillCmd = Command.make('skill', {}, () =>
  Effect.gen(function* () {
    const skill = yield* Skill
    const renderer = yield* Renderer
    const chapters = yield* skill.list
    yield* renderer.emit(skillListView, chapters)
  }),
).pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([list, get, all, search]),
)
