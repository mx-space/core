import { describe, expect, it, vi } from 'vitest'

import {
  buildRootHelpData,
  emitHelp,
  emitGroupHelp,
  GROUP_NAMES,
  groupHelpDataFor,
  isGroupName,
  renderGroupHelp,
  renderMarkdownToAnsi,
  renderRootHelp,
} from '../../src/cli/help'
import {
  getAllCommandHelp,
  getCommandHelp,
  getRegisteredNames,
  isLeafCommand,
  isRegisteredCommand,
} from '../../src/cli/help/registry'

const ANSI_RE = /\x1b\[[0-9;]*m/g
const stripAnsi = (s: string) => s.replace(ANSI_RE, '')

const ALL_GLOBAL_FLAGS = [
  '--json',
  '--output',
  '--api-url',
  '--token',
  '--api-key',
  '--lang',
  '--profile',
  '--quiet',
  '--verbose',
  '--dry-run',
  '--help',
  '--version',
] as const

const ALL_SUBCOMMANDS = [
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

describe('renderRootHelp', () => {
  const data = buildRootHelpData('0.3.0-test')

  it('includes every global flag name', () => {
    const md = renderRootHelp(data)
    for (const flag of ALL_GLOBAL_FLAGS) {
      expect(md).toContain(flag)
    }
  })

  it('lists all 9 subcommand names with their verb groupings', () => {
    const md = renderRootHelp(data)
    for (const cmd of ALL_SUBCOMMANDS) {
      // Markdown source wraps command name in backticks within the table cell.
      expect(md).toMatch(new RegExp(`\`${cmd}\``))
    }
    // Spot-check verb groupings.
    expect(md).toContain('list, get, create, edit, update, delete, publish, unpublish')
    expect(md).toContain('ls, show, use, mark, rm')
  })

  it('includes a Usage section and a Per-command help footer', () => {
    const md = renderRootHelp(data)
    expect(md).toContain('## Usage')
    expect(md).toContain('## Per-command help')
    // Version appears in the banner (rendered by emitHelp), not the body.
    // The body still includes the long-form description for piped/grep use.
    expect(md).toContain('mx-space CLI')
  })
})

describe('renderMarkdownToAnsi', () => {
  const data = buildRootHelpData('0.3.0-test')
  const md = renderRootHelp(data)

  it('produces ANSI escapes when color is enabled', () => {
    const out = renderMarkdownToAnsi(md, { color: true })
    expect(ANSI_RE.test(out)).toBe(true)
  })

  it('emits no ANSI escapes when color is disabled', () => {
    const out = renderMarkdownToAnsi(md, { color: false })
    expect(out).not.toMatch(ANSI_RE)
  })

  it('renders headings, tables, and code spans on the no-color path', () => {
    const out = renderMarkdownToAnsi(md, { color: false })
    // Heading 2 is uppercased.
    expect(out).toContain('USAGE')
    expect(out).toContain('GLOBAL OPTIONS')
    expect(out).toContain('COMMANDS')
    // Table rules use dashes (length matches the widest cell — just sanity).
    expect(out).toMatch(/-{4,}/)
    // Inline code unwraps to its content (no surrounding backticks).
    expect(out).toContain('--json')
    expect(out).not.toMatch(/`--json`/)
  })

  it('renders fenced code, indented code, lists, and non-table pipe lines', () => {
    const out = renderMarkdownToAnsi(
      [
        '# Title',
        '',
        '### Minor **Heading**',
        '',
        '```',
        'mxs post list',
        '```',
        '',
        '    mxs auth status',
        '',
        '- item with `code`',
        '| not a table',
        'plain **bold** text',
      ].join('\n'),
      { color: false },
    )
    expect(out).toContain('Title')
    expect(out).toContain('Minor Heading')
    expect(out).toContain('  mxs post list')
    expect(out).toContain('  mxs auth status')
    expect(out).toContain('  • item with code')
    expect(out).toContain('| not a table')
    expect(out).toContain('plain bold text')
  })
})

describe('renderGroupHelp', () => {
  it('lists every verb of a real group', () => {
    const data = groupHelpDataFor('post', '0.3.0-test')
    const md = renderGroupHelp(data)
    // The "mxs post" header is rendered by emitGroupHelp's banner, not the body.
    expect(md).toContain('## Verbs')
    for (const verb of [
      'list',
      'get',
      'create',
      'edit',
      'update',
      'delete',
      'publish',
      'unpublish',
    ]) {
      expect(md).toMatch(new RegExp(`\`${verb}`))
    }
  })

  it('renders leaf options for a top-level single-verb command', () => {
    const data = groupHelpDataFor('update', '0.3.0-test')
    const md = renderGroupHelp(data)
    // Banner is rendered by emitGroupHelp.
    expect(md).toContain('## Options')
    for (const flag of ['--check', '--prerelease', '--pm', '--force', '--yes']) {
      expect(md).toContain(`\`${flag}`)
    }
    // Leaf usage line uses [options], not <verb>.
    expect(md).toContain('mxs [global-options] update [options]')
  })

  it('produces non-empty help for every known group', () => {
    for (const name of GROUP_NAMES) {
      const md = renderGroupHelp(groupHelpDataFor(name, '0.3.0-test'))
      expect(md.length).toBeGreaterThan(50)
      expect(md).toContain('## Usage')
    }
  })

  it('recognizes known groups and rejects unknown group names', () => {
    expect(isGroupName('post')).toBe(true)
    expect(isGroupName('missing')).toBe(false)
    expect(() => groupHelpDataFor('missing', '0.3.0-test')).toThrow(
      /unknown group/,
    )
  })
})

describe('help registry', () => {
  it('exposes registered command names and membership checks', () => {
    const names = getRegisteredNames()

    expect(names).toEqual(expect.arrayContaining([...ALL_SUBCOMMANDS]))
    expect(isRegisteredCommand('post')).toBe(true)
    expect(isRegisteredCommand('missing')).toBe(false)
  })

  it('returns registered command metadata for lookup and rendering callers', () => {
    const all = getAllCommandHelp()

    expect(all.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([...ALL_SUBCOMMANDS]),
    )
    expect(getCommandHelp('update')?.description).toContain('newest mxs')
    expect(isLeafCommand('update')).toBe(true)
    expect(isLeafCommand('post')).toBe(false)
  })
})

describe('emitHelp', () => {
  it('writes ANSI-free output to stdout when stdout is not a TTY', () => {
    const writes: string[] = []
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
        writes.push(typeof chunk === 'string' ? chunk : String(chunk))
        return true
      })
    // Force non-TTY for the duration of the test.
    const prevIsTTY = process.stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      configurable: true,
    })
    try {
      emitHelp(buildRootHelpData('0.3.0-test'))
    } finally {
      writeSpy.mockRestore()
      Object.defineProperty(process.stdout, 'isTTY', {
        value: prevIsTTY,
        configurable: true,
      })
    }
    const out = writes.join('')
    expect(out).not.toMatch(ANSI_RE)
    // Banner: "mxs <version> — mx-space CLI" plus dim rule.
    expect(out).toContain('mxs 0.3.0-test — mx-space CLI')
    expect(out).toContain('GLOBAL OPTIONS')
    expect(out).toContain('COMMANDS')
    // Every subcommand surfaces.
    for (const cmd of ALL_SUBCOMMANDS) {
      expect(stripAnsi(out)).toContain(cmd)
    }
  })

  it('writes colored output to stdout when stdout is a TTY and NO_COLOR is absent', () => {
    const writes: string[] = []
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
        writes.push(typeof chunk === 'string' ? chunk : String(chunk))
        return true
      })
    const prevIsTTY = process.stdout.isTTY
    const prevNoColor = process.env.NO_COLOR
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
    })
    delete process.env.NO_COLOR
    try {
      emitHelp(buildRootHelpData('0.3.0-test'))
    } finally {
      writeSpy.mockRestore()
      Object.defineProperty(process.stdout, 'isTTY', {
        value: prevIsTTY,
        configurable: true,
      })
      if (prevNoColor === undefined) delete process.env.NO_COLOR
      else process.env.NO_COLOR = prevNoColor
    }
    expect(writes.join('')).toMatch(ANSI_RE)
  })

  it('honors NO_COLOR even when stdout is a TTY', () => {
    const writes: string[] = []
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
        writes.push(typeof chunk === 'string' ? chunk : String(chunk))
        return true
      })
    const prevIsTTY = process.stdout.isTTY
    const prevNoColor = process.env.NO_COLOR
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
    })
    process.env.NO_COLOR = '1'
    try {
      emitHelp(buildRootHelpData('0.3.0-test'))
    } finally {
      writeSpy.mockRestore()
      Object.defineProperty(process.stdout, 'isTTY', {
        value: prevIsTTY,
        configurable: true,
      })
      if (prevNoColor === undefined) delete process.env.NO_COLOR
      else process.env.NO_COLOR = prevNoColor
    }
    expect(writes.join('')).not.toMatch(ANSI_RE)
  })

  it('emits group help with a command-specific banner', () => {
    const writes: string[] = []
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
        writes.push(typeof chunk === 'string' ? chunk : String(chunk))
        return true
      })
    const prevIsTTY = process.stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      configurable: true,
    })
    try {
      emitGroupHelp(groupHelpDataFor('post', '0.3.0-test'))
    } finally {
      writeSpy.mockRestore()
      Object.defineProperty(process.stdout, 'isTTY', {
        value: prevIsTTY,
        configurable: true,
      })
    }
    const out = writes.join('')
    expect(out).toContain('mxs post — manage posts')
    expect(out).toContain('VERBS')
  })
})
