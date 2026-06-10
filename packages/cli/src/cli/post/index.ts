import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { apply } from './apply'
import { create } from './create'
import { del } from './delete'
import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { publish } from './publish'
import { stage } from './stage'
import { unpublish } from './unpublish'
import { update } from './update'

const help = registerCommandHelp({
  name: 'post',
  description: 'manage posts',
  verbs: [
    {
      name: 'list',
      args: ['[--page <n>]', '[--size <n>]', '[--state <s>]', '[--sort <s>]'],
      description: 'list posts',
    },
    { name: 'get', args: ['<slugOrId>'], description: 'show a single post' },
    {
      name: 'create',
      args: ['[--title ...]', '[--file <path>]', '...'],
      description: 'create a post',
    },
    {
      name: 'edit',
      args: ['<slugOrId>', '[--file <path>]', '...'],
      description: 'edit a post via $EDITOR or flags',
    },
    {
      name: 'update',
      args: ['<slugOrId>', '[--title ...]', '...'],
      description: 'partially update a post',
    },
    {
      name: 'delete',
      args: ['<slugOrId>', '[--force]'],
      description: 'delete a post',
    },
    { name: 'publish', args: ['<slugOrId>'], description: 'publish a post' },
    {
      name: 'unpublish',
      args: ['<slugOrId>'],
      description: 'unpublish a post',
    },
    {
      name: 'stage',
      args: ['<slugOrId>', '[--file <path>]', '...'],
      description: 'stage changes as a draft; the live post stays untouched',
    },
    {
      name: 'apply',
      args: ['<slugOrId>'],
      description: 'apply the staged draft to the live post',
    },
  ],
})

export const postCmd = Command.make('post').pipe(
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
    stage,
    apply,
  ]),
)
