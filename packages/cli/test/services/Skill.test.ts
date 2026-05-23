import { Effect, Exit, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Skill } from '../../src/services/Skill'
import { makeMemFs, TestFsLive, TestPathLive } from '../helper/test-fs'

const CLI_DIR = '/test/cli-skills'
const HAKLEX_DIR = '/test/haklex-skills'

const chapter = (
  slug: string,
  title: string,
  description: string,
  order: number,
  body: string,
): string =>
  `---\nslug: ${slug}\ntitle: ${title}\ndescription: ${description}\norder: ${order}\n---\n\n${body}\n`

const makeLayer = (
  seed: (mem: ReturnType<typeof makeMemFs>) => void,
) => {
  const mem = makeMemFs()
  seed(mem)
  const fsLayer = TestFsLive(mem)
  const baseLayer = Layer.merge(fsLayer, TestPathLive)
  const skillLayer = Skill.Default.pipe(Layer.provide(baseLayer))
  return Layer.mergeAll(baseLayer, skillLayer)
}

const tagOf = (cause: any): string | undefined => {
  const err = cause?.error ?? cause?.failure ?? cause
  return err?._tag ?? err?.error?._tag ?? err?.failure?._tag
}

beforeEach(() => {
  process.env.MXS_SKILL_CLI_DIR = CLI_DIR
  process.env.MXS_SKILL_HAKLEX_DIR = HAKLEX_DIR
})

afterEach(() => {
  delete process.env.MXS_SKILL_CLI_DIR
  delete process.env.MXS_SKILL_HAKLEX_DIR
})

describe('Skill.list', () => {
  it('returns chapters sorted by order, with cli + haklex sources merged', async () => {
    const layer = makeLayer((mem) => {
      mem.nodes.set(CLI_DIR, { type: 'dir', mode: 0o755 })
      mem.nodes.set(HAKLEX_DIR, { type: 'dir', mode: 0o755 })
      mem.nodes.set(`${HAKLEX_DIR}/references`, { type: 'dir', mode: 0o755 })
      mem.nodes.set(`${CLI_DIR}/overview.md`, {
        type: 'file',
        data: chapter('overview', 'Overview', 'desc-0', 0, 'body 0'),
        mode: 0o644,
      })
      mem.nodes.set(`${CLI_DIR}/safety.md`, {
        type: 'file',
        data: chapter('safety', 'Safety', 'desc-60', 60, 'body 60'),
        mode: 0o644,
      })
      mem.nodes.set(`${HAKLEX_DIR}/SKILL.md`, {
        type: 'file',
        data: `---\nname: litexml-authoring\ndescription: haklex overview\n---\n\nliteXML body\n`,
        mode: 0o644,
      })
      mem.nodes.set(`${HAKLEX_DIR}/references/cli.md`, {
        type: 'file',
        data: `# cli reference\n\nbody\n`,
        mode: 0o644,
      })
    })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const skill = yield* Skill
        return yield* skill.list
      }).pipe(Effect.provide(layer)),
    )

    expect(result.map((c) => c.slug)).toEqual([
      'overview',
      'safety',
      'litexml',
      'litexml-cli',
    ])
    expect(result.find((c) => c.slug === 'litexml')?.source).toBe('haklex')
    expect(result.find((c) => c.slug === 'litexml-cli')?.source).toBe('haklex')
    expect(result[0].source).toBe('cli')
  })

  it('fails with SkillCorpusEmpty when both sources are empty', async () => {
    const layer = makeLayer(() => {})
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const skill = yield* Skill
        return yield* skill.list
      }).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('SkillCorpusEmpty')
    }
  })
})

describe('Skill.get', () => {
  it('fetches a chapter by slug', async () => {
    const layer = makeLayer((mem) => {
      mem.nodes.set(CLI_DIR, { type: 'dir', mode: 0o755 })
      mem.nodes.set(`${CLI_DIR}/overview.md`, {
        type: 'file',
        data: chapter('overview', 'Overview', 'desc', 0, 'body'),
        mode: 0o644,
      })
    })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const skill = yield* Skill
        return yield* skill.get('overview')
      }).pipe(Effect.provide(layer)),
    )

    expect(result.title).toBe('Overview')
    expect(result.body.trim()).toBe('body')
  })

  it('fails with ChapterNotFound when slug is missing', async () => {
    const layer = makeLayer((mem) => {
      mem.nodes.set(CLI_DIR, { type: 'dir', mode: 0o755 })
      mem.nodes.set(`${CLI_DIR}/overview.md`, {
        type: 'file',
        data: chapter('overview', 'Overview', 'desc', 0, 'body'),
        mode: 0o644,
      })
    })

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const skill = yield* Skill
        return yield* skill.get('nonexistent')
      }).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('ChapterNotFound')
    }
  })

  it('hints at haklex upgrade when missing slug starts with litexml', async () => {
    const layer = makeLayer((mem) => {
      mem.nodes.set(CLI_DIR, { type: 'dir', mode: 0o755 })
      mem.nodes.set(`${CLI_DIR}/overview.md`, {
        type: 'file',
        data: chapter('overview', 'Overview', 'desc', 0, 'body'),
        mode: 0o644,
      })
    })

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const skill = yield* Skill
        return yield* skill.get('litexml')
      }).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = (exit.cause as any).error ?? (exit.cause as any).failure
      expect(err?.hint).toMatch(/haklex/)
    }
  })
})

describe('Skill.search', () => {
  it('returns chapters ranked by match, with snippets', async () => {
    const layer = makeLayer((mem) => {
      mem.nodes.set(CLI_DIR, { type: 'dir', mode: 0o755 })
      mem.nodes.set(`${CLI_DIR}/a.md`, {
        type: 'file',
        data: chapter(
          'a',
          'Alpha dryrun',
          'd',
          0,
          'first dryrun appears here\nand again dryrun in body',
        ),
        mode: 0o644,
      })
      mem.nodes.set(`${CLI_DIR}/b.md`, {
        type: 'file',
        data: chapter('b', 'Beta', 'all about dryrun', 1, 'no body match'),
        mode: 0o644,
      })
      mem.nodes.set(`${CLI_DIR}/c.md`, {
        type: 'file',
        data: chapter('c', 'Gamma', 'd', 2, 'totally unrelated content'),
        mode: 0o644,
      })
    })

    const hits = await Effect.runPromise(
      Effect.gen(function* () {
        const skill = yield* Skill
        return yield* skill.search('dryrun')
      }).pipe(Effect.provide(layer)),
    )

    expect(hits.length).toBe(2)
    expect(hits[0].slug).toBe('a')
    expect(hits[0].snippets.length).toBeGreaterThanOrEqual(2)
    expect(hits[1].slug).toBe('b')
  })

  it('matches a multi-word AND query across hyphen-joined tokens', async () => {
    const layer = makeLayer((mem) => {
      mem.nodes.set(CLI_DIR, { type: 'dir', mode: 0o755 })
      mem.nodes.set(`${CLI_DIR}/a.md`, {
        type: 'file',
        data: chapter(
          'a',
          'AI Authoring',
          'AI involvement disclosure',
          0,
          'Fully AI-generated bodies should declare aiGen 2.',
        ),
        mode: 0o644,
      })
      mem.nodes.set(`${CLI_DIR}/b.md`, {
        type: 'file',
        data: chapter('b', 'Other', 'unrelated', 1, 'only ai here, no second token'),
        mode: 0o644,
      })
    })

    const hits = await Effect.runPromise(
      Effect.gen(function* () {
        const skill = yield* Skill
        return yield* skill.search('ai generated')
      }).pipe(Effect.provide(layer)),
    )

    expect(hits.map((h) => h.slug)).toEqual(['a'])
    expect(hits[0].snippets.length).toBeGreaterThan(0)
  })

  it('matches a prefix query (aigen → aiGen)', async () => {
    const layer = makeLayer((mem) => {
      mem.nodes.set(CLI_DIR, { type: 'dir', mode: 0o755 })
      mem.nodes.set(`${CLI_DIR}/a.md`, {
        type: 'file',
        data: chapter('a', 'Authoring', 'meta presets', 0, 'set meta.aiGen to 2 for full AI'),
        mode: 0o644,
      })
    })

    const hits = await Effect.runPromise(
      Effect.gen(function* () {
        const skill = yield* Skill
        return yield* skill.search('aigen')
      }).pipe(Effect.provide(layer)),
    )

    expect(hits.length).toBe(1)
    expect(hits[0].slug).toBe('a')
    expect(hits[0].snippets[0]).toMatch(/aiGen/)
  })

  it('returns empty array for blank keyword', async () => {
    const layer = makeLayer((mem) => {
      mem.nodes.set(CLI_DIR, { type: 'dir', mode: 0o755 })
      mem.nodes.set(`${CLI_DIR}/a.md`, {
        type: 'file',
        data: chapter('a', 'A', 'd', 0, 'body'),
        mode: 0o644,
      })
    })

    const hits = await Effect.runPromise(
      Effect.gen(function* () {
        const skill = yield* Skill
        return yield* skill.search('   ')
      }).pipe(Effect.provide(layer)),
    )

    expect(hits).toEqual([])
  })
})

describe('Skill frontmatter parser', () => {
  it('fails when required field is missing', async () => {
    const layer = makeLayer((mem) => {
      mem.nodes.set(CLI_DIR, { type: 'dir', mode: 0o755 })
      mem.nodes.set(`${CLI_DIR}/bad.md`, {
        type: 'file',
        data: `---\nslug: bad\ntitle: B\n---\n\nbody\n`,
        mode: 0o644,
      })
    })

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const skill = yield* Skill
        return yield* skill.list
      }).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('SkillCorpusEmpty')
    }
  })

  it('fails when two cli chapters declare the same slug', async () => {
    const layer = makeLayer((mem) => {
      mem.nodes.set(CLI_DIR, { type: 'dir', mode: 0o755 })
      mem.nodes.set(`${CLI_DIR}/a.md`, {
        type: 'file',
        data: chapter('dup', 'A', 'd', 0, 'a'),
        mode: 0o644,
      })
      mem.nodes.set(`${CLI_DIR}/b.md`, {
        type: 'file',
        data: chapter('dup', 'B', 'd', 1, 'b'),
        mode: 0o644,
      })
    })

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const skill = yield* Skill
        return yield* skill.list
      }).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('SkillCorpusEmpty')
    }
  })
})
