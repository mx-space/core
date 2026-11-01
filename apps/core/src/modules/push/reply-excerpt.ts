import { isString } from 'es-toolkit/compat'
import removeMarkdown from 'remove-markdown'

export const REPLY_EXCERPT_IMAGE = ''
export const REPLY_EXCERPT_CODE = ''

const MAX_GRAPHEMES = 100
const MAX_UTF16_UNITS = 160
const ELLIPSIS = '…'

const FENCED_CODE = /(?:```|~~~)[\s\S]*?(?:```|~~~)/g
const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]*\)/g
const HTML_IMAGE = /<img\b[^>]*>/gi

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export const projectReplyExcerpt = (text: unknown): string | null => {
  if (!isString(text)) return null
  const marked = text
    .replaceAll(FENCED_CODE, ` ${REPLY_EXCERPT_CODE} `)
    .replaceAll(MARKDOWN_IMAGE, ` ${REPLY_EXCERPT_IMAGE} `)
    .replaceAll(HTML_IMAGE, ` ${REPLY_EXCERPT_IMAGE} `)
  const plain = removeMarkdown(marked, { gfm: true, useImgAltText: false })
    .replaceAll(/\s+/g, ' ')
    .trim()
  if (!plain) return null
  const segments = Array.from(graphemes.segment(plain), (s) => s.segment)
  if (segments.length <= MAX_GRAPHEMES && plain.length <= MAX_UTF16_UNITS) {
    return plain
  }
  let kept = ''
  for (const segment of segments.slice(0, MAX_GRAPHEMES)) {
    if (kept.length + segment.length + ELLIPSIS.length > MAX_UTF16_UNITS) break
    kept += segment
  }
  return `${kept.trimEnd()}${ELLIPSIS}`
}
