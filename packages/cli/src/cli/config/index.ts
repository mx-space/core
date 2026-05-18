import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { set } from './set'

const help = registerCommandHelp({
  name: 'config',
  description: 'manage server options',
  verbs: [
    { name: 'list', description: 'list all server options' },
    { name: 'get', args: ['<key>'], description: 'read one server option' },
    {
      name: 'set',
      args: ['<key>', '<value>', '[--type <json/string/number/bool>]'],
      description: 'set a server option',
    },
    { name: 'edit', description: 'edit all server options via $EDITOR' },
  ],
})

export const configCmd = Command.make('config').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([list, get, set, edit]),
)
