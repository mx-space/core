import { describe, expect, it, beforeEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  buildPostPayload,
  type PostFlagInputs,
} from '../../../src/core/payload'
import { MxsErrorCode } from '../../../src/core/errors'

let tmpDir: string
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-create-'))
})

describe('post create payload', () => {
  it('builds payload from inline lexical content via flags', async () => {
    const built = await buildPostPayload({
      title: 't',
      slug: 's',
      category: 'tech',
      content: '<p>hello</p>',
      format: 'lexical',
    } satisfies PostFlagInputs)
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
    const built = await buildPostPayload({
      title: 't',
      slug: 's',
      category: 'tech',
      content: `file=${filePath}`,
      format: 'lexical',
    })
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
    const built = await buildPostPayload({ file: filePath })
    expect(built.payload.title).toBe('envtitle')
    expect(built.payload.slug).toBe('envslug')
    expect(built.payload.__categoryName).toBe('tech')
    expect(built.contentSource).toBe('envelope')
  })

  it('reads --file=file=<path> envelopes', async () => {
    const filePath = path.join(tmpDir, 'post.xml')
    await fs.writeFile(
      filePath,
      `<mxpost>
  <meta>
    <title>envtitle</title>
  </meta>
  <content>
<p>env body</p>
  </content>
</mxpost>`,
      'utf8',
    )
    const built = await buildPostPayload({ file: `file=${filePath}` })
    expect(built.payload.title).toBe('envtitle')
    expect(built.contentSource).toBe('envelope')
  })

  it('preserves rich node attributes from envelope payloads', async () => {
    const filePath = path.join(tmpDir, 'post.xml')
    await fs.writeFile(
      filePath,
      `<mxpost>
  <meta>
    <title>envtitle</title>
  </meta>
  <content>
<p>See <a href="https://example.com?a=1&amp;b=2">example</a></p>
<embed url="https://x.com/innei/status/1" source="tweet" />
  </content>
</mxpost>`,
      'utf8',
    )
    const built = await buildPostPayload({ file: filePath })
    const content = JSON.parse(built.payload.content as string)
    const refs: Array<{ type: string; url?: string; source?: string }> = []
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return
      if (node.type === 'link' || node.type === 'embed') refs.push(node)
      if (Array.isArray(node.children)) node.children.forEach(walk)
    }
    walk(content.root)

    expect(refs).toEqual([
      expect.objectContaining({
        type: 'link',
        url: 'https://example.com?a=1&b=2',
      }),
      expect.objectContaining({
        type: 'embed',
        url: 'https://x.com/innei/status/1',
        source: 'tweet',
      }),
    ])
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
    const built = await buildPostPayload({
      file: filePath,
      title: 'flagtitle',
      state: 'draft',
    })
    expect(built.payload.title).toBe('flagtitle')
    expect(built.payload.isPublished).toBe(false)
  })

  it('refuses lexical content when empty', async () => {
    await expect(
      buildPostPayload({
        title: 't',
        slug: 's',
        category: 'tech',
        content: '',
        format: 'lexical',
      }),
    ).rejects.toMatchObject({ code: MxsErrorCode.ValidationFailed })
  })

  it('keeps markdown content identity', async () => {
    const built = await buildPostPayload({
      title: 't',
      slug: 's',
      category: 'tech',
      content: '# hello',
      format: 'markdown',
    })
    expect(built.payload.contentFormat).toBe('markdown')
    expect(built.payload.content).toBe('# hello')
    expect(built.payload.text).toBe('# hello')
  })
})
