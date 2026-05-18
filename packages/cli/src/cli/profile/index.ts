import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { ls } from './ls'
import { mark } from './mark'
import { rm } from './rm'
import { show } from './show'
import { use } from './use'

const help = registerCommandHelp({
  name: 'profile',
  description: 'manage mxs profiles',
  verbs: [
    { name: 'ls', description: 'list all known profiles' },
    {
      name: 'show',
      args: ['[<name>]'],
      description: 'show one profile (defaults to active)',
    },
    {
      name: 'use',
      args: ['<name>'],
      description: 'switch the active profile',
    },
    {
      name: 'mark',
      args: ['<name>', '[--production|--no-production]'],
      description: 'flag a profile as production / non-production',
    },
    {
      name: 'rm',
      args: ['<name>', '[--force]'],
      description: 'delete a profile',
    },
  ],
})

export const profileCmd = Command.make('profile').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([ls, show, use, mark, rm]),
)
