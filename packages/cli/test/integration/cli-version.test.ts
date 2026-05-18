import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { makeTmpHome } from './_helpers'

const requireFrom = createRequire(import.meta.url)
const { version: PKG_VERSION } = requireFrom('../../package.json') as {
  version: string
}

const BIN = fileURLToPath(new URL('../../src/bin/mxs.ts', import.meta.url))

interface SpawnResult {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
}

const runMxs = (
  args: readonly string[],
  env: Record<string, string> = {},
): Promise<SpawnResult> =>
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

describe('cli --version', () => {
  let cleanup: () => void

  beforeEach(() => {
    cleanup = makeTmpHome()
  })

  afterEach(() => {
    cleanup()
  })

  it(
    'prints the package version',
    async () => {
      const res = await runMxs(['--version'])
      expect(res.stdout).toContain(PKG_VERSION)
      expect(res.code).toBe(0)
    },
    30_000,
  )
})
