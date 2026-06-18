import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { create } from './create'
import { del } from './delete'
import { edit } from './edit'
import { get } from './get'
import { list } from './list'
import { pull } from './pull'
import { push } from './push'
import { update } from './update'

const help = registerCommandHelp({
  name: 'snippet',
  description: 'manage snippets',
  skillChapter: 'commands-snippet',
  verbs: [
    {
      name: 'ls',
      args: ['[prefix]', '[--recursive]', '[--limit <n>]'],
      description: 'list snippet paths',
    },
    {
      name: 'get',
      args: ['<path|id>'],
      description: 'show a single snippet (full, includes raw)',
    },
    {
      name: 'put',
      args: ['<path>', '[--type <t>]', '[--file <path|-> | --raw <text>]'],
      description: 'write a snippet',
    },
    {
      name: 'mv',
      args: ['<from>', '<to>', '[--recursive]'],
      description: 'move a snippet path',
    },
    {
      name: 'push',
      args: ['<local-dir>', '<remote-prefix>', '[--dry-run]', '[--type <t>]'],
      description: 'sync local files into snippet VFS',
    },
    {
      name: 'pull',
      args: ['<remote-prefix>', '<local-dir>', '[--dry-run]'],
      description: 'sync snippet VFS files into a local directory',
    },
    {
      name: 'edit',
      args: ['<path|id>'],
      description: 'edit snippet content via $EDITOR',
    },
    {
      name: 'rm',
      args: ['<path|id>', '[--recursive]', '[--force]'],
      description: 'delete a snippet',
    },
  ],
})

export const snippetCmd = Command.make('snippet').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([list, get, create, update, push, pull, edit, del]),
)
