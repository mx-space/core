import type { Db } from 'mongodb'

import {
  NOTE_COLLECTION_NAME,
  PAGE_COLLECTION_NAME,
  POST_COLLECTION_NAME,
  SEARCH_DOCUMENT_COLLECTION_NAME,
} from '~/constants/db.constant'
import { buildSearchDocument } from '~/modules/search/search-document.util'
import { normalizeDocumentIds } from '~/shared/model/plugins/lean-id'

import { defineMigration } from '../helper'

export default defineMigration(
  'v10.4.3-search-index-initial-rebuild',
  async (db: Db) => {
    const [posts, pages, notes] = await Promise.all([
      db
        .collection(POST_COLLECTION_NAME)
        .find(
          {},
          {
            projection: {
              title: 1,
              text: 1,
              content: 1,
              contentFormat: 1,
              slug: 1,
              created: 1,
              modified: 1,
              isPublished: 1,
            },
          },
        )
        .toArray(),
      db
        .collection(PAGE_COLLECTION_NAME)
        .find(
          {},
          {
            projection: {
              title: 1,
              text: 1,
              content: 1,
              contentFormat: 1,
              slug: 1,
              created: 1,
              modified: 1,
            },
          },
        )
        .toArray(),
      db
        .collection(NOTE_COLLECTION_NAME)
        .find(
          {},
          {
            projection: {
              title: 1,
              text: 1,
              content: 1,
              contentFormat: 1,
              slug: 1,
              nid: 1,
              created: 1,
              modified: 1,
              isPublished: 1,
              publicAt: 1,
              password: 1,
            },
          },
        )
        .toArray(),
    ])

    const documents = [
      ...posts.map((doc) =>
        buildSearchDocument('post', normalizeDocumentIds(doc)),
      ),
      ...pages.map((doc) =>
        buildSearchDocument('page', normalizeDocumentIds(doc)),
      ),
      ...notes.map((doc) =>
        buildSearchDocument('note', normalizeDocumentIds(doc)),
      ),
    ]

    const collection = db.collection(SEARCH_DOCUMENT_COLLECTION_NAME)
    await collection.deleteMany({})

    if (documents.length) {
      await collection.insertMany(documents, { ordered: false })
    }
  },
)
