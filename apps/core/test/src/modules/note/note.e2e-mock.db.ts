import type { NoteModel } from '~/modules/note/note.types'

export default Array.from({ length: 20 }).map((_, _i) => {
  const i = _i + 1
  return {
    title: `Note ${i}`,
    text: `Content ${i}`,
    created: new Date(`2021-03-${i.toFixed().padStart(2, '0')}T00:00:00.000Z`),
    modified: null,
    allowComment: true,

    isPublished: true,
    commentsIndex: 0,
  }
}) as NoteModel[]
