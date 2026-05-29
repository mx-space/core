import { Command } from '@effect/cli'

import { registerCommandHelp } from '../help/registry'
import { approve } from './approve'
import { del } from './delete'
import { get } from './get'
import { list } from './list'
import { reject } from './reject'
import { reply } from './reply'
import { unread } from './unread'

const help = registerCommandHelp({
  name: 'comment',
  description: 'list and moderate comments',
  verbs: [
    {
      name: 'list',
      args: ['[--page <n>]', '[--size <n>]', '[--state <s>]', '[--all]'],
      description:
        'list comments (default state: unread; --all aggregates every state)',
    },
    {
      name: 'unread',
      args: ['[--page <n>]', '[--size <n>]'],
      description: 'alias for `list --state unread`',
    },
    { name: 'get', args: ['<id>'], description: 'show a single comment' },
    {
      name: 'reply',
      args: [
        '<id>',
        '--text <inline|file=<path>|->',
        '[--whispers]',
        '[--silent]',
      ],
      description: 'post an owner reply to a comment',
    },
    {
      name: 'approve',
      args: ['<id...>', '|', '--all', '[--state <s>]'],
      description: 'mark comments as read',
    },
    {
      name: 'reject',
      args: ['<id...>', '|', '--all', '[--state <s>]'],
      description: 'mark comments as junk',
    },
    {
      name: 'delete',
      args: ['<id...>', '|', '--all', '[--state <s>]', '[--force]'],
      description: 'soft-delete comments',
    },
  ],
})

export const commentCmd = Command.make('comment').pipe(
  Command.withDescription(help.description),
  Command.withSubcommands([list, unread, get, reply, approve, reject, del]),
)
