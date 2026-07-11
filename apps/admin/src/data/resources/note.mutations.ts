import type { CreateNoteData, PatchNoteData } from '~/api/notes'
import {
  createNote,
  deleteNote,
  getNoteById,
  patchNotePublish,
  updateNote,
} from '~/api/notes'
import { createTransaction } from '~/data/resource/transaction'
import type { NoteModel } from '~/models/note'

import { notes } from './note'

async function ensureNoteHydrated(id: string): Promise<void> {
  if (notes.get(id) !== undefined) return
  const entity = await getNoteById(id, { single: true })
  notes.hydrate([entity])
}

export async function publishNote(
  id: string,
  isPublished: boolean,
): Promise<NoteModel> {
  await ensureNoteHydrated(id)
  const tx = createTransaction()
  tx.update(notes, id, (draft) => {
    draft.isPublished = isPublished
  })
  const result = await tx.commit(() => patchNotePublish(id, isPublished))
  notes.hydrate([result])
  return result
}

export async function patchNoteFields(
  id: string,
  patch: PatchNoteData,
): Promise<NoteModel | void> {
  await ensureNoteHydrated(id)
  return notes.update(id, (draft) => {
    Object.assign(draft, patch)
  })
}

export function removeNote(id: string): Promise<void> {
  return notes.delete(id)
}

export interface BatchRemoveResult {
  failedCount: number
  fulfilledKeys: string[]
  successCount: number
}

export function removeNotes(ids: string[]): Promise<BatchRemoveResult> {
  const tx = createTransaction()
  ids.forEach((id) => tx.delete(notes, id))

  return tx.commit(async () => {
    const results = await Promise.allSettled(ids.map((id) => deleteNote(id)))
    const fulfilledKeys = ids.filter(
      (_, index) => results[index].status === 'fulfilled',
    )

    return {
      failedCount: ids.length - fulfilledKeys.length,
      fulfilledKeys,
      successCount: fulfilledKeys.length,
    }
  })
}

function toOptimisticNotePatch(data: CreateNoteData): Partial<NoteModel> {
  const patch: Partial<NoteModel> = {
    bookmark: data.bookmark,
    contentFormat: data.contentFormat,
    coordinates: data.coordinates,
    isPublished: data.isPublished,
    location: data.location,
    meta: data.meta,
    publicAt: data.publicAt,
    text: data.text,
    title: data.title,
    topicId: data.topicId,
  }
  if (data.content !== undefined) patch.content = data.content
  if (data.images !== undefined) patch.images = data.images
  if (data.mood !== undefined) patch.mood = data.mood
  if (data.slug !== undefined) patch.slug = data.slug
  if (data.weather !== undefined) patch.weather = data.weather
  return patch
}

export async function saveNote(
  id: string,
  data: CreateNoteData,
): Promise<NoteModel> {
  if (!id) {
    const result = await createNote(data)
    notes.upsert(result)
    return result
  }

  await ensureNoteHydrated(id)
  const patch = toOptimisticNotePatch(data)
  const tx = createTransaction()
  tx.update(notes, id, (draft) => {
    Object.assign(draft, patch)
  })
  const result = await tx.commit(() => updateNote(id, data))
  notes.hydrate([result])
  return result
}
