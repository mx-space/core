#!/usr/bin/env node
import { Command } from 'commander'

import { exitCodeForError, MxsError } from '../core/errors'
import { emitError, type OutputOptions } from '../core/output'

interface GlobalOptions {
  json?: boolean
  output?: string
  apiUrl?: string
  token?: string
  quiet?: boolean
  verbose?: boolean
  dryRun?: boolean
}

const program = new Command()

program
  .name('mxs')
  .description('mx-space CLI — manage your mx-core blog from the command line')
  .version('0.1.0')
  .option('--json', 'emit JSON output')
  .option('--output <mode>', 'pretty-json | json | readable | llm | envelope')
  .option('--api-url <url>', 'override the configured API URL')
  .option('--token <t>', 'override the stored access token')
  .option('-q, --quiet', 'suppress non-error stderr')
  .option('--verbose', 'log HTTP method/url/status/duration')
  .option('--dry-run', 'show resolved payload without calling the server')

addAuthCommands(program)
addPostCommands(program)
addNoteCommands(program)
addPageCommands(program)
addCategoryCommands(program)
addTopicCommands(program)
addConfigCommands(program)

program.parseAsync(process.argv).catch((err) => {
  const opts = readGlobalOptions(program)
  emitError(err, opts)
  process.exit(exitCodeForError(err))
})

export function readGlobalOptions(cmd: Command): OutputOptions {
  const opts = cmd.optsWithGlobals() as GlobalOptions
  return {
    json: Boolean(opts.json),
    output: opts.output ?? 'pretty-json',
    quiet: Boolean(opts.quiet),
    verbose: Boolean(opts.verbose),
  }
}

export function readGlobalFlags(cmd: Command): GlobalOptions {
  return cmd.optsWithGlobals() as GlobalOptions
}

function addAuthCommands(parent: Command) {
  const auth = parent.command('auth').description('authentication')
  auth
    .command('login')
    .description('start device authorization flow')
    .action(async (_opts, command) => {
      const { run } = await import('../commands/auth/login')
      await run(readGlobalFlags(command), readGlobalOptions(command))
    })
  auth
    .command('logout')
    .description('delete stored credentials')
    .action(async (_opts, command) => {
      const { run } = await import('../commands/auth/logout')
      await run(readGlobalFlags(command), readGlobalOptions(command))
    })
  auth
    .command('whoami')
    .description('show the authenticated user')
    .action(async (_opts, command) => {
      const { run } = await import('../commands/auth/whoami')
      await run(readGlobalFlags(command), readGlobalOptions(command))
    })
  auth
    .command('status')
    .description('show token validity and expiry')
    .action(async (_opts, command) => {
      const { run } = await import('../commands/auth/status')
      await run(readGlobalFlags(command), readGlobalOptions(command))
    })
}

function addPostCommands(parent: Command) {
  const post = parent.command('post').description('manage posts')
  post
    .command('list')
    .option('--page <n>', 'page number', (v) => Number(v))
    .option('--size <n>', 'page size', (v) => Number(v))
    .option('--state <s>', 'draft | publish')
    .option('--sort <s>', 'created | modified')
    .action(async (opts, command) => {
      const { run } = await import('../commands/post/list')
      await run(opts, readGlobalFlags(command), readGlobalOptions(command))
    })
  post.command('get <slugOrId>').action(async (id, _opts, command) => {
    const { run } = await import('../commands/post/get')
    await run(id, readGlobalFlags(command), readGlobalOptions(command))
  })
  addPostWriteCommand(post, 'create')
  addPostWriteCommand(post, 'edit', true)
  addPostWriteCommand(post, 'update', true)
  post
    .command('delete <slugOrId>')
    .option('--force', 'skip confirmation')
    .action(async (id, opts, command) => {
      const { run } = await import('../commands/post/delete')
      await run(id, opts, readGlobalFlags(command), readGlobalOptions(command))
    })
  post.command('publish <slugOrId>').action(async (id, _opts, command) => {
    const { run } = await import('../commands/post/publish')
    await run(id, true, readGlobalFlags(command), readGlobalOptions(command))
  })
  post.command('unpublish <slugOrId>').action(async (id, _opts, command) => {
    const { run } = await import('../commands/post/publish')
    await run(id, false, readGlobalFlags(command), readGlobalOptions(command))
  })
}

function addPostWriteCommand(
  parent: Command,
  name: 'create' | 'edit' | 'update',
  requiresId = false,
) {
  const cmd = parent.command(requiresId ? `${name} <slugOrId>` : `${name}`)
  attachPostWriteFlags(cmd)
  cmd.action(async (...args) => {
    const command = args.at(-1) as Command
    const opts = args.at(-2) as Record<string, unknown>
    const id = requiresId ? (args[0] as string) : undefined
    if (name === 'create') {
      const { run } = await import('../commands/post/create')
      await run(
        opts as any,
        readGlobalFlags(command),
        readGlobalOptions(command),
      )
    } else if (name === 'edit') {
      const { run } = await import('../commands/post/edit')
      await run(
        id!,
        opts as any,
        readGlobalFlags(command),
        readGlobalOptions(command),
      )
    } else {
      const { run } = await import('../commands/post/update')
      await run(
        id!,
        opts as any,
        readGlobalFlags(command),
        readGlobalOptions(command),
      )
    }
  })
}

function attachPostWriteFlags(cmd: Command) {
  cmd
    .option('--title <s>')
    .option('--slug <s>')
    .option('--category <s>')
    .option('--content <spec>')
    .option('--format <s>', 'lexical | markdown')
    .option('--summary <s>')
    .option('--state <s>', 'publish | draft')
    .option('--tags <csv>', '', (v: string) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .option('--copyright <b>', '', (v: string) => v === 'true')
    .option('--pin <iso>')
    .option('--pin-order <n>', '', (v: string) => Number(v))
    .option('--related <csv>', '', (v: string) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .option('--meta <spec>')
    .option('--file <path>')
}

function addNoteCommands(parent: Command) {
  const note = parent.command('note').description('manage notes')
  note
    .command('list')
    .option('--page <n>', '', (v) => Number(v))
    .option('--size <n>', '', (v) => Number(v))
    .option('--state <s>')
    .option('--sort <s>')
    .action(async (opts, command) => {
      const { run } = await import('../commands/note/list')
      await run(opts, readGlobalFlags(command), readGlobalOptions(command))
    })
  note.command('get <slugOrId>').action(async (id, _opts, command) => {
    const { run } = await import('../commands/note/get')
    await run(id, readGlobalFlags(command), readGlobalOptions(command))
  })
  addNoteWriteCommand(note, 'create')
  addNoteWriteCommand(note, 'edit', true)
  addNoteWriteCommand(note, 'update', true)
  note
    .command('delete <slugOrId>')
    .option('--force')
    .action(async (id, opts, command) => {
      const { run } = await import('../commands/note/delete')
      await run(id, opts, readGlobalFlags(command), readGlobalOptions(command))
    })
  note.command('publish <slugOrId>').action(async (id, _opts, command) => {
    const { run } = await import('../commands/note/publish')
    await run(id, true, readGlobalFlags(command), readGlobalOptions(command))
  })
  note.command('unpublish <slugOrId>').action(async (id, _opts, command) => {
    const { run } = await import('../commands/note/publish')
    await run(id, false, readGlobalFlags(command), readGlobalOptions(command))
  })
}

function addNoteWriteCommand(
  parent: Command,
  name: 'create' | 'edit' | 'update',
  requiresId = false,
) {
  const cmd = parent.command(requiresId ? `${name} <slugOrId>` : `${name}`)
  cmd
    .option('--title <s>')
    .option('--slug <s>')
    .option('--topic <s>')
    .option('--content <spec>')
    .option('--format <s>')
    .option('--state <s>')
    .option('--mood <s>')
    .option('--weather <s>')
    .option('--public-at <iso>')
    .option('--password <s>')
    .option('--bookmark <b>', '', (v: string) => v === 'true')
    .option('--coords <s>')
    .option('--location <s>')
    .option('--images <spec>')
    .option('--meta <spec>')
    .option('--file <path>')
  cmd.action(async (...args) => {
    const command = args.at(-1) as Command
    const opts = args.at(-2) as Record<string, unknown>
    const id = requiresId ? (args[0] as string) : undefined
    if (name === 'create') {
      const { run } = await import('../commands/note/create')
      await run(
        opts as any,
        readGlobalFlags(command),
        readGlobalOptions(command),
      )
    } else if (name === 'edit') {
      const { run } = await import('../commands/note/edit')
      await run(
        id!,
        opts as any,
        readGlobalFlags(command),
        readGlobalOptions(command),
      )
    } else {
      const { run } = await import('../commands/note/update')
      await run(
        id!,
        opts as any,
        readGlobalFlags(command),
        readGlobalOptions(command),
      )
    }
  })
}

function addPageCommands(parent: Command) {
  const page = parent.command('page').description('manage pages')
  page.command('list').action(async (_opts, command) => {
    const { run } = await import('../commands/page/list')
    await run({}, readGlobalFlags(command), readGlobalOptions(command))
  })
  page.command('get <slugOrId>').action(async (id, _opts, command) => {
    const { run } = await import('../commands/page/get')
    await run(id, readGlobalFlags(command), readGlobalOptions(command))
  })
  const writeCmd = (
    name: 'create' | 'edit' | 'update',
    requiresId: boolean,
  ) => {
    const c = page.command(requiresId ? `${name} <slugOrId>` : `${name}`)
    c.option('--title <s>')
      .option('--slug <s>')
      .option('--subtitle <s>')
      .option('--order <n>', '', (v: string) => Number(v))
      .option('--content <spec>')
      .option('--format <s>')
      .option('--meta <spec>')
      .option('--file <path>')
    c.action(async (...args) => {
      const command = args.at(-1) as Command
      const opts = args.at(-2) as Record<string, unknown>
      const id = requiresId ? (args[0] as string) : undefined
      const mod =
        name === 'create'
          ? await import('../commands/page/create')
          : name === 'edit'
            ? await import('../commands/page/edit')
            : await import('../commands/page/update')
      await mod.run(
        id as any,
        opts as any,
        readGlobalFlags(command),
        readGlobalOptions(command),
      )
    })
  }
  writeCmd('create', false)
  writeCmd('edit', true)
  writeCmd('update', true)
  page
    .command('delete <slugOrId>')
    .option('--force')
    .action(async (id, opts, command) => {
      const { run } = await import('../commands/page/delete')
      await run(id, opts, readGlobalFlags(command), readGlobalOptions(command))
    })
}

function addCategoryCommands(parent: Command) {
  const cat = parent.command('category').description('manage categories / tags')
  cat.command('list').action(async (_o, command) => {
    const { run } = await import('../commands/category/list')
    await run(readGlobalFlags(command), readGlobalOptions(command))
  })
  cat.command('get <slugOrId>').action(async (id, _o, command) => {
    const { run } = await import('../commands/category/get')
    await run(id, readGlobalFlags(command), readGlobalOptions(command))
  })
  cat
    .command('create')
    .requiredOption('--name <s>')
    .requiredOption('--slug <s>')
    .option('--type <s>', 'category | tag')
    .option('--icon <s>')
    .action(async (opts, command) => {
      const { run } = await import('../commands/category/create')
      await run(opts, readGlobalFlags(command), readGlobalOptions(command))
    })
  cat
    .command('update <slugOrId>')
    .option('--name <s>')
    .option('--slug <s>')
    .option('--type <s>')
    .option('--icon <s>')
    .action(async (id, opts, command) => {
      const { run } = await import('../commands/category/update')
      await run(id, opts, readGlobalFlags(command), readGlobalOptions(command))
    })
  cat
    .command('delete <slugOrId>')
    .option('--force')
    .action(async (id, opts, command) => {
      const { run } = await import('../commands/category/delete')
      await run(id, opts, readGlobalFlags(command), readGlobalOptions(command))
    })
}

function addTopicCommands(parent: Command) {
  const topic = parent.command('topic').description('manage topics')
  topic.command('list').action(async (_o, command) => {
    const { run } = await import('../commands/topic/list')
    await run(readGlobalFlags(command), readGlobalOptions(command))
  })
  topic.command('get <slugOrId>').action(async (id, _o, command) => {
    const { run } = await import('../commands/topic/get')
    await run(id, readGlobalFlags(command), readGlobalOptions(command))
  })
  topic
    .command('create')
    .requiredOption('--name <s>')
    .requiredOption('--slug <s>')
    .option('--description <s>')
    .option('--icon <s>')
    .action(async (opts, command) => {
      const { run } = await import('../commands/topic/create')
      await run(opts, readGlobalFlags(command), readGlobalOptions(command))
    })
  topic
    .command('update <slugOrId>')
    .option('--name <s>')
    .option('--slug <s>')
    .option('--description <s>')
    .option('--icon <s>')
    .action(async (id, opts, command) => {
      const { run } = await import('../commands/topic/update')
      await run(id, opts, readGlobalFlags(command), readGlobalOptions(command))
    })
  topic
    .command('delete <slugOrId>')
    .option('--force')
    .action(async (id, opts, command) => {
      const { run } = await import('../commands/topic/delete')
      await run(id, opts, readGlobalFlags(command), readGlobalOptions(command))
    })
}

function addConfigCommands(parent: Command) {
  const cfg = parent.command('config').description('manage server options')
  cfg.command('list').action(async (_o, command) => {
    const { run } = await import('../commands/config/list')
    await run(readGlobalFlags(command), readGlobalOptions(command))
  })
  cfg.command('get <key>').action(async (key, _o, command) => {
    const { run } = await import('../commands/config/get')
    await run(key, readGlobalFlags(command), readGlobalOptions(command))
  })
  cfg
    .command('set <key> <value>')
    .option('--type <t>', 'json | string | number | bool')
    .action(async (key, value, opts, command) => {
      const { run } = await import('../commands/config/set')
      await run(
        key,
        value,
        opts,
        readGlobalFlags(command),
        readGlobalOptions(command),
      )
    })
  cfg.command('edit').action(async (_o, command) => {
    const { run } = await import('../commands/config/edit')
    await run(readGlobalFlags(command), readGlobalOptions(command))
  })
}

void MxsError
