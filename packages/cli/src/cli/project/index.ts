import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { create } from './create'
import { del } from './delete'
import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { update } from './update'
import { viewCmd } from './view-cmd'

const help = registerCommandHelp({
  name: 'project',
  description: 'manage portfolio projects',
  verbs: [
    {
      name: 'list',
      args: ['[--page <n>]', '[--size <n>]'],
      description: 'list projects',
    },
    {
      name: 'get',
      args: ['<nameOrId>'],
      description: 'show a single project (raw)',
    },
    {
      name: 'view',
      args: ['<nameOrId>'],
      description: 'show a single project (rendered)',
    },
    {
      name: 'create',
      args: ['--name <s>', '--description <s>', '[--file <path>]', '...'],
      description: 'create a project',
    },
    {
      name: 'edit',
      args: ['<nameOrId>'],
      description: 'edit a project via $EDITOR (JSON envelope)',
    },
    {
      name: 'update',
      args: ['<nameOrId>', '[--name ...]', '...'],
      description: 'partially update a project',
    },
    {
      name: 'delete',
      args: ['<nameOrId>', '[--force]'],
      description: 'delete a project',
    },
  ],
})

export const projectCmd = Command.make('project').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([list, get, viewCmd, create, edit, update, del]),
)
