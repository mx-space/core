import type { CommentRefTypes } from './comment.model'

import {
  NOTE_COLLECTION_NAME,
  PAGE_COLLECTION_NAME,
  POST_COLLECTION_NAME,
  RECENTLY_COLLECTION_NAME,
} from '~/constants/db.constant'

export const normalizeRefType = (type: any) => {
  return {
    Post: POST_COLLECTION_NAME,
    Note: NOTE_COLLECTION_NAME,
    Page: PAGE_COLLECTION_NAME,
    Recently: RECENTLY_COLLECTION_NAME,
  }[type as keyof typeof CommentRefTypes]
}
