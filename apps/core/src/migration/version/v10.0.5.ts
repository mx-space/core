import type { Db } from 'mongodb'
import { nanoid } from 'nanoid'
import { defineMigration } from '../helper'

const COLLECTIONS = ['posts', 'notes', 'pages']
const NODE_STATE_KEY = '$'
const BLOCK_ID_STATE_KEY = 'blockId'

const createBlockId = () => nanoid(8)

function normalizeLexicalRootBlockIds(content: string): string | null {
  let editorState: any
  try {
    editorState = JSON.parse(content)
  } catch {
    return null
  }

  const rootChildren = editorState?.root?.children
  if (!Array.isArray(rootChildren)) {
    return null
  }

  const used = new Set<string>()
  let changed = false

  for (const child of rootChildren) {
    if (!child || typeof child !== 'object') continue

    let nodeState = child[NODE_STATE_KEY]
    if (
      !nodeState ||
      typeof nodeState !== 'object' ||
      Array.isArray(nodeState)
    ) {
      nodeState = {}
      child[NODE_STATE_KEY] = nodeState
      changed = true
    }

    let blockId =
      typeof nodeState[BLOCK_ID_STATE_KEY] === 'string' &&
      nodeState[BLOCK_ID_STATE_KEY].trim()
        ? nodeState[BLOCK_ID_STATE_KEY].trim()
        : ''

    if (!blockId || used.has(blockId)) {
      blockId = createBlockId()
    }

    if (nodeState[BLOCK_ID_STATE_KEY] !== blockId) {
      nodeState[BLOCK_ID_STATE_KEY] = blockId
      changed = true
    }

    used.add(blockId)
  }

  if (!changed) {
    return null
  }

  return JSON.stringify(editorState)
}

export default defineMigration(
  'v10.0.5-backfill-lexical-root-block-id',
  async (db: Db) => {
    for (const collectionName of COLLECTIONS) {
      const collection = db.collection(collectionName)
      const cursor = collection.find(
        {
          contentFormat: 'lexical',
          content: { $type: 'string' },
        },
        {
          projection: { _id: 1, content: 1 },
        },
      )

      for await (const doc of cursor) {
        const normalized = normalizeLexicalRootBlockIds(
          String(doc.content || ''),
        )
        if (!normalized) continue

        await collection.updateOne(
          { _id: doc._id },
          {
            $set: {
              content: normalized,
            },
          },
        )
      }
    }
  },
)
