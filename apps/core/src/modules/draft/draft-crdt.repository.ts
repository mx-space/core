import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  contentCrdtDocs,
  contentCrdtUpdates,
  contentDocuments,
  contentRevisions,
  drafts,
} from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { mapBranch, mapRevision } from './draft.repository'
import type {
  CheckpointInput,
  ContentRevisionRow,
  CrdtDocRow,
  CrdtFields,
  CrdtFieldsPatch,
  DraftBranchRow,
} from './draft.types'

const mapDoc = (row: typeof contentCrdtDocs.$inferSelect): CrdtDocRow => ({
  ...row,
  documentId: toEntityId(row.documentId)!,
  syncedRevisionId: toEntityId(row.syncedRevisionId),
})

export interface CreateCrdtDocInput {
  documentId: EntityId | string
  fields: CrdtFields | null
  snapshot: Uint8Array
  snapshotVersion: Uint8Array
  syncedRevisionId: EntityId | string | null
}

export interface CompactInput {
  expectedVersion: Uint8Array
  foldedIds: EntityId[]
  snapshot: Uint8Array
  snapshotVersion: Uint8Array
}

@Injectable()
export class DraftCrdtRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  // Holds a transaction open only to own the advisory lock; `run` uses its own connections.
  async withDocumentLock<T>(
    documentId: EntityId | string,
    run: () => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`crdt-edit:${parseEntityId(documentId)}`}))`,
      )
      return run()
    })
  }

  async findDoc(documentId: EntityId | string): Promise<CrdtDocRow | null> {
    const [row] = await this.db
      .select()
      .from(contentCrdtDocs)
      .where(eq(contentCrdtDocs.documentId, parseEntityId(documentId)))
      .limit(1)
    return row ? mapDoc(row) : null
  }

  async createDoc(input: CreateCrdtDocInput): Promise<CrdtDocRow> {
    await this.db
      .insert(contentCrdtDocs)
      .values({
        documentId: parseEntityId(input.documentId),
        fields: input.fields,
        snapshot: input.snapshot,
        snapshotVersion: input.snapshotVersion,
        syncedRevisionId: input.syncedRevisionId
          ? parseEntityId(input.syncedRevisionId)
          : null,
      })
      .onConflictDoNothing({ target: contentCrdtDocs.documentId })
    return (await this.findDoc(input.documentId))!
  }

  // The share lock makes a cleanup that bumps the epoch wait for this append, or this append wait
  // for the cleanup's commit and then see the new epoch.
  async appendUpdate(
    documentId: EntityId | string,
    bytes: Uint8Array,
    epoch?: number,
  ): Promise<EntityId> {
    const documentIdValue = parseEntityId(documentId)
    const id = this.snowflake.nextId()
    await this.db.transaction(async (tx) => {
      const [document] = await tx
        .select({ crdtEpoch: contentDocuments.crdtEpoch })
        .from(contentDocuments)
        .where(eq(contentDocuments.id, documentIdValue))
        .for('share')
        .limit(1)
      if (!document || (epoch !== undefined && document.crdtEpoch !== epoch)) {
        throw new Error('CRDT_EPOCH_CHANGED')
      }
      await tx
        .insert(contentCrdtUpdates)
        .values({ bytes, documentId: documentIdValue, id })
      await tx
        .update(contentCrdtDocs)
        .set({ editedAt: sql`now()` })
        .where(eq(contentCrdtDocs.documentId, documentIdValue))
    })
    return toEntityId(id)!
  }

  async findUpdates(
    documentId: EntityId | string,
  ): Promise<{ bytes: Uint8Array; id: EntityId }[]> {
    const rows = await this.db
      .select({ bytes: contentCrdtUpdates.bytes, id: contentCrdtUpdates.id })
      .from(contentCrdtUpdates)
      .where(eq(contentCrdtUpdates.documentId, parseEntityId(documentId)))
      .orderBy(asc(contentCrdtUpdates.createdAt), asc(contentCrdtUpdates.id))
    return rows.map((row) => ({ bytes: row.bytes, id: toEntityId(row.id)! }))
  }

  async compact(
    documentId: EntityId | string,
    input: CompactInput,
  ): Promise<boolean> {
    const documentIdValue = parseEntityId(documentId)
    return this.db.transaction(async (tx) => {
      const lock = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtext(${`crdt-compact:${documentIdValue}`})) as locked`,
      )
      if (!lock.rows[0]?.locked) return false
      const updated = await tx
        .update(contentCrdtDocs)
        .set({
          snapshot: input.snapshot,
          snapshotVersion: input.snapshotVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(contentCrdtDocs.documentId, documentIdValue),
            sql`${contentCrdtDocs.snapshotVersion} = ${Buffer.from(input.expectedVersion)}`,
          ),
        )
        .returning({ documentId: contentCrdtDocs.documentId })
      if (!updated.length) return false
      if (input.foldedIds.length) {
        await tx.delete(contentCrdtUpdates).where(
          and(
            eq(contentCrdtUpdates.documentId, documentIdValue),
            inArray(
              contentCrdtUpdates.id,
              input.foldedIds.map((id) => parseEntityId(id)),
            ),
          ),
        )
      }
      return true
    })
  }

  async setSyncedRevision(
    documentId: EntityId | string,
    revisionId: EntityId | string,
  ): Promise<void> {
    await this.db
      .update(contentCrdtDocs)
      .set({
        syncedRevisionId: parseEntityId(revisionId),
        updatedAt: new Date(),
      })
      .where(eq(contentCrdtDocs.documentId, parseEntityId(documentId)))
  }

  async mergeFields(
    documentId: EntityId | string,
    patch: CrdtFieldsPatch,
  ): Promise<CrdtFields> {
    const merge = (key: keyof CrdtFields) =>
      patch[key]
        ? sql`(case when jsonb_typeof(${contentCrdtDocs.fields}->${key}) = 'object' then ${contentCrdtDocs.fields}->${key} else '{}'::jsonb end) || ${JSON.stringify(patch[key])}::jsonb`
        : sql`coalesce(${contentCrdtDocs.fields}->${key}, 'null'::jsonb)`
    const [row] = await this.db
      .update(contentCrdtDocs)
      .set({
        editedAt: sql`now()`,
        fields: sql`jsonb_build_object('meta', ${merge('meta')}, 'typeSpecificData', ${merge('typeSpecificData')})`,
        updatedAt: new Date(),
      })
      .where(eq(contentCrdtDocs.documentId, parseEntityId(documentId)))
      .returning({ fields: contentCrdtDocs.fields })
    return row?.fields ?? { meta: null, typeSpecificData: null }
  }

  async replaceFields(
    documentId: EntityId | string,
    fields: CrdtFields,
  ): Promise<void> {
    await this.db
      .update(contentCrdtDocs)
      .set({ editedAt: sql`now()`, fields, updatedAt: new Date() })
      .where(eq(contentCrdtDocs.documentId, parseEntityId(documentId)))
  }

  async appendCheckpoints(
    branchId: EntityId | string,
    inputs: CheckpointInput[],
  ): Promise<{ branch: DraftBranchRow; revisions: ContentRevisionRow[] }> {
    return this.db.transaction(async (tx) => {
      const branchIdValue = parseEntityId(branchId)
      const [branch] = await tx
        .select()
        .from(drafts)
        .where(eq(drafts.id, branchIdValue))
        .for('update')
        .limit(1)
      if (!branch) throw new Error('DRAFT_NOT_FOUND')

      let parentRevisionId = branch.headRevisionId
      const revisions: ContentRevisionRow[] = []
      for (const input of inputs) {
        const [revision] = await tx
          .insert(contentRevisions)
          .values({
            ...input.snapshot,
            documentId: branch.documentId,
            frontiers: input.frontiers,
            id: this.snowflake.nextId(),
            kind: input.kind,
            parentRevisionId,
          })
          .returning()
        revisions.push(mapRevision(revision))
        parentRevisionId = revision.id
      }
      const [updated] = await tx
        .update(drafts)
        .set({ headRevisionId: parentRevisionId, updatedAt: new Date() })
        .where(eq(drafts.id, branchIdValue))
        .returning()
      return { branch: mapBranch(updated), revisions }
    })
  }
}
