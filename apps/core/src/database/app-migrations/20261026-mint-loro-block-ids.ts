import { eq, sql } from 'drizzle-orm'

import { contentRevisions } from '~/database/schema'
import { DraftCleanupRepository } from '~/modules/draft/draft-cleanup.repository'
import {
  createContentDoc,
  createDocument,
  readDocContent,
} from '~/modules/draft/draft-crdt.doc'
import { parseEntityId } from '~/shared/id/entity-id'

import type { AppMigration } from './types'

const untouchedImports = (documentId?: string) => sql`
  select c.document_id, h.id as head_id, h.content as head_content
  from content_crdt_docs c
  join drafts d on d.document_id = c.document_id and d.status = 'active'
  join content_revisions h on h.id = d.head_revision_id
  where h.kind = 'import'
    and (c.edited_at is null or c.edited_at <= h.created_at)
    and not exists (select 1 from content_crdt_updates u where u.document_id = c.document_id)
    and not exists (
      select 1 from drafts other
      where other.document_id = c.document_id and other.status = 'active' and other.id <> d.id
    )
    ${documentId ? sql`and c.document_id = ${documentId}` : sql``}
`

const lacksBlockIds = (content: string) => {
  const { root } = JSON.parse(content) as {
    root: { children: { $?: { blockId?: unknown } }[] }
  }
  const seen = new Set<unknown>()
  return root.children.some((child) => {
    const id = child.$?.blockId
    if (typeof id !== 'string' || !id || seen.has(id)) return true
    seen.add(id)
    return false
  })
}

export const migration: AppMigration = {
  id: '20261026-mint-loro-block-ids',
  description:
    'Rebuild untouched Loro working copies with block ids so opening one is not an edit',
  async up({ db, logger }) {
    const cleanup = new DraftCleanupRepository(db)
    const candidates = await db.execute<{ document_id: string }>(
      untouchedImports(),
    )
    let rebuilt = 0
    for (const { document_id: documentId } of candidates.rows) {
      const done = await cleanup.withDocument(documentId, async (tx) => {
        const [head] = (
          await tx.execute<{ head_content: string | null; head_id: string }>(
            untouchedImports(String(documentId)),
          )
        ).rows
        const state = head && (await cleanup.crdtState(tx, documentId))
        if (!head || !state) return false
        const doc = createDocument()
        doc.import(state.snapshot)
        const content = readDocContent(doc)
        if (
          head.head_content !== content.content ||
          !lacksBlockIds(content.content)
        ) {
          return false
        }
        const fresh = createContentDoc(content, `import ${head.head_id}`)
        await tx
          .update(contentRevisions)
          .set({ content: readDocContent(fresh).content })
          .where(eq(contentRevisions.id, parseEntityId(head.head_id)))
        await cleanup.bumpEpoch(tx, documentId)
        await cleanup.replaceCrdt(tx, {
          documentId,
          frontiers: fresh.frontiers(),
          headRevisionId: head.head_id,
          snapshot: fresh.export({ mode: 'snapshot' }),
          snapshotVersion: fresh.oplogVersion().encode(),
        })
        return true
      })
      if (done) rebuilt++
    }
    logger.log(`Minted block ids in ${rebuilt} Loro working copies`)
  },
}
