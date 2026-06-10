import dayjs from 'dayjs'

import { CollectionRefTypes } from '~/constants/db.constant'

export const isNoteSecret = (note: { publicAt?: Date | null }): boolean => {
  if (!note.publicAt) return false
  return dayjs(note.publicAt).isAfter(new Date())
}

export const checkRefModelCollectionType = (ref: any) => {
  if (!ref && typeof ref !== 'object')
    throw new TypeError('ref must be an object')

  if ('nid' in ref) {
    return CollectionRefTypes.Note
  }
  if ('title' in ref && 'categoryId' in ref) {
    return CollectionRefTypes.Post
  }
  if ('title' in ref && 'subtitle' in ref) {
    return CollectionRefTypes.Page
  }

  if ('content' in ref) {
    return CollectionRefTypes.Recently
  }
  throw new ReferenceError('ref is not a valid model collection type')
}
