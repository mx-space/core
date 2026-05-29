import type { NoteModel } from '~/models/note'

export function buildNotePublicPath(
  note: Pick<NoteModel, 'createdAt' | 'nid' | 'slug'>,
) {
  if (note.slug) {
    const date = new Date(note.createdAt)
    return `/notes/${date.getUTCFullYear()}/${
      date.getUTCMonth() + 1
    }/${date.getUTCDate()}/${note.slug}`
  }

  return `/notes/${note.nid}`
}

export function formatCompactNumber(value: number) {
  const digits = String(value).length

  if (digits < 4) return value
  if (digits < 7) return `${(value / 1000).toFixed(1)}K`
  if (digits < 10) return `${(value / 1000000).toFixed(1)}M`

  return `${(value / 1000000000).toFixed(1)}B`
}
