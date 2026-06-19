import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runAcrossModes } from '../../src/helpers/assert-view'
import { createE2EBackend, type E2EBackend } from '../../src/helpers/e2e-app'
import { extractId, getItems, parseEnvelope, runMxs } from '../../src/helpers/mxs'
import { seedOwnerAndWriteProfile } from '../../src/helpers/seed-auth'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

describe('mxs output format matrix', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
    await seedOwnerAndWriteProfile(backend, {
      profile: 'format-matrix',
      tmpHome: tmpHome.path,
    })

    const categorySlug = `fmt-cat-${Date.now()}`
    const cat = await runMxs(
      [
        '--json',
        'category',
        'create',
        '--name',
        'Format Matrix Cat',
        '--slug',
        categorySlug,
      ],
      env(),
    )
    expect(cat.code, cat.stderr || cat.stdout).toBe(0)
    const catId = extractId(parseEnvelope(cat.stdout).data)

    const post = await runMxs(
      [
        '--json',
        'post',
        'create',
        '--title',
        'Format Matrix Post',
        '--slug',
        `fmt-post-${Date.now()}`,
        '--category',
        catId,
        '--format',
        'markdown',
        '--content',
        'format matrix body',
      ],
      env(),
    )
    expect(post.code, post.stderr || post.stdout).toBe(0)
  }, 120_000)

  afterAll(async () => {
    tmpHome?.cleanup()
    await backend?.stop()
  })

  const env = () => backend.backendEnv(tmpHome.path)

  it('auth status × all modes', async () => {
    await runAcrossModes(
      ['auth', 'status'],
      env(),
      // statusView.modes = ['readable', 'llm'] — xml unsupported
      { llm: true, xml: false },
      {
        json: (envelope) => {
          expect(envelope.ok).toBe(true)
          expect(envelope.data).toMatchObject({ authenticated: true })
        },
        prettyJson: (parsed) => {
          expect((parsed as Record<string, unknown>).authenticated).toBe(true)
        },
        readable: (stdout) => {
          const hasAuth =
            stdout.toLowerCase().includes('authenticated') ||
            stdout.toLowerCase().includes('signed in') ||
            stdout.includes('format-matrix') ||
            stdout.toLowerCase().includes('local-dev')
          expect(hasAuth).toBe(true)
        },
        llm: (stdout) => {
          expect(stdout.trim().length).toBeGreaterThan(0)
        },
      },
    )
  }, 120_000)

  it('post list × all modes', async () => {
    await runAcrossModes(
      ['post', 'list'],
      env(),
      // postListView.modes = ['readable', 'llm'] — xml unsupported
      { llm: true, xml: false },
      {
        json: (envelope) => {
          expect(envelope.ok).toBe(true)
          expect(Array.isArray(getItems(envelope.data))).toBe(true)
        },
        prettyJson: (parsed) => {
          expect(Array.isArray(getItems(parsed))).toBe(true)
        },
        readable: (stdout) => {
          expect(stdout.trim().length).toBeGreaterThan(0)
        },
        llm: (stdout) => {
          expect(stdout.trim().length).toBeGreaterThan(0)
        },
      },
    )
  }, 120_000)

  it('skill list × all modes', async () => {
    await runAcrossModes(
      ['skill', 'list'],
      env(),
      // skillListView.modes = ['readable', 'llm', 'xml']
      { llm: true, xml: true },
      {
        json: (envelope) => {
          expect(envelope.ok).toBe(true)
        },
        llm: (stdout) => {
          expect(stdout).toContain('\t')
        },
        xml: (stdout) => {
          expect(stdout.trim().startsWith('<chapters>')).toBe(true)
        },
      },
    )
  }, 120_000)

  it('category list × all modes', async () => {
    // category list uses emitSuccess (no typed view).
    // json / prettyJson / readable / llm all produce output.
    // xml falls back to JSON.stringify (no angle-bracket envelope).
    for (const [flag, checker] of [
      [
        ['--json'],
        (stdout: string) => {
          const envelope = JSON.parse(stdout.trim().split('\n').pop()!) as { ok: boolean; data: unknown }
          expect(envelope.ok).toBe(true)
          expect(Array.isArray(getItems(envelope.data))).toBe(true)
        },
      ],
      [
        ['--output', 'pretty-json'],
        (stdout: string) => {
          const parsed = JSON.parse(stdout)
          expect(Array.isArray(getItems(parsed))).toBe(true)
        },
      ],
      [['--output', 'readable'], (stdout: string) => { expect(stdout.trim().length).toBeGreaterThan(0) }],
      [['--output', 'llm'], (stdout: string) => { expect(stdout.trim().length).toBeGreaterThan(0) }],
      [['--output', 'xml'], (stdout: string) => { expect(stdout.trim().length).toBeGreaterThan(0) }],
    ] as Array<[string[], (stdout: string) => void]>) {
      const result = await runMxs(['category', 'list', ...flag], env())
      expect(result.code, result.stderr).toBe(0)
      checker(result.stdout)
    }
  }, 120_000)
})
