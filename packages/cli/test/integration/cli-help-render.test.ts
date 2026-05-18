import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { makeTmpHome } from './_helpers'

const BIN = fileURLToPath(new URL('../../src/bin/mxs.ts', import.meta.url))

const runMxs = (
  args: readonly string[],
  env: Record<string, string> = {},
): Promise<{
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
}> =>
  new Promise((resolve) => {
    const child = spawn('npx', ['tsx', BIN, ...args], {
      env: { ...process.env, NO_COLOR: '1', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk))
    child.on('exit', (code) =>
      resolve({
        code,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      }),
    )
  })

describe('cli root help renders via markdown layer', () => {
  let cleanup: () => void

  beforeEach(() => {
    cleanup = makeTmpHome()
  })

  afterEach(() => {
    cleanup()
  })

  it(
    'shows Global options + Commands sections and lists every global flag',
    async () => {
      const res = await runMxs(['--help'])
      expect(res.code).toBe(0)
      expect(res.stdout).toContain('GLOBAL OPTIONS')
      expect(res.stdout).toContain('COMMANDS')
      for (const flag of [
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
      ]) {
        expect(res.stdout).toContain(flag)
      }
      // Every top-level subcommand surfaces.
      for (const cmd of [
        'auth',
        'profile',
        'post',
        'note',
        'page',
        'category',
        'topic',
        'config',
        'update',
      ]) {
        expect(res.stdout).toContain(cmd)
      }
    },
    30_000,
  )

  it(
    'bare `mxs` invocation produces the same output as `mxs --help`',
    async () => {
      const [bare, help] = await Promise.all([runMxs([]), runMxs(['--help'])])
      expect(bare.code).toBe(0)
      expect(help.code).toBe(0)
      expect(bare.stdout).toEqual(help.stdout)
    },
    60_000,
  )

  it(
    '`mxs -h` matches `mxs --help`',
    async () => {
      const [shortFlag, longFlag] = await Promise.all([
        runMxs(['-h']),
        runMxs(['--help']),
      ])
      expect(shortFlag.code).toBe(0)
      expect(longFlag.code).toBe(0)
      expect(shortFlag.stdout).toEqual(longFlag.stdout)
    },
    60_000,
  )
})

describe('cli group help renders via markdown layer', () => {
  let cleanup: () => void

  beforeEach(() => {
    cleanup = makeTmpHome()
  })

  afterEach(() => {
    cleanup()
  })

  it(
    '`mxs post` shows the Verbs table with all 8 post verbs',
    async () => {
      const res = await runMxs(['post'])
      expect(res.code).toBe(0)
      expect(res.stdout).toContain('VERBS')
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
        expect(res.stdout).toContain(verb)
      }
    },
    30_000,
  )

  it(
    '`mxs post --help` matches `mxs post`',
    async () => {
      const [bare, help] = await Promise.all([
        runMxs(['post']),
        runMxs(['post', '--help']),
      ])
      expect(bare.code).toBe(0)
      expect(help.code).toBe(0)
      expect(bare.stdout).toEqual(help.stdout)
    },
    60_000,
  )

  it(
    '`mxs auth -h` lists auth verbs',
    async () => {
      const res = await runMxs(['auth', '-h'])
      expect(res.code).toBe(0)
      for (const verb of ['login', 'logout', 'whoami', 'status']) {
        expect(res.stdout).toContain(verb)
      }
    },
    30_000,
  )

  it(
    '`mxs update --help` lists all leaf options',
    async () => {
      const res = await runMxs(['update', '--help'])
      expect(res.code).toBe(0)
      for (const flag of [
        '--check',
        '--prerelease',
        '--pm',
        '--force',
        '--yes',
      ]) {
        expect(res.stdout).toContain(flag)
      }
      expect(res.stdout).toContain('OPTIONS')
    },
    30_000,
  )

  it(
    '`mxs config` lists all 4 config verbs',
    async () => {
      const res = await runMxs(['config'])
      expect(res.code).toBe(0)
      for (const verb of ['list', 'get', 'set', 'edit']) {
        expect(res.stdout).toContain(verb)
      }
    },
    30_000,
  )

  it(
    '`mxs post create --help` is still rendered by @effect/cli (we do not intercept)',
    async () => {
      const res = await runMxs(['post', 'create', '--help'])
      // @effect/cli exits 0 on --help.
      expect(res.code).toBe(0)
      // Legacy @effect/cli layout markers — make sure the boundary is correct.
      expect(res.stdout).toContain('USAGE')
      expect(res.stdout).toMatch(/\$ create\b/)
    },
    30_000,
  )
})
