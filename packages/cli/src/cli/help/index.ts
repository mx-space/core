// ---------------------------------------------------------------------------
// Root `--help` + group help renderers.
//
// Why a custom renderer? `@effect/cli` flattens every nested verb into the
// root COMMANDS section and aligns columns to the longest line, producing a
// huge wall of whitespace. It also can't see our pre-parsed global flags
// (those are stripped from argv before `Command.run` is invoked — see
// `domain/runtime-flags.ts`), so they never appear under OPTIONS.
//
// Scope:
//   - Root `mxs --help` (and bare `mxs`)            → custom renderer here.
//   - Top-level group help (`mxs <group> --help`,
//     `mxs <group>`)                                → custom renderer here.
//   - Verb help (`mxs post create --help`, ...)     → @effect/cli default.
//
// Per-command help content lives next to each command module via the
// `registerCommandHelp` call (see `./registry.ts`). This file aggregates
// nothing description-wise — it only owns:
//   - the global-flag table (not per-command),
//   - the canonical display order of top-level commands,
//   - markdown → ANSI rendering + banner composition.
//
// The side-effect imports below ensure every command module has been loaded
// (and has called `registerCommandHelp`) before the renderers run. Required
// for direct importers of this module (e.g. unit tests) that don't go
// through `bin/mxs.ts`.
// ---------------------------------------------------------------------------

import '../ai'
import '../auth'
import '../category'
import '../comment'
import '../config'
import '../draft'
import '../note'
import '../page'
import '../post'
import '../preview'
import '../profile'
import '../project'
import '../skill'
import '../snippet'
import '../topic'
import '../update'

import {
  ANSI,
  isColorEnabled,
  renderMarkdownToAnsi,
  type RenderOptions,
  wrap,
} from '../render/markdown'
import {
  type CommandHelp,
  getCommandHelp,
  type LeafOptionHelp,
  type VerbDescriptor,
} from './registry'

export { renderMarkdownToAnsi } from '../render/markdown'
export {
  type CommandHelp,
  isLeafCommand,
  type LeafOptionHelp,
  registerCommandHelp,
  type VerbDescriptor,
} from './registry'

// ---------------------------------------------------------------------------
// Canonical display order for the root `mxs --help` table and the set of
// names the bin treats as known top-level commands. Decoupled from the
// (alphabetised) import order at the top of this file.
// ---------------------------------------------------------------------------

export const GROUP_NAMES = [
  'auth',
  'profile',
  'post',
  'note',
  'page',
  'draft',
  'project',
  'category',
  'topic',
  'comment',
  'snippet',
  'ai',
  'config',
  'skill',
  'preview',
  'update',
] as const

export type GroupName = (typeof GROUP_NAMES)[number]

export const isGroupName = (s: string): s is GroupName =>
  (GROUP_NAMES as readonly string[]).includes(s)

const orderedCommandHelp = (): readonly CommandHelp[] =>
  GROUP_NAMES.map((name) => getCommandHelp(name)).filter(
    (c): c is CommandHelp => c !== undefined,
  )

// ---------------------------------------------------------------------------
// Root help data + renderer.
// ---------------------------------------------------------------------------

export interface GlobalOptionHelp {
  readonly flag: string
  readonly description: string
}

export interface SubcommandHelp {
  readonly name: string
  readonly description: string
  readonly verbs?: readonly string[]
}

export interface RootHelpData {
  readonly programName: string
  readonly version: string
  readonly description: string
  readonly globalOptions: readonly GlobalOptionHelp[]
  readonly commands: readonly SubcommandHelp[]
  readonly examples?: readonly { command: string; description: string }[]
}

const ROOT_DESCRIPTION =
  'mx-space CLI — manage your mx-core blog from the command line.'

const GLOBAL_OPTIONS: readonly GlobalOptionHelp[] = [
  {
    flag: '--json',
    description: 'emit JSON output (shorthand for `--output json`)',
  },
  {
    flag: '--output <mode>',
    description: 'one of: readable (default), pretty-json, json, llm, xml',
  },
  { flag: '--api-url <url>', description: 'override the configured API URL' },
  { flag: '--token <t>', description: 'override the stored access token' },
  {
    flag: '--api-key <key>',
    description: 'authenticate with an x-api-key API key',
  },
  {
    flag: '--lang <code>',
    description: 'request translated read data for a locale',
  },
  { flag: '--profile <name>', description: 'profile to use' },
  { flag: '-q, --quiet', description: 'suppress non-error stderr' },
  { flag: '--verbose', description: 'log HTTP method/url/status/duration' },
  {
    flag: '--dry-run',
    description: 'show resolved payload without calling the server',
  },
  { flag: '-h, --help', description: 'show this help' },
  { flag: '--version', description: 'print version and exit' },
]

export const buildRootHelpData = (version: string): RootHelpData => ({
  programName: 'mxs',
  version,
  description: ROOT_DESCRIPTION,
  globalOptions: GLOBAL_OPTIONS,
  commands: orderedCommandHelp().map(
    (c): SubcommandHelp => ({
      name: c.name,
      description: c.description,
      verbs: c.verbs?.map((v) => v.name),
    }),
  ),
})

const formatVerbs = (verbs?: readonly string[]): string => {
  if (!verbs || verbs.length === 0) return ''
  return ` (${verbs.join(', ')})`
}

export const renderRootHelp = (data: RootHelpData): string => {
  // The banner is rendered separately by `emitHelp`. We emit a short tagline
  // line first (after the banner) so the full description is still searchable
  // in piped output; the banner only shows the short form.
  const lines: string[] = [
    data.description,
    '',
    '## Bundled skill (for AI agents)',
    '',
    `Per-command \`--help\` covers most usage. For deeper context — content authoring, LiteXML envelopes, output modes, mutation safety, AI artifacts — \`${data.programName} skill\` lists bundled chapters; \`${data.programName} skill get <slug>\` prints one as raw markdown. Pass \`--output llm\` for ANSI-free output.`,
    '',
    '## Usage',
    '',
    `    ${data.programName} [global-options] <command> [command-options] [args]`,
    '',
    '## Global options',
    '',
    '| Flag | Description |',
    '| ---- | ----------- |',
  ]

  for (const opt of data.globalOptions) {
    lines.push(`| \`${opt.flag}\` | ${opt.description} |`)
  }
  lines.push('')

  lines.push('## Commands')
  lines.push('')
  lines.push('| Command | Description |')
  lines.push('| ------- | ----------- |')
  for (const cmd of data.commands) {
    const desc = `${cmd.description}${formatVerbs(cmd.verbs)}`
    lines.push(`| \`${cmd.name}\` | ${desc} |`)
  }
  lines.push('')

  lines.push('## Per-command help')
  lines.push('')
  lines.push(
    `Run \`${data.programName} <command> --help\` for the full option list of a specific command.`,
  )
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Banner + emitters.
// ---------------------------------------------------------------------------

/**
 * Render the banner line `<title> — <subtitle>` followed by a dim rule.
 * The rule width matches the visible width of the banner line, capped at
 * the terminal width (or 80 as fallback).
 */
const renderBanner = (
  title: string,
  subtitle: string,
  opts: RenderOptions,
): string => {
  const sep = ' — '
  const plainLine = `${title}${sep}${subtitle}`
  const termWidth =
    process.stdout.columns && process.stdout.columns > 0
      ? process.stdout.columns
      : 80
  const ruleWidth = Math.min(plainLine.length, termWidth)
  const styledLine =
    wrap(`${ANSI.bold}${ANSI.magenta}`, title, opts.color) +
    wrap(ANSI.dim, sep, opts.color) +
    wrap(ANSI.bold, subtitle, opts.color)
  const rule = wrap(ANSI.dim, '─'.repeat(ruleWidth), opts.color)
  return `${styledLine}\n${rule}\n`
}

/**
 * Render the root help and write it to stdout, followed by a trailing
 * newline. Honors `NO_COLOR` and non-TTY stdout (strips ANSI styling).
 */
export const emitHelp = (data: RootHelpData): void => {
  const color = isColorEnabled(process.stdout)
  // Banner subtitle is the short tagline only — split off the first segment
  // of the description (before " — "), so the banner stays compact. The full
  // description is rendered as a paragraph by `renderRootHelp`.
  const tagline = data.description.split(' — ')[0] || data.description
  const banner = renderBanner(`${data.programName} ${data.version}`, tagline, {
    color,
  })
  const md = renderRootHelp(data)
  const ansi = renderMarkdownToAnsi(md, { color })
  process.stdout.write(banner + ansi + '\n')
}

// ---------------------------------------------------------------------------
// Group-level help renderer.
//
// Covers `mxs <group>` and `mxs <group> --help` for every top-level command.
// For real groups (e.g. `post`, `auth`) we render a Verbs table; for leaf
// top-level commands (`update`) we render an Options table from the
// `leafOptions` registered alongside the command. Verb-level help
// (`mxs post create --help`) is intentionally left to `@effect/cli`'s
// default renderer.
// ---------------------------------------------------------------------------

export interface GroupHelpData {
  readonly programName: string
  readonly version: string
  readonly groupName: string
  readonly description: string
  readonly verbs: readonly VerbDescriptor[]
  readonly isLeaf?: boolean
  readonly leafOptions?: readonly LeafOptionHelp[]
  readonly skillChapter?: string
}

const renderVerbSignature = (verb: VerbDescriptor): string => {
  const parts = [verb.name, ...(verb.args ?? [])]
  return parts.join(' ')
}

export const groupHelpDataFor = (
  name: string,
  version: string,
): GroupHelpData => {
  const entry = getCommandHelp(name)
  if (!entry) {
    throw new Error(`unknown group: ${name}`)
  }
  return {
    programName: 'mxs',
    version,
    groupName: name,
    description: entry.description,
    verbs: entry.verbs ?? [],
    isLeaf: entry.isLeaf,
    leafOptions: entry.leafOptions,
    skillChapter: entry.skillChapter,
  }
}

export const renderGroupHelp = (data: GroupHelpData): string => {
  // The banner is rendered separately by `emitGroupHelp`. Body starts here.
  const lines: string[] = ['## Usage', '']
  if (data.isLeaf) {
    lines.push(
      `    ${data.programName} [global-options] ${data.groupName} [options]`,
    )
  } else {
    lines.push(
      `    ${data.programName} [global-options] ${data.groupName} <verb> [verb-options] [args]`,
    )
  }
  lines.push('')

  if (data.isLeaf) {
    const opts = data.leafOptions ?? []
    if (opts.length > 0) {
      lines.push('## Options')
      lines.push('')
      lines.push('| Flag | Description |')
      lines.push('| ---- | ----------- |')
      for (const o of opts) {
        lines.push(`| \`${o.flag}\` | ${o.description} |`)
      }
      lines.push('')
    }
  } else {
    lines.push('## Verbs')
    lines.push('')
    lines.push('| Verb | Description |')
    lines.push('| ---- | ----------- |')
    for (const v of data.verbs) {
      lines.push(`| \`${renderVerbSignature(v)}\` | ${v.description} |`)
    }
    lines.push('')
  }

  lines.push('## Global options')
  lines.push('')
  lines.push(`See \`${data.programName} --help\` for the global flag list.`)
  lines.push('')

  if (!data.isLeaf) {
    lines.push('## Help')
    lines.push('')
    lines.push(
      `Use \`${data.programName} ${data.groupName} <verb> --help\` for the full options of a verb.`,
    )
    lines.push('')
  }

  lines.push('## Bundled skill (for AI agents)')
  lines.push('')
  if (data.skillChapter) {
    lines.push(
      `For deeper reference: \`${data.programName} skill get ${data.skillChapter}\` (or \`${data.programName} skill\` for the full list).`,
    )
  } else {
    lines.push(
      `For deeper reference run \`${data.programName} skill\` to see the bundled chapter list.`,
    )
  }
  lines.push('')

  return lines.join('\n')
}

export const emitGroupHelp = (data: GroupHelpData): void => {
  const color = isColorEnabled(process.stdout)
  const banner = renderBanner(
    `${data.programName} ${data.groupName}`,
    data.description,
    { color },
  )
  const md = renderGroupHelp(data)
  const ansi = renderMarkdownToAnsi(md, { color })
  process.stdout.write(banner + ansi + '\n')
}
