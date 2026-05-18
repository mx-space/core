import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'

import {
  AuthDenied,
  Generic,
  ValidationFailed,
  WriteRequiresExplicit,
} from '../../src/domain/errors'
import { noteView } from '../../src/cli/note/view'
import { pageView } from '../../src/cli/page/view'
import { postListView, postView } from '../../src/cli/post/view'
import { Lexical } from '../../src/services/Lexical'
import {
  currentOutputOptions,
  defaultOutputOptions,
  type OutputOptions,
  renderReadableGeneric,
  Renderer,
} from '../../src/services/Renderer'

const viewCtx = { color: false, verbose: false }

let stdoutLines: string[]
let stderrLines: string[]
let stdoutSpy: ReturnType<typeof vi.spyOn>
let stderrSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  stdoutLines = []
  stderrLines = []
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    stdoutLines.push(String(chunk))
    return true
  })
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    stderrLines.push(String(chunk))
    return true
  })
})

afterEach(() => {
  stdoutSpy.mockRestore()
  stderrSpy.mockRestore()
})

const withOpts = <A, E, R>(
  opts: Partial<OutputOptions>,
  effect: Effect.Effect<A, E, R>,
) =>
  Effect.locally(effect, currentOutputOptions, {
    ...defaultOutputOptions,
    ...opts,
  })

describe('Renderer — emitSuccess', () => {
  it.effect('writes JSON envelope under --json', () =>
    withOpts(
      { json: true },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitSuccess({ hello: 'world' })
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stdoutLines).toHaveLength(1)
          const parsed = JSON.parse(stdoutLines[0]!)
          expect(parsed).toEqual({ ok: true, data: { hello: 'world' } })
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('writes pretty JSON for objects under pretty-json', () =>
    withOpts(
      { json: false, output: 'pretty-json' },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitSuccess({ ok: 1 })
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stdoutLines.join('')).toBe(`${JSON.stringify({ ok: 1 }, null, 2)}\n`)
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('writes readable key: value lines by default', () =>
    withOpts(
      {},
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitSuccess({
          current: '0.3.1',
          latest: '0.3.1',
          channel: 'stable',
          up_to_date: true,
        })
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          const out = stdoutLines.join('')
          expect(out).toBe(
            'current: 0.3.1\nlatest: 0.3.1\nchannel: stable\nup_to_date: true\n',
          )
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('renders nested objects with indentation under readable', () =>
    withOpts(
      {},
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitSuccess({
          user: { name: 'Innei', email: 'i@innei.in' },
          api_url: 'https://mx.innei.in',
        })
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          const out = stdoutLines.join('')
          expect(out).toContain('user:')
          expect(out).toContain('  name: Innei')
          expect(out).toContain('  email: i@innei.in')
          expect(out).toContain('api_url: https://mx.innei.in')
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('writes string data verbatim', () =>
    withOpts(
      {},
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitSuccess('hello')
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stdoutLines.join('')).toBe('hello\n')
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('does not emit null or undefined success payloads', () =>
    withOpts(
      {},
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitSuccess(null)
        yield* renderer.emitSuccess(undefined)
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stdoutLines).toHaveLength(0)
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )
})

describe('Renderer — emitInfo / emitWarn', () => {
  it.effect('emitInfo writes to stderr by default', () =>
    withOpts(
      {},
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitInfo('hello')
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stderrLines.join('')).toBe('hello\n')
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('emitInfo is suppressed under --quiet', () =>
    withOpts(
      { quiet: true },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitInfo('hello')
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stderrLines).toHaveLength(0)
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('emitInfo is suppressed under --json', () =>
    withOpts(
      { json: true },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitInfo('hello')
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stderrLines).toHaveLength(0)
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('emitWarn writes to stderr by default', () =>
    withOpts(
      {},
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitWarn('careful')
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stderrLines.join('')).toContain('careful')
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('emitWarn is suppressed under --json', () =>
    withOpts(
      { json: true },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitWarn('careful')
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stderrLines).toHaveLength(0)
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )
})

describe('Renderer — emitError', () => {
  it.effect('serializes the write_requires_explicit envelope (legacy shape)', () =>
    withOpts(
      { json: true },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitError(
          new WriteRequiresExplicit({
            message: 'writing to production requires explicit acknowledgement',
            hint: 'pass --profile prod to confirm',
            profile: 'prod',
            apiUrl: 'https://blog.example.com',
          }),
        )
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stderrLines).toHaveLength(0)
          expect(stdoutLines).toHaveLength(1)
          const parsed = JSON.parse(stdoutLines[0]!)
          expect(parsed).toMatchObject({
            ok: false,
            error: 'profile.write_requires_explicit',
            profile: 'prod',
            api_url: 'https://blog.example.com',
            hint: 'pass --profile prod to confirm',
          })
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('writes a terse line to stderr (no JSON) when not --json', () =>
    withOpts(
      {},
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitError(
          new WriteRequiresExplicit({
            message: 'writing to production requires explicit acknowledgement',
            hint: 'pass --profile prod to confirm',
            profile: 'prod',
            apiUrl: 'https://blog.example.com',
          }),
        )
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stdoutLines).toHaveLength(0)
          expect(stderrLines.length).toBeGreaterThan(0)
          const combined = stderrLines.join('')
          expect(combined).toContain(
            'writing to production requires explicit acknowledgement',
          )
          expect(() => JSON.parse(combined)).toThrow()
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('emits ValidationFailed envelope under --json', () =>
    withOpts(
      { json: true },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitError(
          new ValidationFailed({ message: 'bad input', hint: 'fix it' }),
        )
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stdoutLines).toHaveLength(1)
          const parsed = JSON.parse(stdoutLines[0]!)
          expect(parsed).toEqual({
            ok: false,
            code: 'validation.failed',
            message: 'bad input',
            hint: 'fix it',
          })
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('formats object details, issue details, primitive details, and hints', () =>
    withOpts(
      {},
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitError(
          new Generic({ message: '', details: { a: 1 }, hint: 'inspect' }),
        )
        yield* renderer.emitError(
          new ValidationFailed({
            message: 'bad shape',
            details: {
              issues: [
                {
                  path: ['meta', 'title'],
                  message: 'required',
                  line: 3,
                  suggestions: ['name'],
                },
              ],
            },
          }),
        )
        yield* renderer.emitError(
          new AuthDenied({ message: 'denied', details: 'plain' }),
        )
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          const err = stderrLines.join('')
          expect(err).toContain('mxs error')
          expect(err).toContain('{"a":1}')
          expect(err).toContain('hint: inspect')
          expect(err).toContain('meta.title: required (line 3)')
          expect(err).toContain('did you mean name')
          expect(err).toContain('plain')
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('formats array-form details in readable mode', () =>
    withOpts(
      {},
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emitError(
          new Generic({
            message: 'array details',
            details: [
              { path: ['payload', 'title'], message: 'required' },
              'plain detail',
            ],
          }),
        )
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          const err = stderrLines.join('')
          expect(err).toContain('payload.title: required')
          expect(err).toContain('plain detail')
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )
})

describe('Renderer — emit(postListView)', () => {
  it.effect('emits pretty JSON under --output pretty-json', () =>
    withOpts(
      { output: 'pretty-json' },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emit(postListView, {
          data: [{ id: '1', title: 'a', slug: 'a' }],
          pagination: { page: 1, size: 10, total: 1 },
        })
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stdoutLines.join('')).toContain('"data"')
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('renders readable rows under --output readable', () =>
    withOpts(
      { output: 'readable' },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emit(postListView, {
          data: [
            {
              id: '1',
              title: 'Translated Title',
              slug: 'translated-title',
              isTranslated: true,
              sourceLang: 'zh-CN',
              isPublished: true,
              category: { name: 'Tech' },
              tags: ['cli', 'llm'],
              summary: 'Short summary.',
            },
          ],
          pagination: { page: 1, size: 10, total: 1 },
        })
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          const out = stdoutLines.join('')
          expect(out).toContain('posts')
          expect(out).toContain('count: 1')
          expect(out).toContain('page: 1')
          expect(out).toContain('post 1:')
          expect(out).toContain('title: Translated Title')
          expect(out).toContain('category: Tech')
          expect(out).toContain('tags: cli, llm')
          expect(out).toContain('translated: true')
          expect(out).not.toContain('content:')
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('renders empty arrays and rejects envelope mode for post list', () =>
    withOpts(
      { output: 'llm' },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emit(postListView, [])
      }),
    ).pipe(
      Effect.zipRight(
        withOpts(
          { output: 'envelope' },
          Effect.gen(function* () {
            const renderer = yield* Renderer
            yield* renderer.emit(postListView, { data: [] })
          }),
        ),
      ),
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stdoutLines.join('')).toContain('count: 0')
          expect(stderrLines.join('')).toContain(
            'unsupported --output value for post-list: envelope',
          )
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('emits colored unsupported-mode errors when stderr is a TTY', () =>
    withOpts(
      { output: 'envelope' },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        const prevIsTTY = process.stderr.isTTY
        Object.defineProperty(process.stderr, 'isTTY', {
          value: true,
          configurable: true,
        })
        try {
          yield* renderer.emit(postListView, { data: [] })
        } finally {
          Object.defineProperty(process.stderr, 'isTTY', {
            value: prevIsTTY,
            configurable: true,
          })
        }
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(stderrLines.join('')).toContain('\x1B[31m')
          expect(stderrLines.join('')).toContain(
            'unsupported --output value for post-list: envelope',
          )
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )
})

describe('Renderer — emit(postView/noteView/pageView)', () => {
  it.effect('renders readable post metadata under --output readable', () =>
    withOpts(
      { output: 'readable' },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emit(postView, {
          id: '1',
          title: 'Readable Post',
          slug: 'readable-post',
          isPublished: true,
          category: { name: 'Tech', slug: 'tech' },
          tags: ['cli', 'ai'],
          summary: 'Short summary.',
          contentFormat: 'markdown',
          content: 'hello',
        })
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          const out = stdoutLines.join('')
          expect(out).toContain('Readable Post')
          expect(out).toContain('state')
          expect(out).toContain('published')
          expect(out).toContain('category')
          expect(out).toContain('Tech')
          expect(out).toContain('tags')
          expect(out).toContain('cli, ai')
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('renders note envelope under --output envelope', () =>
    withOpts(
      { output: 'envelope' },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emit(noteView, {
          title: 'Daily Note',
          slug: 'daily-note',
          is_published: false,
          topic: { slug: 'life', name: 'Life' },
          mood: 'calm',
          bookmark: true,
          content_format: 'markdown',
          content: '# Body',
        })
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          const out = stdoutLines.join('')
          expect(out).toContain('<mxnote>')
          expect(out).toContain('<topic>life</topic>')
          expect(out).toContain('<state>draft</state>')
          expect(out).toContain('<format>markdown</format>')
          expect(out).toContain('# Body')
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('renders Lexical content as styled ANSI in readable mode', () =>
    Effect.gen(function* () {
      const lexical = yield* Lexical
      const state = yield* lexical.litexmlToPayload('<p>Hello world.</p>')
      const content = JSON.stringify(state)
      yield* withOpts(
        { output: 'readable' },
        Effect.gen(function* () {
          const renderer = yield* Renderer
          yield* renderer.emit(postView, {
            id: '1',
            title: 'Readable Post',
            slug: 'readable-post',
            isPublished: true,
            category: { name: 'Tech', slug: 'tech' },
            tags: ['cli', 'ai'],
            summary: 'Short summary.',
            contentFormat: 'lexical',
            content,
          })
        }),
      )
      const out = stdoutLines.join('')
      expect(out).toContain('Hello world.')
      expect(out).not.toContain('<p>')
      expect(out).not.toContain('"root"')
    }).pipe(
      Effect.provide(Renderer.Default),
      Effect.provide(Lexical.Default),
    ),
  )

  it.effect('renders post tags as child elements in envelope mode', () =>
    withOpts(
      { output: 'envelope' },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emit(postView, {
          title: 'Tagged Post',
          slug: 'tagged-post',
          isPublished: true,
          tags: ['cli', 'ai'],
          contentFormat: 'markdown',
          content: 'Body',
        })
      }),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          const out = stdoutLines.join('')
          expect(out).toContain('<tags>')
          expect(out).toContain('<tag>cli</tag>')
          expect(out).toContain('<tag>ai</tag>')
          expect(out).not.toContain('<tags>cli,ai</tags>')
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )

  it.effect('unwraps { data } documents and rejects unsupported output modes', () =>
    withOpts(
      { output: 'readable' },
      Effect.gen(function* () {
        const renderer = yield* Renderer
        yield* renderer.emit(pageView, {
          data: {
            id: 'pg1',
            title: 'Page',
            slug: 'page',
            subtitle: 'Sub',
            order: 2,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            isTranslated: false,
            content_format: 'html',
            text: 'Fallback text',
          },
        })
      }),
    ).pipe(
      Effect.zipRight(
        withOpts(
          { output: 'table' as OutputOptions['output'] },
          Effect.gen(function* () {
            const renderer = yield* Renderer
            yield* renderer.emit(postView, { title: 'x' })
          }),
        ),
      ),
      Effect.tap(() =>
        Effect.sync(() => {
          const out = stdoutLines.join('')
          expect(out).toContain('Page')
          expect(out).toContain('subtitle')
          expect(out).toContain('Sub')
          expect(out).toContain('created_at')
          expect(out).toContain('2026-01-01T00:00:00.000Z')
          expect(out).toContain('Fallback text')
          expect(stderrLines.join('')).toContain(
            'unsupported --output value for post: table',
          )
        }),
      ),
      Effect.provide(Renderer.Default),
    ),
  )
})

describe('Renderer — pure document renderers', () => {
  it('renders generic readable scalars, dates, nested arrays, and sparse values', () => {
    const rendered = renderReadableGeneric({
      title: 'Generic',
      createdAt: new Date('2026-01-02T00:00:00Z'),
      empty: '',
      scalarList: [1, null, new Date('2026-01-01T00:00:00Z')],
      mixedList: [{ name: 'first' }, ['nested', null], 'tail'],
      nested: {
        omitted: null,
        value: true,
      },
    })

    expect(rendered).toContain('title: Generic')
    expect(rendered).toContain('createdAt: 2026-01-02T00:00:00.000Z')
    expect(rendered).not.toContain('empty:')
    expect(rendered).toContain('scalarList: 1, 2026-01-01T00:00:00.000Z')
    expect(rendered).toContain('- name: first')
    expect(rendered).toContain('  - nested')
    expect(rendered).toContain('- tail')
    expect(rendered).toContain('nested:')
    expect(rendered).toContain('  value: true')
    expect(renderReadableGeneric('plain')).toBe('plain')
  })

  it('renders fallback lexical content, escaped envelope meta, and scalar variants', () => {
    const readable = noteView.readable(
      {
        id: 'n1',
        title: 'Note',
        slug: 'note',
        is_published: false,
        topic: 'life',
        mood: { name: 'calm' },
        weather: ['sun', 'wind'],
        publicAt: new Date('2026-01-01T00:00:00Z'),
        bookmark: true,
        source_lang: 'zh',
        is_translated: true,
        contentFormat: 'lexical',
        content: '{bad json',
        text: 'Plain fallback',
      },
      viewCtx,
    )
    expect(readable).toContain('Note')
    expect(readable).toContain('topic')
    expect(readable).toContain('life')
    expect(readable).toContain('weather')
    expect(readable).toContain('sun, wind')
    expect(readable).toContain('Plain fallback')

    const envelope = postView.envelope!({
      title: 'A & B < C',
      slug: 'a-b',
      category: { id: 'cat-id' },
      isPublished: true,
      summary: 'Summary > detail',
      tags: ['x&y', '<z>'],
      contentFormat: 'markdown',
      content: 'Body',
    })
    expect(envelope).toContain('<title>A &amp; B &lt; C</title>')
    expect(envelope).toContain('<category>cat-id</category>')
    expect(envelope).toContain('<state>publish</state>')
    expect(envelope).toContain('<tag>x&amp;y</tag>')
    expect(envelope).toContain('<tag>&lt;z&gt;</tag>')

    const list = postListView.readable(
      {
        data: [
          {
            id: 'p1',
            category: { slug: 'tech' },
            is_published: false,
            created_at: new Date('2026-01-01T00:00:00Z'),
          },
        ],
        pagination: { currentPage: 2, pageSize: 5, totalCount: 9 },
      },
      viewCtx,
    )
    expect(list).toContain('page: 2')
    expect(list).toContain('size: 5')
    expect(list).toContain('total: 9')
    expect(list).toContain('category: tech')
    expect(list).toContain('state: draft')
  })
})
