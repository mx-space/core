import { Command } from 'effect/cli'

import { registerCommandHelp } from '../help/registry'
import { cat } from './cat'
import { create } from './create'
import { del } from './delete'
import { get } from './get'
import { list } from './list'
import { patch } from './patch'
import { publish } from './publish'
import { update } from './update'

const help = registerCommandHelp({
  name: 'draft',
  description: 'manage standalone drafts (server-side draft entities)',
  skillChapter: 'commands-draft',
  verbs: [
    {
      name: 'list',
      args: ['[--type <t>]', '[--new]', '[--linked]'],
      description: 'list drafts',
    },
    { name: 'get', args: ['<id>'], description: 'show a single draft' },
    {
      name: 'cat',
      args: ['<id>', '[--outline]', '[--selection]'],
      description: 'print the live draft as LiteXML with block ids',
    },
    {
      name: 'patch',
      args: ['<id>', '[--message <summary>]', '< SEARCH/REPLACE blocks'],
      description: 'apply literal SEARCH/REPLACE blocks to the live draft',
    },
    {
      name: 'create',
      args: ['--file <envelope.xml>', '[--title ...]', '...'],
      description: 'create a standalone post draft',
    },
    {
      name: 'update',
      args: ['<id>', '--file <envelope.xml>', '...'],
      description: 'update a draft (versioned)',
    },
    {
      name: 'publish',
      args: ['<id>', '[--silent]', '[--open]'],
      description: 'publish a draft as a live post/note/page',
    },
    {
      name: 'delete',
      args: ['<id>', '[--force]'],
      description: 'delete a draft',
    },
  ],
})

export const draftCmd = Command.make('draft').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([
    list,
    get,
    cat,
    patch,
    create,
    update,
    publish,
    del,
  ]),
)
