import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { create } from './create'
import { del } from './delete'
import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { update } from './update'

const help = registerCommandHelp({
  name: 'page',
  description: 'manage pages',
  verbs: [
    { name: 'list', description: 'list pages' },
    { name: 'get', args: ['<slugOrId>'], description: 'show a single page' },
    {
      name: 'create',
      args: ['[--title ...]', '[--file <path>]', '...'],
      description: 'create a page',
    },
    {
      name: 'edit',
      args: ['<slugOrId>', '[--file <path>]', '...'],
      description: 'edit a page via $EDITOR or flags',
    },
    {
      name: 'update',
      args: ['<slugOrId>', '[--title ...]', '...'],
      description: 'partially update a page',
    },
    {
      name: 'delete',
      args: ['<slugOrId>', '[--force]'],
      description: 'delete a page',
    },
  ],
})

export const pageCmd = Command.make('page').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([list, get, create, edit, update, del]),
)
