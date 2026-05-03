import type { TopicModel } from '../topic/topic.types'
import type { NoteModel } from './note.types'

export type NormalizedNote = Omit<NoteModel, 'password' | 'topic'> & {
  topic: TopicModel
}
