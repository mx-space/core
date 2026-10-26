import { describe, expect, it } from 'vitest'

import { coerceMeta, EnvelopeParseError, parseEnvelope } from '../src'

const post = `<mxpost>
  <meta>
    <title>Title</title>
    <tags><tag>a</tag><tag>b</tag></tags>
    <authors><author>ada</author><author>grace</author></authors>
    <state>draft</state>
  </meta>
  <content>
<p>Body</p>
  </content>
</mxpost>`

describe('envelope parser', () => {
  it('parses meta and content', () => {
    const parsed = parseEnvelope(post, 'post')
    expect(parsed.meta.tags).toEqual(['a', 'b'])
    expect(parsed.contentXml.trim()).toBe('<p>Body</p>')
    expect(coerceMeta(parsed.meta)).toMatchObject({
      title: 'Title',
      state: 'draft',
      tags: ['a', 'b'],
    })
  })

  it('reads extra list tags only when asked', () => {
    expect(parseEnvelope(post, 'post').meta.authors).toBe('adagrace')
    expect(
      parseEnvelope(post, 'post', { arrayTags: { authors: 'author' } }).meta
        .authors,
    ).toEqual(['ada', 'grace'])
  })

  it('reports the line of malformed input', () => {
    let error: unknown
    try {
      parseEnvelope('<mxpost>\n<meta>\n<title>x</title>\n</mxpost>', 'post')
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(EnvelopeParseError)
    expect((error as EnvelopeParseError).line).toBe(2)
  })
})
