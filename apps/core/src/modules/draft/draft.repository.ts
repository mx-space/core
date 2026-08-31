import { Inject, Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  contentDocuments,
  contentPublicationEvents,
  contentRevisions,
  drafts,
} from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type {
  ContentDocumentRow,
  ContentPublicationEventRow,
  ContentRevisionRow,
  DraftBranchRow,
  DraftBranchStatus,
  DraftListFilter,
  DraftRefType,
  RevisionSnapshot,
} from './draft.types'
import { sameRevisionContent } from './draft-content'

const mapDocument = (
  row: typeof contentDocuments.$inferSelect,
): ContentDocumentRow => ({
  ...row,
  id: toEntityId(row.id)!,
  publishedRevisionId: toEntityId(row.publishedRevisionId),
  refId: toEntityId(row.refId),
  refType: row.refType as DraftRefType,
})

const mapRevision = (
  row: typeof contentRevisions.$inferSelect,
): ContentRevisionRow => ({
  ...row,
  documentId: toEntityId(row.documentId)!,
  id: toEntityId(row.id)!,
  parentRevisionId: toEntityId(row.parentRevisionId),
})

const mapPublicationEvent = (
  row: typeof contentPublicationEvents.$inferSelect,
): ContentPublicationEventRow => ({
  ...row,
  documentId: toEntityId(row.documentId)!,
  id: toEntityId(row.id)!,
  previousRevisionId: toEntityId(row.previousRevisionId),
  revisionId: toEntityId(row.revisionId)!,
})

const mapBranch = (row: typeof drafts.$inferSelect): DraftBranchRow => ({
  ...row,
  baseRevisionId: toEntityId(row.baseRevisionId)!,
  documentId: toEntityId(row.documentId)!,
  headRevisionId: toEntityId(row.headRevisionId)!,
  id: toEntityId(row.id)!,
  status: row.status as DraftBranchStatus,
})

@Injectable()
export class DraftRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async list(
    page = 1,
    size = 10,
    filter: DraftListFilter = {},
  ): Promise<PaginationResult<DraftBranchRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const where = this.buildFilter(filter)
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({ branch: drafts })
        .from(drafts)
        .innerJoin(contentDocuments, eq(contentDocuments.id, drafts.documentId))
        .innerJoin(
          contentRevisions,
          eq(contentRevisions.id, drafts.headRevisionId),
        )
        .where(where)
        .orderBy(desc(drafts.updatedAt), desc(drafts.createdAt))
        .limit(size)
        .offset((page - 1) * size),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(drafts)
        .innerJoin(contentDocuments, eq(contentDocuments.id, drafts.documentId))
        .innerJoin(
          contentRevisions,
          eq(contentRevisions.id, drafts.headRevisionId),
        )
        .where(where),
    ])
    return {
      data: rows.map(({ branch }) => mapBranch(branch)),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async count(filter: DraftListFilter = {}): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(drafts)
      .innerJoin(contentDocuments, eq(contentDocuments.id, drafts.documentId))
      .innerJoin(
        contentRevisions,
        eq(contentRevisions.id, drafts.headRevisionId),
      )
      .where(this.buildFilter(filter))
    return Number(row?.count ?? 0)
  }

  async findDocumentById(
    id: EntityId | string,
  ): Promise<ContentDocumentRow | null> {
    const [row] = await this.db
      .select()
      .from(contentDocuments)
      .where(eq(contentDocuments.id, parseEntityId(id)))
      .limit(1)
    return row ? mapDocument(row) : null
  }

  async findDocumentByRef(
    refType: DraftRefType,
    refId: EntityId | string,
  ): Promise<ContentDocumentRow | null> {
    const [row] = await this.db
      .select()
      .from(contentDocuments)
      .where(
        and(
          eq(contentDocuments.refType, refType),
          eq(contentDocuments.refId, parseEntityId(refId)),
        ),
      )
      .limit(1)
    return row ? mapDocument(row) : null
  }

  async findRevisionById(
    id: EntityId | string,
  ): Promise<ContentRevisionRow | null> {
    const [row] = await this.db
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.id, parseEntityId(id)))
      .limit(1)
    return row ? mapRevision(row) : null
  }

  async findRevisionsByIds(
    ids: Array<EntityId | string>,
  ): Promise<ContentRevisionRow[]> {
    if (!ids.length) return []
    const rows = await this.db
      .select()
      .from(contentRevisions)
      .where(inArray(contentRevisions.id, ids.map(parseEntityId)))
    return rows.map(mapRevision)
  }

  async findRevisionsByDocument(
    documentId: EntityId | string,
  ): Promise<ContentRevisionRow[]> {
    const rows = await this.db
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.documentId, parseEntityId(documentId)))
      .orderBy(asc(contentRevisions.createdAt))
    return rows.map(mapRevision)
  }

  async findPublicationEventsByDocument(
    documentId: EntityId | string,
  ): Promise<ContentPublicationEventRow[]> {
    const rows = await this.db
      .select()
      .from(contentPublicationEvents)
      .where(eq(contentPublicationEvents.documentId, parseEntityId(documentId)))
      .orderBy(asc(contentPublicationEvents.createdAt))
    return rows.map(mapPublicationEvent)
  }

  async findBranchById(id: EntityId | string): Promise<DraftBranchRow | null> {
    const [row] = await this.db
      .select()
      .from(drafts)
      .where(eq(drafts.id, parseEntityId(id)))
      .limit(1)
    return row ? mapBranch(row) : null
  }

  async findBranchesByDocument(
    documentId: EntityId | string,
    status: DraftBranchStatus = 'active',
  ): Promise<DraftBranchRow[]> {
    const rows = await this.db
      .select()
      .from(drafts)
      .where(
        and(
          eq(drafts.documentId, parseEntityId(documentId)),
          eq(drafts.status, status),
        ),
      )
      .orderBy(desc(drafts.updatedAt), desc(drafts.createdAt))
    return rows.map(mapBranch)
  }

  async createDocumentWithRoot(
    refType: DraftRefType,
    refId: EntityId | string | null,
    snapshot: RevisionSnapshot,
    published: boolean,
  ): Promise<{
    document: ContentDocumentRow
    revision: ContentRevisionRow
  }> {
    return this.db.transaction(async (tx) => {
      const documentId = this.snowflake.nextId()
      const revisionId = this.snowflake.nextId()
      const [document] = await tx
        .insert(contentDocuments)
        .values({
          id: documentId,
          refId: refId ? parseEntityId(refId) : null,
          refType,
        })
        .returning()
      const [revision] = await tx
        .insert(contentRevisions)
        .values({
          ...snapshot,
          documentId,
          id: revisionId,
          parentRevisionId: null,
        })
        .returning()
      if (published) {
        const [updated] = await tx
          .update(contentDocuments)
          .set({ publishedRevisionId: revisionId, updatedAt: new Date() })
          .where(eq(contentDocuments.id, documentId))
          .returning()
        return {
          document: mapDocument(updated),
          revision: mapRevision(revision),
        }
      }
      return {
        document: mapDocument(document),
        revision: mapRevision(revision),
      }
    })
  }

  async createBranch(
    documentId: EntityId | string,
    baseRevisionId: EntityId | string,
    snapshot: RevisionSnapshot,
    reuseBase: boolean,
  ): Promise<{ branch: DraftBranchRow; headRevision: ContentRevisionRow }> {
    return this.db.transaction(async (tx) => {
      const documentIdValue = parseEntityId(documentId)
      const baseId = parseEntityId(baseRevisionId)
      const [base] = await tx
        .select()
        .from(contentRevisions)
        .where(
          and(
            eq(contentRevisions.id, baseId),
            eq(contentRevisions.documentId, documentIdValue),
          ),
        )
        .limit(1)
      if (!base) throw new Error('INVALID_BASE_REVISION')

      let head = base
      if (!reuseBase) {
        ;[head] = await tx
          .insert(contentRevisions)
          .values({
            ...snapshot,
            documentId: documentIdValue,
            id: this.snowflake.nextId(),
            parentRevisionId: baseId,
          })
          .returning()
      }
      const [branch] = await tx
        .insert(drafts)
        .values({
          baseRevisionId: baseId,
          documentId: documentIdValue,
          headRevisionId: head.id,
          id: this.snowflake.nextId(),
          status: 'active',
        })
        .returning()
      return { branch: mapBranch(branch), headRevision: mapRevision(head) }
    })
  }

  async saveBranch(
    branchId: EntityId | string,
    expectedHeadRevisionId: EntityId | string,
    snapshot: RevisionSnapshot,
  ): Promise<
    | { branch: DraftBranchRow; headRevision: ContentRevisionRow; kind: 'ok' }
    | { actualHeadRevisionId: EntityId; kind: 'conflict' }
    | { kind: 'missing' }
  > {
    return this.db.transaction(async (tx) => {
      const branchIdValue = parseEntityId(branchId)
      const expectedHeadId = parseEntityId(expectedHeadRevisionId)
      const [branch] = await tx
        .select()
        .from(drafts)
        .where(eq(drafts.id, branchIdValue))
        .for('update')
        .limit(1)
      if (!branch || branch.status !== 'active') return { kind: 'missing' }
      if (branch.headRevisionId !== expectedHeadId) {
        return {
          actualHeadRevisionId: toEntityId(branch.headRevisionId)!,
          kind: 'conflict',
        }
      }
      const [head] = await tx
        .select()
        .from(contentRevisions)
        .where(eq(contentRevisions.id, expectedHeadId))
        .limit(1)
      if (!head) return { kind: 'missing' }

      if (sameRevisionContent(mapRevision(head), snapshot)) {
        return {
          branch: mapBranch(branch),
          headRevision: mapRevision(head),
          kind: 'ok',
        }
      }

      const [revision] = await tx
        .insert(contentRevisions)
        .values({
          ...snapshot,
          documentId: branch.documentId,
          id: this.snowflake.nextId(),
          parentRevisionId: expectedHeadId,
        })
        .returning()
      const [updated] = await tx
        .update(drafts)
        .set({ headRevisionId: revision.id, updatedAt: new Date() })
        .where(
          and(
            eq(drafts.id, branchIdValue),
            eq(drafts.headRevisionId, expectedHeadId),
          ),
        )
        .returning()
      if (!updated) {
        throw new Error('DRAFT_HEAD_CAS_FAILED')
      }
      return {
        branch: mapBranch(updated),
        headRevision: mapRevision(revision),
        kind: 'ok',
      }
    })
  }

  async archiveBranch(id: EntityId | string): Promise<DraftBranchRow | null> {
    const [row] = await this.db
      .update(drafts)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(drafts.id, parseEntityId(id)))
      .returning()
    return row ? mapBranch(row) : null
  }

  async linkDocument(
    documentId: EntityId | string,
    refId: EntityId | string,
  ): Promise<ContentDocumentRow | null> {
    const [row] = await this.db
      .update(contentDocuments)
      .set({ refId: parseEntityId(refId), updatedAt: new Date() })
      .where(eq(contentDocuments.id, parseEntityId(documentId)))
      .returning()
    return row ? mapDocument(row) : null
  }

  async recordPublication(
    documentId: EntityId | string,
    revisionId: EntityId | string,
    expectedPublishedRevisionId: EntityId | string | null,
  ): Promise<
    | { document: ContentDocumentRow; kind: 'ok' }
    | { actualPublishedRevisionId: EntityId | null; kind: 'conflict' }
    | { kind: 'missing' }
  > {
    return this.db.transaction(async (tx) => {
      const documentIdValue = parseEntityId(documentId)
      const revisionIdValue = parseEntityId(revisionId)
      const [document] = await tx
        .select()
        .from(contentDocuments)
        .where(eq(contentDocuments.id, documentIdValue))
        .for('update')
        .limit(1)
      if (!document) return { kind: 'missing' }
      const expected = expectedPublishedRevisionId
        ? parseEntityId(expectedPublishedRevisionId)
        : null
      if (document.publishedRevisionId !== expected) {
        return {
          actualPublishedRevisionId: toEntityId(document.publishedRevisionId),
          kind: 'conflict',
        }
      }
      const [revision] = await tx
        .select({ id: contentRevisions.id })
        .from(contentRevisions)
        .where(
          and(
            eq(contentRevisions.id, revisionIdValue),
            eq(contentRevisions.documentId, documentIdValue),
          ),
        )
        .limit(1)
      if (!revision) return { kind: 'missing' }

      const [updated] = await tx
        .update(contentDocuments)
        .set({
          publishedRevisionId: revisionIdValue,
          updatedAt: new Date(),
        })
        .where(eq(contentDocuments.id, documentIdValue))
        .returning()
      await tx.insert(contentPublicationEvents).values({
        documentId: documentIdValue,
        id: this.snowflake.nextId(),
        previousRevisionId: document.publishedRevisionId,
        revisionId: revisionIdValue,
      })
      return { document: mapDocument(updated), kind: 'ok' }
    })
  }

  async findAncestryIds(revisionId: EntityId | string): Promise<EntityId[]> {
    const result = await this.db.execute<{ id: string }>(sql`
      WITH RECURSIVE ancestry AS (
        SELECT id, parent_revision_id
        FROM content_revisions
        WHERE id = ${parseEntityId(revisionId)}
        UNION ALL
        SELECT revision.id, revision.parent_revision_id
        FROM content_revisions revision
        INNER JOIN ancestry ON ancestry.parent_revision_id = revision.id
      )
      SELECT id FROM ancestry
    `)
    return result.rows.map(({ id }) => toEntityId(id)!)
  }

  async deleteDocumentByRef(
    refType: DraftRefType,
    refId: EntityId | string,
  ): Promise<void> {
    await this.db
      .delete(contentDocuments)
      .where(
        and(
          eq(contentDocuments.refType, refType),
          eq(contentDocuments.refId, parseEntityId(refId)),
        ),
      )
  }

  private buildFilter(filter: DraftListFilter): SQL | undefined {
    const conditions: SQL[] = [eq(drafts.status, filter.status ?? 'active')]
    if (filter.refType) {
      conditions.push(eq(contentDocuments.refType, filter.refType))
    }
    if (filter.hasRef !== undefined) {
      conditions.push(
        filter.hasRef
          ? sql`${contentDocuments.refId} is not null`
          : isNull(contentDocuments.refId),
      )
    }
    if (filter.search) {
      const pattern = `%${filter.search}%`
      conditions.push(
        or(
          ilike(contentRevisions.title, pattern),
          ilike(contentRevisions.text, pattern),
          ilike(contentRevisions.content, pattern),
        )!,
      )
    }
    return conditions.length ? and(...conditions) : undefined
  }
}
