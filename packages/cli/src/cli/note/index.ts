import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { create } from './create'
import { del } from './delete'
import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { publish } from './publish'
import { unpublish } from './unpublish'
import { update } from './update'

const help = registerCommandHelp({
  name: 'note',
  description: 'manage notes',
  verbs: [
    {
      name: 'list',
      args: ['[--page <n>]', '[--size <n>]', '[--state <s>]', '[--sort <s>]'],
      description: 'list notes',
    },
    {
      name: 'get',
      args: ['<slugOrId>'],
      description: 'get a note by snowflake id or numeric nid',
    },
    {
      name: 'create',
      args: ['[--title ...]', '[--file <path>]', '...'],
      description: 'create a note',
    },
    {
      name: 'edit',
      args: ['<slugOrId>', '[--file <path>]', '...'],
      description: 'edit a note via $EDITOR or flags',
    },
    {
      name: 'update',
      args: ['<slugOrId>', '[--title ...]', '...'],
      description: 'partially update a note',
    },
    {
      name: 'delete',
      args: ['<slugOrId>', '[--force]'],
      description: 'delete a note',
    },
    { name: 'publish', args: ['<slugOrId>'], description: 'publish a note' },
    {
      name: 'unpublish',
      args: ['<slugOrId>'],
      description: 'unpublish a note',
    },
  ],
})

export const noteCmd = Command.make('note').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([
    list,
    get,
    create,
    edit,
    update,
    del,
    publish,
    unpublish,
  ]),
)
