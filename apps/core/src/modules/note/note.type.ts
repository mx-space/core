import type { TopicModel } from '../topic/topic.model'
import type { NoteModel } from './note.model'

export type NormalizedNote = Omit<NoteModel, 'password' | 'topic'> & {
  topic: TopicModel
}
