import type { PatchNoteData } from '~/api/notes'
import { deleteNote, getNoteById, patchNotePublish } from '~/api/notes'
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
  const result = await tx.commit(async () => {
    await patchNotePublish(id, isPublished)
    return getNoteById(id, { single: true })
  })
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
