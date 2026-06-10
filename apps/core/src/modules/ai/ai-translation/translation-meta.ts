// Single source of truth for the translatable article meta fields
// (title/subtitle/summary/tags): their sentinel unit keys, the persisted
// sourceMetaHashes format, and the tags wire encoding. The persisted shape
// must stay byte-compatible — md5 per field, tags joined with '|||'.

import { md5 } from '~/utils/tool.util'

import type { ArticleContent } from './ai-translation.types'

export const META_TITLE_KEY = '__title__'
export const META_SUBTITLE_KEY = '__subtitle__'
export const META_SUMMARY_KEY = '__summary__'
export const META_TAGS_KEY = '__tags__'

export const TAGS_SEPARATOR = '|||'

export function encodeTags(tags: readonly string[]): string {
  return tags.join(TAGS_SEPARATOR)
}

export function decodeTags(encoded: string): string[] {
  return encoded.split(TAGS_SEPARATOR)
}

export interface SourceMetaHashes {
  title?: unknown
  subtitle?: unknown
  summary?: unknown
  tags?: unknown
}

export function buildSourceMetaHashes(
  content: Pick<ArticleContent, 'title' | 'subtitle' | 'summary' | 'tags'>,
): {
  title: string
  subtitle?: string
  summary?: string
  tags?: string
} {
  return {
    title: md5(content.title),
    subtitle: content.subtitle ? md5(content.subtitle) : undefined,
    summary: content.summary ? md5(content.summary) : undefined,
    tags: content.tags?.length ? md5(encodeTags(content.tags)) : undefined,
  }
}

export function isMetaFieldUnchanged(
  hashes: SourceMetaHashes | null | undefined,
  field: keyof SourceMetaHashes,
  currentValue: string,
): boolean {
  return !!hashes && hashes[field] === md5(currentValue)
}
