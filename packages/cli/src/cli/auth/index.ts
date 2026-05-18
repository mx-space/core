import { Command } from '@effect/cli'

import { login } from './login'
import { logout } from './logout'
import { status } from './status'
import { whoami } from './whoami'

export const authCmd = Command.make('auth').pipe(
  Command.withDescription('authentication'),
  Command.withSubcommands([login, logout, whoami, status]),
)
