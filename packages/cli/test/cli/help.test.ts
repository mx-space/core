import { describe, expect, it, vi } from 'vitest'

import {
  buildRootHelpData,
  emitHelp,
  GROUP_NAMES,
  groupHelpDataFor,
  renderGroupHelp,
  renderMarkdownToAnsi,
  renderRootHelp,
} from '../../src/cli/help'

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
})
