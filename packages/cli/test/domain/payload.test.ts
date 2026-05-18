import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { NodeContext } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildPostPayload } from '../../src/domain/payload'
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
})
