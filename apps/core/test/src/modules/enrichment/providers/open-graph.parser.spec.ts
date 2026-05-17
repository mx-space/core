import { describe, expect, it } from 'vitest'

import { parseOpenGraph } from '~/modules/enrichment/providers/open-graph/og-parser'

function parse(head: string, url = 'https://example.com/article') {
  return parseOpenGraph(
    `<html><head>${head}</head><body></body></html>`,
    url,
    url,
  )
}

describe('parseOpenGraph — image', () => {
  it('resolves og:image and records advertised dimensions', () => {
    const { result } = parse(`
      <meta property="og:title" content="A Post" />
      <meta property="og:image" content="https://cdn.example.com/og.png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
    `)
    expect(result.image).toEqual({
      url: 'https://cdn.example.com/og.png',
      alt: undefined,
      width: 1200,
      height: 630,
    })
  })

  it('keeps the image without dimensions when none are advertised', () => {
    const { result } = parse(`
      <meta property="og:image" content="https://cdn.example.com/og.png" />
    `)
    expect(result.image?.url).toBe('https://cdn.example.com/og.png')
    expect(result.image?.width).toBeUndefined()
    expect(result.image?.height).toBeUndefined()
  })

  it('ignores non-numeric / non-positive image dimensions', () => {
    const { result } = parse(`
      <meta property="og:image" content="https://cdn.example.com/og.png" />
      <meta property="og:image:width" content="wide" />
      <meta property="og:image:height" content="0" />
    `)
    expect(result.image?.width).toBeUndefined()
    expect(result.image?.height).toBeUndefined()
  })

  it('falls back to twitter:image when no og:image is present', () => {
    const { result } = parse(`
      <meta name="twitter:image" content="https://cdn.example.com/tw.png" />
    `)
    expect(result.image?.url).toBe('https://cdn.example.com/tw.png')
  })

  it('absolutizes a relative image url', () => {
    const { result } = parse(
      `<meta property="og:image" content="/static/og.png" />`,
      'https://example.com/blog/post',
    )
    expect(result.image?.url).toBe('https://example.com/static/og.png')
  })

  it('does NOT use an apple-touch-icon / favicon as the image', () => {
    const { result } = parse(`
      <link rel="apple-touch-icon" href="https://example.com/touch.png" />
      <link rel="icon" href="https://example.com/favicon.ico" />
    `)
    expect(result.image).toBeUndefined()
  })
})

describe('parseOpenGraph — icon links', () => {
  it('surfaces discovered icons in result.links', () => {
    const { result } = parse(`
      <link rel="apple-touch-icon" href="https://example.com/touch.png" />
      <link rel="icon" href="/favicon.ico" />
    `)
    expect(result.links).toEqual([
      { rel: 'apple-touch-icon', url: 'https://example.com/touch.png' },
      { rel: 'icon', url: 'https://example.com/favicon.ico' },
    ])
  })

  it('leaves links undefined when the page advertises no icons', () => {
    const { result } = parse(`<meta property="og:title" content="A Post" />`)
    expect(result.links).toBeUndefined()
  })
})
