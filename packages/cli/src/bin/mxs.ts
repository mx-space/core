#!/usr/bin/env node
import { createRequire } from 'node:module'

import { Command } from 'commander'

import {
  DEV_DEFAULT_PROFILE_ENV,
  DEV_DEFAULT_PROFILE_NAME,
  shouldUseDevDefaultProfile,
} from '../core/config-store'
import { exitCodeForError, MxsError, MxsErrorCode } from '../core/errors'
import { runLegacyMigrationIfNeeded } from '../core/migration'
import { emitError, type OutputOptions } from '../core/output'
import { requiresActiveProfile } from '../core/preaction-guards'
import { getCurrentProfile, validateProfileName } from '../core/profile'
import { buildContextFromFlags, maybeNotify } from '../core/update-notifier'

const require = createRequire(import.meta.url)
const { version: CLI_VERSION } = require('../../package.json') as {
  version: string
}

if (import.meta.url.endsWith('/src/bin/mxs.ts')) {
  process.env[DEV_DEFAULT_PROFILE_ENV] ??= '1'
}

interface GlobalOptions {
  json?: boolean
  output?: string
  apiUrl?: string
  token?: string
  apiKey?: string
  lang?: string
  quiet?: boolean
  verbose?: boolean
  dryRun?: boolean
  profile?: string
}

const program = new Command()

program
  .name('mxs')
  .description('mx-space CLI — manage your mx-core blog from the command line')
  .version(CLI_VERSION)
  .option('--json', 'emit JSON output')
  .option('--output <mode>', 'pretty-json | json | readable | llm | envelope')
  .option('--api-url <url>', 'override the configured API URL')
  .option('--token <t>', 'override the stored access token')
  .option('--api-key <key>', 'authenticate with an x-api-key API key')
  .option('--lang <code>', 'request translated read data for a locale')
  .option('-q, --quiet', 'suppress non-error stderr')
  .option('--verbose', 'log HTTP method/url/status/duration')
  .option('--dry-run', 'show resolved payload without calling the server')
  .option(
    '--profile <name>',
    'profile to use (overrides MXS_PROFILE and the active profile pointer)',
  )

program.hook('preAction', async (thisCommand, actionCommand) => {
  const opts = thisCommand.optsWithGlobals() as GlobalOptions
  if (opts.profile) {
    try {
      validateProfileName(opts.profile)
    } catch (err) {
      if (err instanceof MxsError) {
        throw new MxsError({
          code: MxsErrorCode.ProfileInvalidName,
          message: err.message,
          hint: 'profile name must match ^[a-z0-9_-]{1,32}$ and must not be "current"',
        })
      }
      throw err
    }
  }
  const report = opts.quiet ? null : undefined
  await runLegacyMigrationIfNeeded({ report })

  // Guard: if no profile can be resolved and no URL override is in play,
  // throw profile.none_active so the error surface is clean.
  //
  // Exempt commands are declared in core/preaction-guards.ts (single source of
  // truth). Commander short-circuits --help / --version before reaching preAction.
  const currentProfile = await getCurrentProfile()
  const effectiveCurrentProfile =
    currentProfile ||
    (shouldUseDevDefaultProfile({
      profileOverride: opts.profile,
      envProfile: process.env.MXS_PROFILE,
      apiUrlOverride: opts.apiUrl,
      envApiUrl: process.env.MXS_API_URL,
      currentProfile,
    })
      ? DEV_DEFAULT_PROFILE_NAME
      : null)
  if (
    requiresActiveProfile({
      profileFlag: opts.profile,
      apiUrlFlag: opts.apiUrl,
      envProfile: process.env.MXS_PROFILE?.trim(),
      envApiUrl: process.env.MXS_API_URL?.trim(),
      currentProfile: effectiveCurrentProfile,
      parentName: actionCommand.parent?.name() ?? '',
      commandName: actionCommand.name(),
    })
  ) {
    throw new MxsError({
      code: MxsErrorCode.ProfileNoneActive,
      message: 'no active mxs profile',
      hint: 'run `mxs profile use <name>` to switch, or `mxs auth login --profile <name>` to create one',
    })
  }

  // Fire-and-forget passive update notifier.
  void maybeNotify(
    buildContextFromFlags({
      currentVersion: CLI_VERSION,
      flags: { quiet: opts.quiet, json: opts.json, output: opts.output },
      commandName: actionCommand.name(),
      parentName: actionCommand.parent?.name() ?? '',
    }),
  )
})

addAuthCommands(program)
addProfileCommands(program)
addPostCommands(program)
addNoteCommands(program)
addPageCommands(program)
addCategoryCommands(program)
addTopicCommands(program)
addConfigCommands(program)
addUpdateCommand(program)

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

function addUpdateCommand(parent: Command) {
  parent
    .command('update')
    .description('check for and install a newer mxs release')
    .option('--check', 'compare versions only; do not install')
    .option('--prerelease', 'use the `next` dist-tag channel')
    .option('--pm <name>', 'force package manager: npm | pnpm | yarn | bun')
    .option('--force', 'bypass the 24h passive-check cache')
    .option('--yes', 'skip the confirmation prompt')
    .action(async (opts, command) => {
      const { run } = await import('../commands/update/run')
      await run(
        {
          check: opts.check as boolean | undefined,
          prerelease: opts.prerelease as boolean | undefined,
          pm: opts.pm as string | undefined,
          force: opts.force as boolean | undefined,
          yes: opts.yes as boolean | undefined,
        },
        readGlobalFlags(command),
        readGlobalOptions(command),
        CLI_VERSION,
      )
    })
}

function addAuthCommands(parent: Command) {
  const auth = parent.command('auth').description('authentication')
  auth
    .command('login')
    .description('start device authorization flow')
    .option('--production', 'mark the target profile as production after login')
    .action(async (opts, command) => {
      const { run } = await import('../commands/auth/login')
      await run(readGlobalFlags(command), readGlobalOptions(command), {
        production: opts.production,
      })
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

function addProfileCommands(parent: Command) {
  const profile = parent.command('profile').description('manage mxs profiles')
  profile
    .command('ls')
    .description('list profiles')
    .action(async (_opts, command) => {
      const { run } = await import('../commands/profile/ls')
      await run(readGlobalFlags(command), readGlobalOptions(command))
    })
  profile
    .command('show [name]')
    .description('show resolved info for a profile')
    .action(async (name, _opts, command) => {
      const { run } = await import('../commands/profile/show')
      await run(
        name as string | undefined,
        readGlobalFlags(command),
        readGlobalOptions(command),
      )
    })
  profile
    .command('use <name>')
    .description('set the active profile')
    .action(async (name, _opts, command) => {
      const { run } = await import('../commands/profile/use')
      await run(name, readGlobalFlags(command), readGlobalOptions(command))
    })
  profile
    .command('mark <name>')
    .description('toggle production flag on a profile')
    .option('--production', 'mark profile as production')
    .option('--no-production', 'mark profile as non-production')
    .action(async (name, opts, command) => {
      const { run } = await import('../commands/profile/mark')
      await run(
        name,
        { production: opts.production as boolean | undefined },
        readGlobalFlags(command),
        readGlobalOptions(command),
      )
    })
  profile
    .command('rm <name>')
    .description('remove a profile')
    .option('--force', 'skip confirmation and allow removing current profile')
    .action(async (name, opts, command) => {
      const { run } = await import('../commands/profile/rm')
      await run(
        name,
        opts,
        readGlobalFlags(command),
        readGlobalOptions(command),
      )
    })
}

void MxsError
