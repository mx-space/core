import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { makeTmpHome } from './_helpers'

const BIN = fileURLToPath(
  new URL('../../src/bin/mxs.ts', import.meta.url),
)

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
      env: { ...process.env, ...env },
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

describe('cli --help', () => {
  let cleanup: () => void

  beforeEach(() => {
    cleanup = makeTmpHome()
  })

  afterEach(() => {
    cleanup()
  })

  it(
    'lists all nine top-level subcommands',
    async () => {
      const res = await runMxs(['--help'])
      // strip ANSI codes — `@effect/cli` colours headings
      const stripped = res.stdout.replace(/\x1b\[[0-9;]*m/g, '')
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
        expect(stripped).toMatch(new RegExp(`\\b${cmd}\\b`))
      }
      expect(res.code).toBe(0)
    },
    30_000,
  )

  it(
    'shows post subcommand verbs',
    async () => {
      const res = await runMxs(['post', '--help'])
      const stripped = res.stdout.replace(/\x1b\[[0-9;]*m/g, '')
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
        expect(stripped).toMatch(new RegExp(`\\b${verb}\\b`))
      }
      expect(res.code).toBe(0)
    },
    30_000,
  )
})
