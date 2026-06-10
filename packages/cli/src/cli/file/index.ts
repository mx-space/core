import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { del } from './delete'
import { list } from './list'
import { rename } from './rename'
import { upload } from './upload'

const help = registerCommandHelp({
  name: 'file',
  description: 'upload and manage static files (images, icons, avatars)',
  verbs: [
    {
      name: 'upload',
      args: ['<path>', '[--type file|image|icon|avatar]', '[--name <n>]'],
      description: 'upload a local file; returns { url, name }',
    },
    {
      name: 'list',
      args: ['[--type <t>]'],
      description: 'list uploaded files of a type',
    },
    {
      name: 'delete',
      args: ['<name>', '[--type <t>]', '[--force]'],
      description: 'delete an uploaded file',
    },
    {
      name: 'rename',
      args: ['<name>', '<newName>', '[--type <t>]'],
      description: 'rename an uploaded file',
    },
  ],
})

export const fileCmd = Command.make('file').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([upload, list, del, rename]),
)
