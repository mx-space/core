import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { FileSystem, Path } from '@effect/platform'
import { Context, Effect, Layer, Ref } from 'effect'
import MiniSearch from 'minisearch'

import { ChapterNotFound, SkillCorpusEmpty } from '../domain/errors'

export type ChapterSource = 'cli' | 'haklex'

export interface Chapter {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly order: number
  readonly source: ChapterSource
  readonly body: string
}

export interface SearchHit {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly snippets: readonly string[]
}

export interface SkillService {
  readonly list: Effect.Effect<readonly Chapter[], SkillCorpusEmpty>
  readonly get: (
    slug: string,
  ) => Effect.Effect<Chapter, ChapterNotFound | SkillCorpusEmpty>
  readonly all: Effect.Effect<readonly Chapter[], SkillCorpusEmpty>
  readonly search: (
    keyword: string,
  ) => Effect.Effect<readonly SearchHit[], SkillCorpusEmpty>
}

const requireFrom = createRequire(import.meta.url)

const findCliPackageRoot = (): string | null => {
  const here = fileURLToPath(import.meta.url)
  let dir = here.slice(0, Math.max(0, here.lastIndexOf('/')))
  for (let i = 0; i < 8; i++) {
    if (!dir || dir === '/') break
    try {
      const pkg = requireFrom(`${dir}/package.json`) as {
        name?: string
      }
      if (pkg.name === '@mx-space/cli') return dir
    } catch {
      // not a pkg dir, keep walking
    }
    const next = dir.slice(0, Math.max(0, dir.lastIndexOf('/')))
    if (next === dir) break
    dir = next
  }
  return null
}

const resolveCliSkillsDir = (): string | null => {
  const override = process.env.MXS_SKILL_CLI_DIR
  if (override && override.length > 0) return override
  const root = findCliPackageRoot()
  return root ? `${root}/skills` : null
}

const resolveHaklexSkillsDir = (): string | null => {
  const override = process.env.MXS_SKILL_HAKLEX_DIR
  if (override && override.length > 0) return override
  try {
    const pkgJson = requireFrom.resolve('@haklex/rich-litexml/package.json')
    const dir = pkgJson.slice(0, Math.max(0, pkgJson.lastIndexOf('/')))
    return `${dir}/.claude/skills/litexml-authoring`
  } catch {
    // Older `@haklex/rich-litexml` (<= 0.15.2) omits `./package.json` from
    // its `exports`, so direct resolve throws under strict ESM resolution.
    // Fall back to walking node_modules upward from the cli package root.
    const root = findCliPackageRoot()
    if (!root) return null
    const candidates: string[] = []
    let dir: string | null = root
    while (dir && dir.length > 1) {
      candidates.push(
        `${dir}/node_modules/@haklex/rich-litexml/.claude/skills/litexml-authoring`,
      )
      const next = dir.slice(0, Math.max(0, dir.lastIndexOf('/')))
      if (next === dir) break
      dir = next
    }
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return null
  }
}

interface ParsedChapter {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly order: number
  readonly body: string
}

const parseFrontmatter = (
  raw: string,
  file: string,
): ParsedChapter | { readonly error: string } => {
  if (!raw.startsWith('---\n')) {
    return { error: `${file}: missing frontmatter (no leading '---' line)` }
  }
  const end = raw.indexOf('\n---\n', 4)
  if (end < 0) {
    return { error: `${file}: missing frontmatter terminator ('---' line)` }
  }
  const head = raw.slice(4, end)
  const body = raw.slice(end + 5).replace(/^\n+/, '')
  const fields: Record<string, string> = {}
  for (const line of head.split('\n')) {
    if (line.trim().length === 0) continue
    const colon = line.indexOf(':')
    if (colon < 0) {
      return { error: `${file}: malformed frontmatter line: ${line}` }
    }
    const key = line.slice(0, colon).trim()
    let value = line.slice(colon + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    fields[key] = value
  }
  const slug = fields.slug
  const title = fields.title
  const description = fields.description
  const orderRaw = fields.order
  if (!slug) return { error: `${file}: frontmatter missing required 'slug'` }
  if (!title) return { error: `${file}: frontmatter missing required 'title'` }
  if (!description)
    return { error: `${file}: frontmatter missing required 'description'` }
  if (!orderRaw)
    return { error: `${file}: frontmatter missing required 'order'` }
  const order = Number.parseInt(orderRaw, 10)
  if (!Number.isFinite(order)) {
    return { error: `${file}: frontmatter 'order' not an integer: ${orderRaw}` }
  }
  if (!/^[\da-z][\da-z-]*$/.test(slug)) {
    return { error: `${file}: frontmatter 'slug' not kebab-case: ${slug}` }
  }
  return { slug, title, description, order, body }
}

const scanCliDir = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  dir: string,
): Effect.Effect<readonly Chapter[], never> =>
  Effect.gen(function* () {
    const exists = yield* fs
      .exists(dir)
      .pipe(Effect.catchAll(() => Effect.succeed(false)))
    if (!exists) return [] as readonly Chapter[]
    const entries = yield* fs
      .readDirectory(dir)
      .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))
    const chapters: Chapter[] = []
    for (const name of entries) {
      if (!name.endsWith('.md')) continue
      const full = path.join(dir, name)
      const raw = yield* fs
        .readFileString(full)
        .pipe(Effect.catchAll(() => Effect.succeed('')))
      if (!raw) continue
      const parsed = parseFrontmatter(raw, full)
      if ('error' in parsed) {
        return yield* Effect.die(parsed.error)
      }
      chapters.push({ ...parsed, source: 'cli' })
    }
    return chapters
  })

const stripAnyFrontmatter = (
  raw: string,
): { readonly fields: Record<string, string>; readonly body: string } => {
  if (!raw.startsWith('---\n')) {
    return { fields: {}, body: raw }
  }
  const end = raw.indexOf('\n---\n', 4)
  if (end < 0) return { fields: {}, body: raw }
  const head = raw.slice(4, end)
  const body = raw.slice(end + 5).replace(/^\n+/, '')
  const fields: Record<string, string> = {}
  for (const line of head.split('\n')) {
    if (line.trim().length === 0) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key = line.slice(0, colon).trim()
    let value = line.slice(colon + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    fields[key] = value
  }
  return { fields, body }
}

const humanizeBase = (name: string): string =>
  name.replaceAll(/[_-]+/g, ' ').replaceAll(/\b\w/g, (c) => c.toUpperCase())

const firstNonEmptyLine = (body: string): string | null => {
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#')) continue
    return trimmed.slice(0, 200)
  }
  return null
}

const scanHaklexDir = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  dir: string,
): Effect.Effect<readonly Chapter[], never> =>
  Effect.gen(function* () {
    const exists = yield* fs
      .exists(dir)
      .pipe(Effect.catchAll(() => Effect.succeed(false)))
    if (!exists) return [] as readonly Chapter[]
    const chapters: Chapter[] = []

    const skillMdPath = path.join(dir, 'SKILL.md')
    const skillMdExists = yield* fs
      .exists(skillMdPath)
      .pipe(Effect.catchAll(() => Effect.succeed(false)))
    if (skillMdExists) {
      const raw = yield* fs
        .readFileString(skillMdPath)
        .pipe(Effect.catchAll(() => Effect.succeed('')))
      if (raw) {
        const { fields, body } = stripAnyFrontmatter(raw)
        chapters.push({
          slug: 'litexml',
          title: 'liteXML overview',
          description:
            fields.description ||
            firstNonEmptyLine(body) ||
            'liteXML node and authoring reference',
          order: 70,
          source: 'haklex',
          body,
        })
      }
    }

    const refsDir = path.join(dir, 'references')
    const refsExists = yield* fs
      .exists(refsDir)
      .pipe(Effect.catchAll(() => Effect.succeed(false)))
    if (refsExists) {
      const refFiles = yield* fs
        .readDirectory(refsDir)
        .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))
      const sorted = [...refFiles].filter((n) => n.endsWith('.md')).sort()
      let order = 71
      for (const name of sorted) {
        const full = path.join(refsDir, name)
        const raw = yield* fs
          .readFileString(full)
          .pipe(Effect.catchAll(() => Effect.succeed('')))
        if (!raw) continue
        const baseName = name.replace(/\.md$/, '')
        const { fields, body } = stripAnyFrontmatter(raw)
        chapters.push({
          slug: `litexml-${baseName}`,
          title: `liteXML ${humanizeBase(baseName)}`,
          description:
            fields.description ||
            firstNonEmptyLine(body) ||
            `liteXML reference: ${baseName}`,
          order: order++,
          source: 'haklex',
          body,
        })
      }
    }

    return chapters
  })

const buildRegistry = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  cliDir: string | null,
  haklexDir: string | null,
): Effect.Effect<readonly Chapter[], SkillCorpusEmpty> =>
  Effect.gen(function* () {
    const [cliChapters, haklexChapters] = yield* Effect.all(
      [
        cliDir
          ? scanCliDir(fs, path, cliDir)
          : Effect.succeed([] as readonly Chapter[]),
        haklexDir
          ? scanHaklexDir(fs, path, haklexDir)
          : Effect.succeed([] as readonly Chapter[]),
      ],
      { concurrency: 2 },
    ).pipe(
      Effect.catchAllDefect((d) =>
        Effect.fail(
          new SkillCorpusEmpty({
            message: typeof d === 'string' ? d : 'failed to load skill corpus',
            cause: d,
          }),
        ),
      ),
    )
    const all = [...cliChapters, ...haklexChapters]
    if (all.length === 0) {
      return yield* Effect.fail(
        new SkillCorpusEmpty({
          message: 'no chapters found',
          hint: 'reinstall @mx-space/cli, or check the MXS_SKILL_CLI_DIR / MXS_SKILL_HAKLEX_DIR overrides',
        }),
      )
    }
    const seen = new Set<string>()
    for (const c of all) {
      if (seen.has(c.slug)) {
        return yield* Effect.fail(
          new SkillCorpusEmpty({
            message: `duplicate slug across sources: ${c.slug}`,
            hint: 'each chapter slug must be globally unique',
          }),
        )
      }
      seen.add(c.slug)
    }
    return [...all].sort((a, b) => a.order - b.order)
  })

interface IndexDoc {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly body: string
}

const buildIndex = (chapters: readonly Chapter[]): MiniSearch<IndexDoc> => {
  const mini = new MiniSearch<IndexDoc>({
    fields: ['title', 'description', 'body'],
    storeFields: ['slug'],
    idField: 'slug',
    searchOptions: {
      boost: { title: 3, description: 2 },
      combineWith: 'AND',
      prefix: true,
      fuzzy: 0.2,
    },
  })
  mini.addAll(
    chapters.map((c) => ({
      slug: c.slug,
      title: c.title,
      description: c.description,
      body: c.body,
    })),
  )
  return mini
}

/**
 * Tokenize the user's query string the same way MiniSearch does for indexing,
 * so snippets can be located in the body. We use this lightweight tokenizer
 * rather than `r.terms` because fuzzy / prefix matches expose the indexed
 * term, not the substring that appears in the body verbatim.
 */
const tokenizeQuery = (s: string): readonly string[] =>
  s
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter((t) => t.length > 0)

const buildSnippets = (
  body: string,
  terms: readonly string[],
): readonly string[] => {
  if (terms.length === 0) return []
  const lower = body.toLowerCase()
  // Pre-collect up to 5 occurrences per term so single-term queries can
  // surface multiple snippets and multi-term queries stay balanced via
  // round-robin emission below.
  const occs: number[][] = terms.map((term) => {
    const t = term.toLowerCase()
    if (!t) return []
    const positions: number[] = []
    let from = 0
    while (positions.length < 5) {
      const idx = lower.indexOf(t, from)
      if (idx < 0) break
      positions.push(idx)
      from = idx + t.length
    }
    return positions
  })
  const cursors: number[] = Array.from({ length: terms.length }, () => 0)
  const out: string[] = []
  let progressed = true
  while (out.length < 3 && progressed) {
    progressed = false
    for (let i = 0; i < terms.length && out.length < 3; i++) {
      const c = cursors[i]!
      if (c >= occs[i]!.length) continue
      const idx = occs[i]![c]!
      const tLen = terms[i]!.length
      cursors[i] = c + 1
      progressed = true
      const start = Math.max(0, idx - 60)
      const end = Math.min(body.length, idx + tLen + 60)
      let snippet = body.slice(start, end).replaceAll(/\s+/g, ' ').trim()
      if (start > 0) snippet = `…${snippet}`
      if (end < body.length) snippet = `${snippet}…`
      out.push(snippet)
    }
  }
  return out
}

const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const cliDir = resolveCliSkillsDir()
  const haklexDir = resolveHaklexSkillsDir()
  const cache = yield* Ref.make<readonly Chapter[] | null>(null)
  const indexCache = yield* Ref.make<MiniSearch<IndexDoc> | null>(null)

  const load: Effect.Effect<readonly Chapter[], SkillCorpusEmpty> = Effect.gen(
    function* () {
      const cached = yield* Ref.get(cache)
      if (cached) return cached
      const chapters = yield* buildRegistry(fs, path, cliDir, haklexDir)
      yield* Ref.set(cache, chapters)
      return chapters
    },
  )

  const loadIndex: Effect.Effect<
    MiniSearch<IndexDoc>,
    SkillCorpusEmpty
  > = Effect.gen(function* () {
    const cached = yield* Ref.get(indexCache)
    if (cached) return cached
    const chapters = yield* load
    const mini = buildIndex(chapters)
    yield* Ref.set(indexCache, mini)
    return mini
  })

  const svc: SkillService = {
    list: load,
    all: load,
    get: (slug) =>
      Effect.gen(function* () {
        const chapters = yield* load
        const found = chapters.find((c) => c.slug === slug)
        if (!found) {
          const isLitexml = slug.startsWith('litexml')
          return yield* Effect.fail(
            new ChapterNotFound({
              slug,
              message: `no skill chapter with slug '${slug}'`,
              hint: isLitexml
                ? 'upgrade @haklex/rich-litexml to >=0.16.0 to ship liteXML chapters'
                : 'run `mxs skill` to list available chapters',
            }),
          )
        }
        return found
      }),
    search: (keyword) =>
      Effect.gen(function* () {
        const kw = keyword.trim()
        if (!kw) return [] as readonly SearchHit[]
        const chapters = yield* load
        const mini = yield* loadIndex
        const tokens = tokenizeQuery(kw)
        const results = mini.search(kw)
        const bySlug = new Map(chapters.map((c) => [c.slug, c]))
        return results.flatMap((r) => {
          const chapter = bySlug.get(r.id as string)
          if (!chapter) return []
          return [
            {
              slug: chapter.slug,
              title: chapter.title,
              description: chapter.description,
              snippets: buildSnippets(chapter.body, tokens),
            },
          ]
        })
      }),
  }
  return svc
})

export class Skill extends Context.Tag('Skill')<Skill, SkillService>() {
  static Default: Layer.Layer<Skill, never, FileSystem.FileSystem | Path.Path> =
    Layer.effect(Skill, make)
}
