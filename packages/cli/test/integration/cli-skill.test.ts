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

describe('mxs skill', () => {
  let cleanup: () => void

  beforeEach(() => {
    cleanup = makeTmpHome()
  })

  afterEach(() => {
    cleanup()
  })

  it(
    'bare `mxs skill` lists every bundled chapter slug',
    async () => {
      const res = await runMxs(['skill'])
      expect(res.code).toBe(0)
      for (const slug of [
        'overview',
        'workflow',
        'authoring',
        'commands-post',
        'commands-note',
        'commands-page',
        'commands-comment',
        'commands-category',
        'commands-topic',
        'commands-snippet',
        'commands-config',
        'commands-auth',
        'commands-profile',
        'commands-author',
        'output-modes',
        'auth-config',
        'safety',
      ]) {
        expect(res.stdout).toContain(slug)
      }
    },
    30_000,
  )

  it(
    '`mxs skill get <slug>` emits markdown body',
    async () => {
      const res = await runMxs(['skill', 'get', 'commands-post', '--output', 'llm'])
      expect(res.code).toBe(0)
      expect(res.stdout).toMatch(/Post commands/)
      expect(res.stdout).toMatch(/post publish/)
    },
    30_000,
  )

  it(
    '`mxs skill get <unknown>` exits 7 with skill.chapter_not_found',
    async () => {
      const res = await runMxs(['skill', 'get', 'no-such-slug', '--json'])
      expect(res.code).toBe(7)
      expect(res.stdout).toMatch(/skill\.chapter_not_found/)
    },
    30_000,
  )

  it(
    '`mxs skill search` returns hits as JSON',
    async () => {
      const res = await runMxs(['skill', 'search', 'dry-run', '--json'])
      expect(res.code).toBe(0)
      const payload = JSON.parse(res.stdout)
      expect(payload.ok).toBe(true)
      expect(Array.isArray(payload.data)).toBe(true)
      expect(payload.data.length).toBeGreaterThan(0)
      const slugs = payload.data.map((h: { slug: string }) => h.slug)
      expect(slugs).toContain('safety')
    },
    30_000,
  )

  // `overview` is the entry point agents read to pick a chapter by intent, so a
  // slug it names but the bundle does not ship is a dead end for the reader.
  it(
    'every chapter slug named in `overview` exists in the corpus',
    async () => {
      const list = await runMxs(['skill', '--output', 'llm'])
      expect(list.code).toBe(0)
      const live = new Set(
        list.stdout
          .split('\n')
          .filter((line) => line.includes('\t'))
          .map((line) => line.split('\t')[0]),
      )

      const overview = await runMxs([
        'skill',
        'get',
        'overview',
        '--output',
        'llm',
      ])
      expect(overview.code).toBe(0)

      const slugish =
        /^(overview|workflow|authoring|commands-[a-z-]+|output-modes|auth-config|safety|litexml[a-z-]*)$/
      const referenced = [
        ...new Set(
          [...overview.stdout.matchAll(/`([^`]+)`/g)]
            .map((m) => m[1])
            .filter((token) => slugish.test(token)),
        ),
      ]

      expect(referenced.length).toBeGreaterThan(10)
      expect(referenced.filter((slug) => !live.has(slug))).toEqual([])
    },
    30_000,
  )
})
