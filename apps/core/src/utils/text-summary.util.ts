/**
 * Locale-aware text truncation for summary previews.
 *
 * Naive `String.prototype.slice(0, n)` cuts mid-word for Latin scripts and
 * mid-sentence for everything — clean for ASCII, awful for users. The
 * helpers below prefer a sentence boundary, fall back to a word boundary,
 * and only as a last resort cut at a code-unit index. Powered by
 * `Intl.Segmenter` so language-specific punctuation rules (e.g. CJK
 * `。！？` vs Latin `. ! ?`) are handled by the engine.
 *
 * The locale parameter is a hint — the engine will best-match unknown
 * tags. The codebase tracks the natural language of a document on
 * `meta.lang`, which is what callers should pass when available.
 */

const ELLIPSIS = '…'

const DEFAULT_LOCALE = 'zh'

const hasIntlSegmenter = typeof Intl.Segmenter === 'function'

/**
 * Truncate `text` to at most `maxLength` characters, preferring to break
 * at a sentence boundary, falling back to a word boundary, and finally
 * to a character cut. An ellipsis is appended only when the truncation
 * could not land on a complete sentence.
 *
 * Returns an empty string for empty input. Trims trailing whitespace.
 */
export function truncateAtBoundary(
  text: string,
  maxLength: number,
  locale: string = DEFAULT_LOCALE,
): string {
  if (typeof text !== 'string' || text.length === 0) return ''
  if (maxLength <= 0) return ''
  if (text.length <= maxLength) return text.trim()

  if (hasIntlSegmenter) {
    const sentenceCut = takeWholeSentences(text, maxLength, locale)
    if (sentenceCut) return sentenceCut

    const wordCut = takeWholeWords(text, maxLength, locale)
    if (wordCut) return wordCut + ELLIPSIS
  }

  return text.slice(0, Math.max(0, maxLength - 1)).trim() + ELLIPSIS
}

function takeWholeSentences(
  text: string,
  maxLength: number,
  locale: string,
): string | null {
  try {
    const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' })
    let acc = ''
    for (const seg of segmenter.segment(text)) {
      const next = acc + seg.segment
      if (next.length > maxLength) break
      acc = next
    }
    const trimmed = acc.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

function takeWholeWords(
  text: string,
  maxLength: number,
  locale: string,
): string | null {
  try {
    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' })
    // Reserve one char for the ellipsis so the visible length stays within
    // `maxLength`.
    const budget = Math.max(1, maxLength - ELLIPSIS.length)
    let acc = ''
    let lastWordEnd = 0
    for (const seg of segmenter.segment(text)) {
      const next = acc + seg.segment
      if (next.length > budget) break
      acc = next
      if (seg.isWordLike) {
        lastWordEnd = acc.length
      }
    }
    if (lastWordEnd === 0) return null
    return text.slice(0, lastWordEnd).trim() || null
  } catch {
    return null
  }
}
