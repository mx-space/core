// ---------------------------------------------------------------------------
// Root `--help` renderer.
//
// Why a custom renderer? `@effect/cli` flattens every nested verb into the
// root COMMANDS section and aligns columns to the longest line, producing a
// huge wall of whitespace. It also can't see our pre-parsed global flags
// (those are stripped from argv before `Command.run` is invoked — see
// `domain/runtime-flags.ts`), so they never appear under OPTIONS.
//
// Scope: ONLY the root `mxs --help` (and bare `mxs`) is overridden here.
// Subcommand help (`mxs post --help`, `mxs auth login --help`, ...) still
// goes through `@effect/cli`'s built-in renderer — those depth-2/3 pages are
// reasonable as-is, and replacing them would duplicate effort.
//
// The markdown source is rendered to ANSI in-process by a minimal renderer
// that handles the subset we use: ATX headings, paragraphs, bold/code spans,
// fenced code blocks, and a simple two-column GFM table. NO_COLOR and
// non-TTY stdout disable ANSI styling.
// ---------------------------------------------------------------------------

export interface SubcommandHelp {
  readonly name: string
  readonly description: string
  readonly verbs?: readonly string[]
}

export interface GlobalOptionHelp {
  readonly flag: string
  readonly description: string
}

export interface RootHelpData {
  readonly programName: string
  readonly version: string
  readonly description: string
  readonly globalOptions: readonly GlobalOptionHelp[]
  readonly commands: readonly SubcommandHelp[]
  readonly examples?: readonly { command: string; description: string }[]
}

// ---------------------------------------------------------------------------
// Static help data — kept here (rather than next to the bin) so unit tests
// can import it cheaply without pulling the full bin module graph.
// ---------------------------------------------------------------------------

export const buildRootHelpData = (version: string): RootHelpData => ({
  programName: 'mxs',
  version,
  description: 'mx-space CLI — manage your mx-core blog from the command line.',
  globalOptions: [
    {
      flag: '--json',
      description: 'emit JSON output (shorthand for `--output json`)',
    },
    {
      flag: '--output <mode>',
      description: 'one of: pretty-json, json, readable, llm, envelope',
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
  ],
  commands: [
    {
      name: 'auth',
      description: 'authentication',
      verbs: ['login', 'logout', 'whoami', 'status'],
    },
    {
      name: 'profile',
      description: 'manage mxs profiles',
      verbs: ['ls', 'show', 'use', 'mark', 'rm'],
    },
    {
      name: 'post',
      description: 'manage posts',
      verbs: [
        'list',
        'get',
        'create',
        'edit',
        'update',
        'delete',
        'publish',
        'unpublish',
      ],
    },
    {
      name: 'note',
      description: 'manage notes',
      verbs: [
        'list',
        'get',
        'create',
        'edit',
        'update',
        'delete',
        'publish',
        'unpublish',
      ],
    },
    {
      name: 'page',
      description: 'manage pages',
      verbs: ['list', 'get', 'create', 'edit', 'update', 'delete'],
    },
    {
      name: 'category',
      description: 'manage categories / tags',
      verbs: ['list', 'get', 'create', 'update', 'delete'],
    },
    {
      name: 'topic',
      description: 'manage topics',
      verbs: ['list', 'get', 'create', 'update', 'delete'],
    },
    {
      name: 'config',
      description: 'manage server options',
      verbs: ['list', 'get', 'set', 'edit'],
    },
    {
      name: 'update',
      description: 'check for and install a newer mxs release',
    },
  ],
})

// ---------------------------------------------------------------------------
// Markdown source generation.
// ---------------------------------------------------------------------------

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
// Minimal markdown → ANSI renderer.
//
// We deliberately hand-roll instead of pulling in `marked-terminal` (~270 KB
// of transitive deps incl. cli-highlight, node-emoji, cli-table3) because:
//   (a) our markdown subset is tiny and fully under our control,
//   (b) the CLI is already over its bundle budget,
//   (c) we want zero runtime surprises around NO_COLOR / non-TTY detection.
//
// Supported constructs:
//   - `# heading`, `## heading`            → bold + colour
//   - paragraphs                            → as-is (with inline span parsing)
//   - 4-space indented code blocks          → dim + grey-ish
//   - fenced code blocks (```...```)        → same
//   - GFM-style two-column tables           → padded, header bold
//   - `**bold**`, ``code spans``           → ANSI bold / cyan
//   - list items (`- foo`)                  → preserved
// ---------------------------------------------------------------------------

interface RenderOptions {
  readonly color: boolean
}

const ANSI = {
  reset: '\x1B[0m',
  bold: '\x1B[1m',
  dim: '\x1B[2m',
  cyan: '\x1B[36m',
  yellow: '\x1B[33m',
  green: '\x1B[32m',
  magenta: '\x1B[35m',
} as const

const wrap = (code: string, text: string, on: boolean): string =>
  on ? `${code}${text}${ANSI.reset}` : text

/**
 * Parse inline spans inside a single line of paragraph text.
 *
 * Order matters: we strip inline code spans first (so their contents are
 * never re-interpreted as bold), then bold.
 */
const renderInline = (line: string, opts: RenderOptions): string => {
  // Inline code: `text`
  let out = line.replaceAll(/`([^`]+)`/g, (_m, inner) =>
    wrap(ANSI.cyan, inner, opts.color),
  )
  // Bold: **text**
  out = out.replaceAll(/\*\*([^*]+)\*\*/g, (_m, inner) =>
    wrap(ANSI.bold, inner, opts.color),
  )
  return out
}

interface TableRow {
  readonly cells: readonly string[]
}

const parseTable = (
  source: readonly string[],
  start: number,
): { rows: TableRow[]; end: number } | null => {
  // Header row must start with `|` and the next row must be the alignment row
  // matching the same pipe layout.
  if (start + 1 >= source.length) return null
  const header = source[start]
  const sep = source[start + 1]
  if (!header.startsWith('|') || !sep.startsWith('|')) return null
  // eslint-disable-next-line regexp/no-super-linear-backtracking, unicorn/better-regex -- separator-row regex; safe in practice (literal `|` anchors each cell)
  if (!/^(?:\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*$/.test(sep)) return null

  const splitRow = (row: string): string[] => {
    const cells = row.split('|').map((c) => c.trim())
    // Strip leading/trailing empties created by the surrounding pipes.
    if (cells.length > 0 && cells[0] === '') cells.shift()
    if (cells.length > 0 && cells.at(-1) === '') cells.pop()
    return cells
  }

  const rows: TableRow[] = [{ cells: splitRow(header) }]
  let i = start + 2
  while (i < source.length) {
    const row = source[i]
    if (!row.startsWith('|')) break
    rows.push({ cells: splitRow(row) })
    i++
  }
  return { rows, end: i }
}

const renderTable = (
  rows: readonly TableRow[],
  opts: RenderOptions,
): string => {
  if (rows.length === 0) return ''
  // Render each cell through inline span parsing first so we can measure
  // visible width (post inline-styling, the ANSI sequences add no visible
  // width).
  const rendered: string[][] = rows.map((r) =>
    r.cells.map((c) => renderInline(c, opts)),
  )

  // Compute column widths from the *visible* (ANSI-stripped) text.
  const visibleLen = (s: string): number =>
    // eslint-disable-next-line no-control-regex
    s.replaceAll(/\x1B\[[\d;]*m/g, '').length

  const numCols = Math.max(...rendered.map((r) => r.length))
  const widths: number[] = []
  for (let c = 0; c < numCols; c++) {
    let max = 0
    for (const row of rendered) {
      const cell = row[c] ?? ''
      if (visibleLen(cell) > max) max = visibleLen(cell)
    }
    widths.push(max)
  }

  const padRight = (s: string, width: number): string => {
    const visible = visibleLen(s)
    return visible < width ? s + ' '.repeat(width - visible) : s
  }

  const lines: string[] = []
  rendered.forEach((row, rowIdx) => {
    const cells = row.map((cell, idx) => padRight(cell, widths[idx]))
    if (rowIdx === 0) {
      // Header: bold the cells (text already styled via renderInline; wrap
      // the whole row in bold for emphasis).
      lines.push(
        '  ' + cells.map((c) => wrap(ANSI.bold, c, opts.color)).join('  '),
      )
      // Underline rule.
      lines.push(
        '  ' +
          widths
            .map((w) => wrap(ANSI.dim, '-'.repeat(w), opts.color))
            .join('  '),
      )
    } else {
      lines.push('  ' + cells.join('  '))
    }
  })
  return lines.join('\n')
}

const renderHeading = (
  level: number,
  text: string,
  opts: RenderOptions,
): string => {
  const styled = renderInline(text, opts)
  if (level === 1) {
    return wrap(`${ANSI.bold}${ANSI.magenta}`, styled, opts.color)
  }
  if (level === 2) {
    return wrap(`${ANSI.bold}${ANSI.yellow}`, styled.toUpperCase(), opts.color)
  }
  return wrap(ANSI.bold, styled, opts.color)
}

export const renderMarkdownToAnsi = (
  markdown: string,
  opts: RenderOptions,
): string => {
  const source = markdown.split('\n')
  const out: string[] = []
  let i = 0
  while (i < source.length) {
    const line = source[i]

    // Fenced code block.
    if (line.startsWith('```')) {
      i++
      const code: string[] = []
      while (i < source.length && !source[i].startsWith('```')) {
        code.push(source[i])
        i++
      }
      if (i < source.length) i++ // skip closing fence
      for (const c of code) {
        out.push('  ' + wrap(ANSI.dim, c, opts.color))
      }
      continue
    }

    // Indented code (4 spaces).
    if (line.startsWith('    ')) {
      out.push('  ' + wrap(ANSI.cyan, line.slice(4), opts.color))
      i++
      continue
    }

    // Heading.
    const headingMatch = /^(#{1,6}) (.+)$/.exec(line)
    if (headingMatch) {
      const level = headingMatch[1].length
      // Blank line before non-leading headings, for breathing room.
      if (out.length > 0 && out.at(-1) !== '') out.push('')
      out.push(renderHeading(level, headingMatch[2], opts))
      i++
      continue
    }

    // Table.
    if (line.startsWith('|')) {
      const parsed = parseTable(source, i)
      if (parsed) {
        out.push(renderTable(parsed.rows, opts))
        i = parsed.end
        continue
      }
    }

    // List item.
    if (/^[*-]\s+/.test(line)) {
      const rest = line.replace(/^[*-]\s+/, '')
      out.push('  • ' + renderInline(rest, opts))
      i++
      continue
    }

    // Blank line.
    if (line.trim() === '') {
      out.push('')
      i++
      continue
    }

    // Plain paragraph.
    out.push(renderInline(line, opts))
    i++
  }
  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Public emitters.
// ---------------------------------------------------------------------------

const isColorEnabled = (stream: NodeJS.WriteStream): boolean => {
  if (process.env.NO_COLOR && process.env.NO_COLOR !== '') return false
  return Boolean(stream.isTTY)
}

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
// top-level commands (`update`) we render an Options table built from a
// hand-curated `leafOptions` list. Verb-level help (`mxs post create --help`)
// is intentionally left to `@effect/cli`'s default renderer.
// ---------------------------------------------------------------------------

export interface VerbDescriptor {
  readonly name: string
  readonly args?: readonly string[]
  readonly description: string
}

export interface LeafOptionHelp {
  readonly flag: string
  readonly description: string
}

export interface GroupHelpData {
  readonly programName: string
  readonly version: string
  readonly groupName: string
  readonly description: string
  readonly verbs: readonly VerbDescriptor[]
  readonly isLeaf?: boolean
  readonly leafOptions?: readonly LeafOptionHelp[]
}

const renderVerbSignature = (verb: VerbDescriptor): string => {
  const parts = [verb.name, ...(verb.args ?? [])]
  return parts.join(' ')
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

// ---------------------------------------------------------------------------
// Static group descriptors.
//
// Verb names + descriptions mirror each `Command.withDescription(...)` in
// `src/cli/<group>/<verb>.ts` (or the legacy v0.2.x bin where the new code
// dropped descriptions). Flag signatures in the `args` column are
// hand-curated short summaries — the canonical, exhaustive option list lives
// in the per-verb `Command.make(...)` definition and surfaces via
// `mxs <group> <verb> --help`.
// ---------------------------------------------------------------------------

const GROUPS = {
  auth: {
    description: 'authentication',
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
  },
  profile: {
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
  },
  post: {
    description: 'manage posts',
    verbs: [
      {
        name: 'list',
        args: ['[--page <n>]', '[--size <n>]', '[--state <s>]', '[--sort <s>]'],
        description: 'list posts',
      },
      { name: 'get', args: ['<slugOrId>'], description: 'show a single post' },
      {
        name: 'create',
        args: ['[--title ...]', '[--file <path>]', '...'],
        description: 'create a post',
      },
      {
        name: 'edit',
        args: ['<slugOrId>', '[--file <path>]', '...'],
        description: 'edit a post via $EDITOR or flags',
      },
      {
        name: 'update',
        args: ['<slugOrId>', '[--title ...]', '...'],
        description: 'partially update a post',
      },
      {
        name: 'delete',
        args: ['<slugOrId>', '[--force]'],
        description: 'delete a post',
      },
      { name: 'publish', args: ['<slugOrId>'], description: 'publish a post' },
      {
        name: 'unpublish',
        args: ['<slugOrId>'],
        description: 'unpublish a post',
      },
    ],
  },
  note: {
    description: 'manage notes',
    verbs: [
      {
        name: 'list',
        args: ['[--page <n>]', '[--size <n>]', '[--state <s>]', '[--sort <s>]'],
        description: 'list notes',
      },
      {
        name: 'get',
        args: ['<slugOrId>'],
        description: 'get a note by snowflake id or numeric nid',
      },
      {
        name: 'create',
        args: ['[--title ...]', '[--file <path>]', '...'],
        description: 'create a note',
      },
      {
        name: 'edit',
        args: ['<slugOrId>', '[--file <path>]', '...'],
        description: 'edit a note via $EDITOR or flags',
      },
      {
        name: 'update',
        args: ['<slugOrId>', '[--title ...]', '...'],
        description: 'partially update a note',
      },
      {
        name: 'delete',
        args: ['<slugOrId>', '[--force]'],
        description: 'delete a note',
      },
      { name: 'publish', args: ['<slugOrId>'], description: 'publish a note' },
      {
        name: 'unpublish',
        args: ['<slugOrId>'],
        description: 'unpublish a note',
      },
    ],
  },
  page: {
    description: 'manage pages',
    verbs: [
      { name: 'list', description: 'list pages' },
      { name: 'get', args: ['<slugOrId>'], description: 'show a single page' },
      {
        name: 'create',
        args: ['[--title ...]', '[--file <path>]', '...'],
        description: 'create a page',
      },
      {
        name: 'edit',
        args: ['<slugOrId>', '[--file <path>]', '...'],
        description: 'edit a page via $EDITOR or flags',
      },
      {
        name: 'update',
        args: ['<slugOrId>', '[--title ...]', '...'],
        description: 'partially update a page',
      },
      {
        name: 'delete',
        args: ['<slugOrId>', '[--force]'],
        description: 'delete a page',
      },
    ],
  },
  category: {
    description: 'manage categories / tags',
    verbs: [
      { name: 'list', description: 'list categories and tags' },
      {
        name: 'get',
        args: ['<slugOrId>'],
        description: 'show a single category',
      },
      {
        name: 'create',
        args: [
          '--name <n>',
          '--slug <s>',
          '[--type <category/tag>]',
          '[--icon ...]',
        ],
        description: 'create a category or tag',
      },
      {
        name: 'update',
        args: ['<slugOrId>', '[--name ...]', '[--slug ...]', '...'],
        description: 'update a category',
      },
      {
        name: 'delete',
        args: ['<slugOrId>', '[--force]'],
        description: 'delete a category',
      },
    ],
  },
  topic: {
    description: 'manage topics',
    verbs: [
      { name: 'list', description: 'list topics' },
      { name: 'get', args: ['<slugOrId>'], description: 'show a single topic' },
      {
        name: 'create',
        args: [
          '--name <n>',
          '--slug <s>',
          '[--description ...]',
          '[--icon ...]',
        ],
        description: 'create a topic',
      },
      {
        name: 'update',
        args: ['<slugOrId>', '[--name ...]', '...'],
        description: 'update a topic',
      },
      {
        name: 'delete',
        args: ['<slugOrId>', '[--force]'],
        description: 'delete a topic',
      },
    ],
  },
  config: {
    description: 'manage server options',
    verbs: [
      { name: 'list', description: 'list all server options' },
      { name: 'get', args: ['<key>'], description: 'read one server option' },
      {
        name: 'set',
        args: ['<key>', '<value>', '[--type <json/string/number/bool>]'],
        description: 'set a server option',
      },
      { name: 'edit', description: 'edit all server options via $EDITOR' },
    ],
  },
} as const

const UPDATE_LEAF: {
  readonly description: string
  readonly options: readonly LeafOptionHelp[]
} = {
  description: 'check for and install a newer mxs release',
  options: [
    { flag: '--check', description: 'compare versions only; do not install' },
    { flag: '--prerelease', description: 'use the `next` dist-tag channel' },
    {
      flag: '--pm <name>',
      description: 'force package manager (one of: npm, pnpm, yarn, bun)',
    },
    { flag: '--force', description: 'bypass the 24h passive-check cache' },
    { flag: '--yes', description: 'skip the confirmation prompt' },
  ],
}

export const GROUP_NAMES = [
  'auth',
  'profile',
  'post',
  'note',
  'page',
  'category',
  'topic',
  'config',
  'update',
] as const

export type GroupName = (typeof GROUP_NAMES)[number]

export const isGroupName = (s: string): s is GroupName =>
  (GROUP_NAMES as readonly string[]).includes(s)

export const groupHelpDataFor = (
  name: string,
  version: string,
): GroupHelpData => {
  if (name === 'update') {
    return {
      programName: 'mxs',
      version,
      groupName: 'update',
      description: UPDATE_LEAF.description,
      verbs: [],
      isLeaf: true,
      leafOptions: UPDATE_LEAF.options,
    }
  }
  const entry = (
    GROUPS as Record<
      string,
      {
        description: string
        verbs: readonly VerbDescriptor[]
      }
    >
  )[name]
  if (!entry) {
    throw new Error(`unknown group: ${name}`)
  }
  return {
    programName: 'mxs',
    version,
    groupName: name,
    description: entry.description,
    verbs: entry.verbs,
  }
}
