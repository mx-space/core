import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { NodeContext } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  buildNotePayload,
  buildPagePayload,
  buildPostPayload,
  emptyPayload,
  loadEnvelopeIfAny,
} from '../../src/domain/payload'
import { Lexical } from '../../src/services/Lexical'

let tmpDir: string
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-next-create-'))
})

const TestLayer = Layer.mergeAll(Lexical.Default, NodeContext.layer)

const run = <A>(eff: Effect.Effect<A, any, any>) =>
  Effect.runPromise(Effect.provide(eff, TestLayer) as Effect.Effect<A, any, never>)

describe('buildPostPayload (src)', () => {
  it('builds payload from inline lexical content via flags', async () => {
    const built = await run(
      buildPostPayload({
        title: 't',
        slug: 's',
        category: 'tech',
        content: '<p>hello</p>',
        format: 'lexical',
      }),
    )
    expect(built.payload.title).toBe('t')
    expect(built.payload.slug).toBe('s')
    expect(built.payload.__categoryName).toBe('tech')
    expect(built.payload.contentFormat).toBe('lexical')
    expect(typeof built.payload.content).toBe('string')
    const parsed = JSON.parse(built.payload.content as string)
    expect(parsed.root.type).toBe('root')
    expect(typeof built.payload.text).toBe('string')
  })

  it('reads --content=file=<path>', async () => {
    const filePath = path.join(tmpDir, 'body.xml')
    await fs.writeFile(filePath, '<p>file body</p>', 'utf8')
    const built = await run(
      buildPostPayload({
        title: 't',
        slug: 's',
        category: 'tech',
        content: `file=${filePath}`,
        format: 'lexical',
      }),
    )
    expect(built.contentSource).toBe('flag')
    expect((built.payload.content as string).length).toBeGreaterThan(0)
  })

  it('falls back to envelope content when no --content', async () => {
    const filePath = path.join(tmpDir, 'post.xml')
    await fs.writeFile(
      filePath,
      `<mxpost>
  <meta>
    <title>envtitle</title>
    <slug>envslug</slug>
    <category>tech</category>
  </meta>
  <content>
<p>env body</p>
  </content>
</mxpost>`,
      'utf8',
    )
    const built = await run(buildPostPayload({ file: filePath }))
    expect(built.payload.title).toBe('envtitle')
    expect(built.payload.slug).toBe('envslug')
    expect(built.payload.__categoryName).toBe('tech')
    expect(built.contentSource).toBe('envelope')
  })

  it('flag overrides envelope meta', async () => {
    const filePath = path.join(tmpDir, 'post.xml')
    await fs.writeFile(
      filePath,
      `<mxpost>
  <meta>
    <title>envtitle</title>
    <state>publish</state>
  </meta>
  <content>
<p>env body</p>
  </content>
</mxpost>`,
      'utf8',
    )
    const built = await run(
      buildPostPayload({
        file: filePath,
        title: 'flagtitle',
        state: 'draft',
      }),
    )
    expect(built.payload.title).toBe('flagtitle')
    expect(built.payload.isPublished).toBe(false)
  })

  it('refuses lexical content when empty', async () => {
    await expect(
      run(
        buildPostPayload({
          title: 't',
          slug: 's',
          category: 'tech',
          content: '',
          format: 'lexical',
        }),
      ),
    ).rejects.toThrowError(/content is required/)
  })

  it('keeps markdown content identity', async () => {
    const built = await run(
      buildPostPayload({
        title: 't',
        slug: 's',
        category: 'tech',
        content: '# hello',
        format: 'markdown',
      }),
    )
    expect(built.payload.contentFormat).toBe('markdown')
    expect(built.payload.content).toBe('# hello')
    expect(built.payload.text).toBe('# hello')
  })

  it('accepts metadata JSON, arrays, pinning, and related ids', async () => {
    const metaPath = path.join(tmpDir, 'meta.json')
    await fs.writeFile(metaPath, '{"canonical":"x"}', 'utf8')
    const built = await run(
      buildPostPayload({
        title: 't',
        slug: 's',
        content: '# hello',
        format: 'markdown',
        summary: 'summary',
        state: 'publish',
        tags: ['a', 'b'],
        copyright: true,
        pin: '2026-01-01',
        pinOrder: 2,
        related: ['p1', 'p2'],
        meta: `file=${metaPath}`,
      }),
    )
    expect(built.payload).toMatchObject({
      summary: 'summary',
      isPublished: true,
      tags: ['a', 'b'],
      copyright: true,
      pin: '2026-01-01',
      pinOrder: 2,
      relatedId: ['p1', 'p2'],
      meta: { canonical: 'x' },
    })
  })
})

describe('buildNotePayload', () => {
  it('builds a default-titled note with coordinates, images, metadata, and markdown content', async () => {
    const built = await run(
      buildNotePayload({
        topic: 'life',
        content: 'note body',
        format: 'markdown',
        state: 'draft',
        mood: 'calm',
        weather: 'sunny',
        publicAt: '2026-01-01T00:00:00Z',
        password: 'secret',
        bookmark: true,
        coords: '1.5,2.5',
        location: 'Earth',
        images: '["a.png"]',
        meta: '{"source":"test"}',
      }),
    )
    expect(built.payload).toMatchObject({
      title: '无题',
      __topicName: 'life',
      isPublished: false,
      mood: 'calm',
      weather: 'sunny',
      publicAt: '2026-01-01T00:00:00Z',
      password: 'secret',
      bookmark: true,
      coordinates: { latitude: 1.5, longitude: 2.5 },
      location: 'Earth',
      images: ['a.png'],
      meta: { source: 'test' },
      contentFormat: 'markdown',
      content: 'note body',
    })
  })

  it('rejects invalid note coordinates', async () => {
    const err = await run(
      Effect.flip(buildNotePayload({ coords: 'north,east' })),
    )
    expect(err._tag).toBe('ValidationFailed')
    expect(err.message).toContain('invalid --coords')
  })

  it('loads note fields from an envelope and lets flags override them', async () => {
    const filePath = path.join(tmpDir, 'note.xml')
    await fs.writeFile(
      filePath,
      `<mxnote>
  <meta>
    <title>env note</title>
    <slug>env-note</slug>
    <topic>life</topic>
    <state>publish</state>
    <bookmark>false</bookmark>
    <format>markdown</format>
  </meta>
  <content>env body</content>
</mxnote>`,
      'utf8',
    )
    const built = await run(
      buildNotePayload({ file: filePath, title: 'flag note' }),
    )
    expect(built.payload).toMatchObject({
      title: 'flag note',
      slug: 'env-note',
      __topicName: 'life',
      isPublished: true,
      bookmark: false,
      content: 'env body',
    })
    expect(built.contentSource).toBe('envelope')
  })
})

describe('buildPagePayload', () => {
  it('builds page payload from flags and markdown content', async () => {
    const built = await run(
      buildPagePayload({
        title: 'Page',
        slug: 'page',
        subtitle: 'Sub',
        order: 3,
        content: 'page body',
        format: 'markdown',
        meta: '{"layout":"plain"}',
      }),
    )
    expect(built.payload).toMatchObject({
      title: 'Page',
      slug: 'page',
      subtitle: 'Sub',
      order: 3,
      contentFormat: 'markdown',
      content: 'page body',
      meta: { layout: 'plain' },
    })
  })

  it('loads page payload from mxpost envelope shape', async () => {
    const filePath = path.join(tmpDir, 'page.xml')
    await fs.writeFile(
      filePath,
      `<mxpost>
  <meta>
    <title>Env Page</title>
    <slug>env-page</slug>
    <subtitle>Env Sub</subtitle>
    <order>7</order>
    <format>markdown</format>
  </meta>
  <content>env page body</content>
</mxpost>`,
      'utf8',
    )
    const built = await run(buildPagePayload({ file: filePath }))
    expect(built.payload).toMatchObject({
      title: 'Env Page',
      slug: 'env-page',
      subtitle: 'Env Sub',
      order: 7,
      content: 'env page body',
    })
  })
})

describe('payload helpers', () => {
  it('returns null when no envelope file is provided', async () => {
    await expect(run(loadEnvelopeIfAny(undefined, 'post'))).resolves.toBeNull()
  })

  it('loads envelope through file= content specs', async () => {
    const filePath = path.join(tmpDir, 'post.xml')
    await fs.writeFile(
      filePath,
      '<mxpost><meta><title>t</title></meta><content>body</content></mxpost>',
      'utf8',
    )
    const envelope = await run(loadEnvelopeIfAny(`file=${filePath}`, 'post'))
    expect(envelope?.meta.title).toBe('t')
  })

  it('creates empty markdown and lexical payloads', async () => {
    await expect(run(emptyPayload('markdown'))).resolves.toEqual({
      content: '',
      text: '',
    })
    const lexical = await run(emptyPayload('lexical'))
    expect(JSON.parse(lexical.content).root.children).toEqual([])
    expect(lexical.text).toBe('')
  })
})
