import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { create } from './create'
import { del } from './delete'
import { get } from './get'
import { list } from './list'
import { update } from './update'

const help = registerCommandHelp({
  name: 'topic',
  description: 'manage topics',
  verbs: [
    { name: 'list', description: 'list topics' },
    { name: 'get', args: ['<slugOrId>'], description: 'show a single topic' },
    {
      name: 'create',
      args: ['--name <n>', '--slug <s>', '[--description ...]', '[--icon ...]'],
      description: 'create a topic',
    },
    {
      name: 'update',
      args: ['<slugOrId>', '[--name ...]', '...'],
      description: 'update a topic',
    },
    {
      name: 'delete',
      args: ['<slugOrId>', '[--force]'],
      description: 'delete a topic',
    },
  ],
})

export const topicCmd = Command.make('topic').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([list, get, create, update, del]),
)
