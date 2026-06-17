import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { login } from './login'
import { logout } from './logout'
import { status } from './status'
import { whoami } from './whoami'

const help = registerCommandHelp({
  name: 'auth',
  description: 'authentication',
  skillChapter: 'commands-auth',
  verbs: [
    {
      name: 'login',
      args: ['[--production]'],
      description: 'start device authorization flow',
    },
    { name: 'logout', description: 'delete stored credentials' },
    { name: 'whoami', description: 'show the authenticated user' },
    { name: 'status', description: 'show token validity and expiry' },
  ],
})

export const authCmd = Command.make('auth').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([login, logout, whoami, status]),
)
