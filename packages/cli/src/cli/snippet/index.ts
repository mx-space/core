import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { create } from './create'
import { del } from './delete'
import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { update } from './update'

const help = registerCommandHelp({
  name: 'snippet',
  description: 'manage snippets',
  skillChapter: 'commands-snippet',
  verbs: [
    {
      name: 'list',
      args: ['[--page <n>]', '[--size <n>]', '[--grouped]'],
      description: 'list snippets',
    },
    {
      name: 'get',
      args: ['<id|ref/name>'],
      description: 'show a single snippet (full, includes raw)',
    },
    {
      name: 'create',
      args: [
        '--name <n>',
        '[--reference <r>]',
        '[--type <t>]',
        '[--file <path|-> | --raw <text> | stdin]',
        '...',
      ],
      description: 'create a snippet',
    },
    {
      name: 'update',
      args: ['<id|ref/name>', '[--file <path|-> | --raw <text>]', '...'],
      description: 'update a snippet',
    },
    {
      name: 'edit',
      args: ['<id|ref/name>'],
      description: 'edit snippet content via $EDITOR',
    },
    {
      name: 'delete',
      args: ['<id|ref/name>', '[--force]'],
      description: 'delete a snippet',
    },
  ],
})

export const snippetCmd = Command.make('snippet').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([list, get, create, update, edit, del]),
)
