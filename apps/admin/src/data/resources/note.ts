import { deleteNote, patchNote } from '~/api/notes'
import { defineCollection } from '~/data/resource/collection'
import type { NoteModel } from '~/models/note'

import { topics } from './topic'

export const notes = defineCollection<NoteModel>({
  name: 'note',
  getKey: (note) => note.id,
  normalize: (note) => {
    if (note.topic) topics.upsert(note.topic)
  },
  onUpdate: ({ id, patch }) => patchNote(id, patch),
  onDelete: ({ id }) => deleteNote(id),
})
