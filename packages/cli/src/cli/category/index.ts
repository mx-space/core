import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { create } from './create'
import { del } from './delete'
import { get } from './get'
import { list } from './list'
import { update } from './update'

const help = registerCommandHelp({
  name: 'category',
  description: 'manage categories / tags',
  verbs: [
    { name: 'list', description: 'list categories and tags' },
    {
      name: 'get',
      args: ['<slugOrId>'],
      description: 'show a single category',
    },
    {
      name: 'create',
      args: [
        '--name <n>',
        '--slug <s>',
        '[--type <category/tag>]',
        '[--icon ...]',
      ],
      description: 'create a category or tag',
    },
    {
      name: 'update',
      args: ['<slugOrId>', '[--name ...]', '[--slug ...]', '...'],
      description: 'update a category',
    },
    {
      name: 'delete',
      args: ['<slugOrId>', '[--force]'],
      description: 'delete a category',
    },
  ],
})

export const categoryCmd = Command.make('category').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([list, get, create, update, del]),
)
