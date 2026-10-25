import { Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  contentCrdtDocs,
  contentCrdtUpdates,
  contentDocuments,
  contentDocumentShares,
  contentRevisions,
  drafts,
} from '~/database/schema'
import { BaseRepository } from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'

import type { CrdtFields } from './draft.types'

export type CleanupTx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0]

export interface Freed {
  bytes: number
  count: number
}

export interface RevisionNode {
  bytes: number
  createdAt: Date
  id: string
  parentRevisionId: string | null
}

export interface CrdtState {
  editedAt: Date | null
  fields: CrdtFields | null
  snapshot: Uint8Array
  updates: Uint8Array[]
}

const revisionBytes = sql<number>`(
  octet_length(coalesce(${contentRevisions.content}, ''))
  + octet_length(${contentRevisions.text})
  + coalesce(octet_length(${contentRevisions.images}::text), 0)
  + coalesce(octet_length(${contentRevisions.meta}::text), 0)
  + coalesce(octet_length(${contentRevisions.typeSpecificData}::text), 0)
)::int`

export function planPrune(
  nodes: RevisionNode[],
  doomed: (node: RevisionNode) => boolean,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const removed = new Set(nodes.filter(doomed).map((node) => node.id))
  const survivorOf = (id: string | null): string | null => {
    let current = id
    while (current && removed.has(current)) {
      current = byId.get(current)?.parentRevisionId ?? null
    }
    return current
  }
  const reparent = new Map<string, string | null>()
  for (const node of nodes) {
    if (removed.has(node.id) || !node.parentRevisionId) continue
    if (removed.has(node.parentRevisionId)) {
      reparent.set(node.id, survivorOf(node.parentRevisionId))
    }
  }
  const bytes = [...removed].reduce(
    (sum, id) => sum + (byId.get(id)?.bytes ?? 0),
    0,
  )
  return { bytes, removed, reparent }
}

@Injectable()
export class DraftCleanupRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  // Takes both CRDT locks so neither an edit session nor the background compaction runs meanwhile,
  // then the document row, which `appendUpdate` share-locks, so no push lands after state is read.
  async withDocument<T>(
    documentId: EntityId | string,
    run: (tx: CleanupTx) => Promise<T>,
  ): Promise<T> {
    const id = parseEntityId(documentId)
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`crdt-edit:${id}`}))`,
      )
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`crdt-compact:${id}`}))`,
      )
      await tx.execute(
        sql`select id from content_documents where id = ${id} for update`,
      )
      return run(tx)
    })
  }

  async bumpEpoch(tx: CleanupTx, documentId: EntityId | string) {
    await tx
      .update(contentDocuments)
      .set({ crdtEpoch: sql`${contentDocuments.crdtEpoch} + 1` })
      .where(eq(contentDocuments.id, parseEntityId(documentId)))
  }

  async protectedIds(
    tx: CleanupTx,
    documentId: EntityId | string,
  ): Promise<Set<string>> {
    const id = parseEntityId(documentId)
    const result = await tx.execute<{ id: string | null }>(sql`
      select published_revision_id as id from content_documents where id = ${id}
      union select revision_id from content_publication_events where document_id = ${id}
      union select previous_revision_id from content_publication_events where document_id = ${id}
      union select revision_id from content_document_shares where document_id = ${id}
      union select base_revision_id from drafts where document_id = ${id}
      union select head_revision_id from drafts where document_id = ${id}
      union select synced_revision_id from content_crdt_docs where document_id = ${id}
      union select r.id from content_revisions r
        join content_crdt_docs c on c.document_id = r.document_id
        where r.document_id = ${id} and r.kind = 'import' and r.frontiers is not null
    `)
    return new Set(
      result.rows.flatMap((row) => (row.id ? [String(row.id)] : [])),
    )
  }

  async revisionNodes(
    tx: CleanupTx,
    documentId: EntityId | string,
  ): Promise<RevisionNode[]> {
    const rows = await tx
      .select({
        bytes: revisionBytes,
        createdAt: contentRevisions.createdAt,
        id: contentRevisions.id,
        parentRevisionId: contentRevisions.parentRevisionId,
      })
      .from(contentRevisions)
      .where(eq(contentRevisions.documentId, parseEntityId(documentId)))
    return rows.map((row) => ({
      ...row,
      bytes: Number(row.bytes),
      id: String(row.id),
      parentRevisionId: row.parentRevisionId
        ? String(row.parentRevisionId)
        : null,
    }))
  }

  inspect(documentId: EntityId | string) {
    return this.db.transaction(async (tx) => ({
      keep: await this.protectedIds(tx, documentId),
      nodes: await this.revisionNodes(tx, documentId),
    }))
  }

  async pruneRevisions(
    tx: CleanupTx,
    documentId: EntityId | string,
    before?: Date,
  ): Promise<Freed> {
    const keep = await this.protectedIds(tx, documentId)
    const plan = planPrune(
      await this.revisionNodes(tx, documentId),
      (node) =>
        !keep.has(node.id) &&
        (!before || node.createdAt.getTime() < before.getTime()),
    )
    if (!plan.removed.size) return { bytes: 0, count: 0 }
    for (const [id, parent] of plan.reparent) {
      await tx
        .update(contentRevisions)
        .set({ parentRevisionId: parent ? parseEntityId(parent) : null })
        .where(eq(contentRevisions.id, parseEntityId(id)))
    }
    const removed = [...plan.removed].map((id) => parseEntityId(id))
    // RESTRICT is checked row by row, so links between doomed revisions must go first.
    await tx
      .update(contentRevisions)
      .set({ parentRevisionId: null })
      .where(inArray(contentRevisions.id, removed))
    await tx
      .delete(contentRevisions)
      .where(inArray(contentRevisions.id, removed))
    return { bytes: plan.bytes, count: removed.length }
  }

  async releaseShare(
    tx: CleanupTx,
    documentId: EntityId | string,
    draftId: EntityId | string,
    publishedRevisionId: EntityId | null,
  ) {
    const where = and(
      eq(contentDocumentShares.documentId, parseEntityId(documentId)),
      eq(contentDocumentShares.draftId, parseEntityId(draftId)),
    )
    if (!publishedRevisionId) {
      await tx.delete(contentDocumentShares).where(where)
      return
    }
    await tx
      .update(contentDocumentShares)
      .set({
        draftId: null,
        mode: 'pinned',
        revisionId: parseEntityId(publishedRevisionId),
        updatedAt: new Date(),
      })
      .where(where)
  }

  async deleteDraftRow(tx: CleanupTx, draftId: EntityId | string) {
    await tx.delete(drafts).where(eq(drafts.id, parseEntityId(draftId)))
  }

  async draftStatuses(
    tx: CleanupTx,
    documentId: EntityId | string,
  ): Promise<string[]> {
    const rows = await tx
      .select({ status: drafts.status })
      .from(drafts)
      .where(eq(drafts.documentId, parseEntityId(documentId)))
    return rows.map((row) => row.status)
  }

  async crdtState(
    tx: CleanupTx,
    documentId: EntityId | string,
  ): Promise<CrdtState | null> {
    const id = parseEntityId(documentId)
    const [row] = await tx
      .select({
        editedAt: contentCrdtDocs.editedAt,
        fields: contentCrdtDocs.fields,
        snapshot: contentCrdtDocs.snapshot,
      })
      .from(contentCrdtDocs)
      .where(eq(contentCrdtDocs.documentId, id))
      .limit(1)
    if (!row) return null
    const updates = await tx
      .select({ bytes: contentCrdtUpdates.bytes })
      .from(contentCrdtUpdates)
      .where(eq(contentCrdtUpdates.documentId, id))
      .orderBy(contentCrdtUpdates.createdAt, contentCrdtUpdates.id)
    return { ...row, updates: updates.map((update) => update.bytes) }
  }

  async deleteCrdt(
    tx: CleanupTx,
    documentId: EntityId | string,
  ): Promise<Freed> {
    const id = parseEntityId(documentId)
    const updates = await tx
      .delete(contentCrdtUpdates)
      .where(eq(contentCrdtUpdates.documentId, id))
      .returning({
        bytes: sql<number>`octet_length(${contentCrdtUpdates.bytes})`,
      })
    const docs = await tx
      .delete(contentCrdtDocs)
      .where(eq(contentCrdtDocs.documentId, id))
      .returning({
        bytes: sql<number>`octet_length(${contentCrdtDocs.snapshot}) + octet_length(${contentCrdtDocs.snapshotVersion})`,
      })
    const bytes = [...updates, ...docs].reduce(
      (sum, row) => sum + Number(row.bytes),
      0,
    )
    return { bytes, count: docs.length }
  }

  async replaceCrdt(
    tx: CleanupTx,
    input: {
      documentId: EntityId | string
      frontiers: { counter: number; peer: `${number}` }[]
      headRevisionId: EntityId | string
      snapshot: Uint8Array
      snapshotVersion: Uint8Array
    },
  ): Promise<number> {
    const id = parseEntityId(input.documentId)
    const headId = parseEntityId(input.headRevisionId)
    const updates = await tx
      .delete(contentCrdtUpdates)
      .where(eq(contentCrdtUpdates.documentId, id))
      .returning({
        bytes: sql<number>`octet_length(${contentCrdtUpdates.bytes})`,
      })
    const [before] = await tx
      .select({
        bytes: sql<number>`octet_length(${contentCrdtDocs.snapshot}) + octet_length(${contentCrdtDocs.snapshotVersion})`,
      })
      .from(contentCrdtDocs)
      .where(eq(contentCrdtDocs.documentId, id))
    await tx
      .update(contentCrdtDocs)
      .set({
        snapshot: input.snapshot,
        snapshotVersion: input.snapshotVersion,
        syncedRevisionId: headId,
        updatedAt: new Date(),
      })
      .where(eq(contentCrdtDocs.documentId, id))
    await tx
      .update(contentRevisions)
      .set({ frontiers: null })
      .where(
        and(
          eq(contentRevisions.documentId, id),
          ne(contentRevisions.id, headId),
        ),
      )
    await tx
      .update(contentRevisions)
      .set({ frontiers: input.frontiers })
      .where(eq(contentRevisions.id, headId))
    const after = input.snapshot.length + input.snapshotVersion.length
    const released =
      Number(before?.bytes ?? 0) +
      updates.reduce((sum, row) => sum + Number(row.bytes), 0) -
      after
    return Math.max(0, released)
  }

  async deleteDocument(tx: CleanupTx, documentId: EntityId | string) {
    const id = parseEntityId(documentId)
    await tx
      .update(contentRevisions)
      .set({ parentRevisionId: null })
      .where(eq(contentRevisions.documentId, id))
    await tx.delete(contentDocuments).where(eq(contentDocuments.id, id))
  }

  async hasCrdt(documentId: EntityId | string): Promise<boolean> {
    const [row] = await this.db
      .select({ documentId: contentCrdtDocs.documentId })
      .from(contentCrdtDocs)
      .where(eq(contentCrdtDocs.documentId, parseEntityId(documentId)))
      .limit(1)
    return Boolean(row)
  }

  async hasPublicationEvents(
    tx: CleanupTx,
    documentId: EntityId | string,
  ): Promise<boolean> {
    const result = await tx.execute<{ found: boolean }>(
      sql`select exists(select 1 from content_publication_events where document_id = ${parseEntityId(documentId)}) as found`,
    )
    return Boolean(result.rows[0]?.found)
  }
}
