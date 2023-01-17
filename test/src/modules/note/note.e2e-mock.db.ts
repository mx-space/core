import { NoteModel } from '~/modules/note/note.model'

export default [
  {
    title: 'Note 1',
    text: 'Content 1',
    created: new Date('2021-03-01T00:00:00.000Z'),
    modified: new Date('2021-03-01T00:00:00.000Z'),
    allowComment: true,
    nid: 1,
    hide: false,
    commentsIndex: 0,
  },
] as NoteModel[]
