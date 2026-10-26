import { Inject, Injectable } from '@nestjs/common'
import { type SQL, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { EntityId } from '~/shared/id/entity-id'

import type { DraftRefType } from './draft.enum'
import type {
  DraftBranchStatus,
  DraftCard,
  DraftCardFilter,
  DraftRelation,
} from './draft.types'

export interface StorageTotals {
  crdt: { bytes: number; count: number }
  revisions: { bytes: number; count: number }
  updates: { bytes: number; count: number }
}

export interface DocumentCandidate {
  bytes: number
  count: number
  documentId: string
}

export interface DraftCandidate extends DocumentCandidate {
  draftId: string
  title: string
}

const REVISION_BYTES = sql.raw(`(
  octet_length(coalesce(r.content, '')) + octet_length(r.text)
  + coalesce(octet_length(r.images::text), 0)
  + coalesce(octet_length(r.meta::text), 0)
  + coalesce(octet_length(r.type_specific_data::text), 0)
)`)

const CRDT_BYTES = sql.raw(`(
  octet_length(c.snapshot) + octet_length(c.snapshot_version)
  + coalesce((select sum(octet_length(u.bytes)) from content_crdt_updates u where u.document_id = c.document_id), 0)
)`)

const PROTECTED = sql.raw(`(
  r.id in (select published_revision_id from content_documents where id = r.document_id and published_revision_id is not null)
  or r.id in (select revision_id from content_publication_events where document_id = r.document_id)
  or r.id in (select previous_revision_id from content_publication_events where document_id = r.document_id and previous_revision_id is not null)
  or r.id in (select revision_id from content_document_shares where document_id = r.document_id and revision_id is not null)
  or r.id in (select base_revision_id from drafts where document_id = r.document_id)
  or r.id in (select head_revision_id from drafts where document_id = r.document_id)
  or r.id in (select synced_revision_id from content_crdt_docs where document_id = r.document_id and synced_revision_id is not null)
  or (r.kind = 'import' and r.frontiers is not null and exists (select 1 from content_crdt_docs where document_id = r.document_id))
)`)

// Opening a published Lexical document checkpoints it as an import; that is not an edit.
const HEAD_MATCHES_PUBLISHED = `(
  (h.id = cd.published_revision_id
    or (h.kind = 'import' and h.parent_revision_id = cd.published_revision_id))
  and not exists (
    select 1 from content_crdt_docs c
    where c.document_id = d.document_id and c.edited_at > h.created_at
  )
)`

const RELATION = sql.raw(`case
  when cd.published_revision_id is null then 'fresh'
  when ${HEAD_MATCHES_PUBLISHED} then 'in_sync'
  else 'ahead'
end`)

const toNumber = (value: unknown) => Number(value ?? 0)

type CardRow = {
  base_revision_id: string
  created_at: Date
  crdt_bytes: string
  document_id: string
  head_content_format: string
  head_created_at: Date
  head_revision_id: string
  head_title: string
  id: string
  published_revision_id: string | null
  ref_id: string | null
  ref_type: string
  relation: DraftRelation
  revision_bytes: string
  revision_count: string
  status: string
  total: string
  updated_at: Date | null
}

const idOf = (value: string) => toEntityId(value) as EntityId

const toCard = (row: CardRow): DraftCard => ({
  baseRevisionId: idOf(row.base_revision_id),
  createdAt: new Date(row.created_at),
  document: {
    id: idOf(row.document_id),
    publishedRevisionId: row.published_revision_id
      ? idOf(row.published_revision_id)
      : null,
    refId: row.ref_id ? idOf(row.ref_id) : null,
    refType: row.ref_type as DraftRefType,
  },
  documentId: idOf(row.document_id),
  headRevision: {
    contentFormat: row.head_content_format,
    createdAt: new Date(row.head_created_at),
    id: idOf(row.head_revision_id),
    title: row.head_title,
  },
  headRevisionId: idOf(row.head_revision_id),
  id: idOf(row.id),
  relation: row.relation,
  status: row.status as DraftBranchStatus,
  storage: {
    crdtBytes: toNumber(row.crdt_bytes),
    revisionBytes: toNumber(row.revision_bytes),
    revisionCount: toNumber(row.revision_count),
  },
  updatedAt: row.updated_at ? new Date(row.updated_at) : null,
})

@Injectable()
export class DraftStorageRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  async totals(): Promise<StorageTotals> {
    const result = await this.db.execute<Record<string, string>>(sql`
      select
        (select count(*) from content_revisions) as revisions_count,
        (select coalesce(sum(${REVISION_BYTES}), 0) from content_revisions r) as revisions_bytes,
        (select count(*) from content_crdt_docs) as crdt_count,
        (select coalesce(sum(octet_length(snapshot) + octet_length(snapshot_version)), 0) from content_crdt_docs) as crdt_bytes,
        (select count(*) from content_crdt_updates) as updates_count,
        (select coalesce(sum(octet_length(bytes)), 0) from content_crdt_updates) as updates_bytes
    `)
    const row = result.rows[0] ?? {}
    return {
      crdt: {
        bytes: toNumber(row.crdt_bytes),
        count: toNumber(row.crdt_count),
      },
      revisions: {
        bytes: toNumber(row.revisions_bytes),
        count: toNumber(row.revisions_count),
      },
      updates: {
        bytes: toNumber(row.updates_bytes),
        count: toNumber(row.updates_count),
      },
    }
  }

  async cards(
    page: number,
    size: number,
    filter: DraftCardFilter,
  ): Promise<PaginationResult<DraftCard>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const order =
      filter.sort === 'size'
        ? sql`revision_bytes + crdt_bytes desc, updated_at desc, id desc`
        : sql`updated_at desc nulls last, created_at desc, id desc`
    const result = await this.db.execute<CardRow>(sql`
      with cards as (
        select d.id, d.document_id, d.base_revision_id, d.head_revision_id, d.status,
          d.created_at, d.updated_at, cd.ref_id, cd.ref_type, cd.published_revision_id,
          h.title as head_title, h.content_format as head_content_format,
          h.created_at as head_created_at, ${RELATION} as relation,
          coalesce(rs.revision_count, 0) as revision_count,
          coalesce(rs.revision_bytes, 0) as revision_bytes,
          coalesce((select ${CRDT_BYTES} from content_crdt_docs c where c.document_id = d.document_id), 0) as crdt_bytes
        from drafts d
        join content_documents cd on cd.id = d.document_id
        join content_revisions h on h.id = d.head_revision_id
        left join lateral (
          select count(*) as revision_count, sum(${REVISION_BYTES}) as revision_bytes
          from content_revisions r where r.document_id = d.document_id
        ) rs on true
        where ${this.cardWhere(filter)}
      )
      select *, count(*) over () as total from cards
      ${filter.relation ? sql`where relation = ${filter.relation}` : sql``}
      order by ${order}
      limit ${size} offset ${(page - 1) * size}
    `)
    const rows = result.rows
    const total = rows.length
      ? toNumber(rows[0].total)
      : filter.relation || page > 1
        ? await this.countCards(filter)
        : 0
    return {
      data: rows.map(toCard),
      pagination: this.paginationOf(total, page, size),
    }
  }

  async relationCounts(
    filter: DraftCardFilter = {},
  ): Promise<Record<DraftRelation, number>> {
    const result = await this.db.execute<{
      count: string
      relation: DraftRelation
    }>(sql`
      select ${RELATION} as relation, count(*) as count
      from drafts d
      join content_documents cd on cd.id = d.document_id
      join content_revisions h on h.id = d.head_revision_id
      where ${this.cardWhere(filter)}
      group by 1
    `)
    const counts: Record<DraftRelation, number> = {
      ahead: 0,
      fresh: 0,
      in_sync: 0,
    }
    for (const row of result.rows) counts[row.relation] = toNumber(row.count)
    return counts
  }

  async inSyncDrafts(cutoff: Date): Promise<DraftCandidate[]> {
    return this.draftCandidates(sql`
      d.status = 'active'
      and ${sql.raw(HEAD_MATCHES_PUBLISHED)}
      and d.updated_at < ${cutoff}
      and not exists (
        select 1 from content_crdt_docs c
        where c.document_id = d.document_id and c.edited_at >= ${cutoff}
      )
    `)
  }

  async archivedDrafts(): Promise<DraftCandidate[]> {
    return this.draftCandidates(sql`d.status = 'archived'`)
  }

  async staleRevisions(cutoff: Date): Promise<DocumentCandidate[]> {
    const result = await this.db.execute<{
      bytes: string
      count: string
      document_id: string
    }>(sql`
      select r.document_id, sum(${REVISION_BYTES}) as bytes, count(*) as count
      from content_revisions r
      where r.created_at < ${cutoff} and not ${PROTECTED}
      group by r.document_id
    `)
    return result.rows.map((row) => ({
      bytes: toNumber(row.bytes),
      count: toNumber(row.count),
      documentId: String(row.document_id),
    }))
  }

  async idleCrdtDocs(cutoff: Date): Promise<DocumentCandidate[]> {
    const result = await this.db.execute<{
      bytes: string
      document_id: string
    }>(sql`
      select c.document_id, ${CRDT_BYTES} - 2 * octet_length(coalesce(h.content, '')) as bytes
      from content_crdt_docs c
      join drafts d on d.document_id = c.document_id and d.status = 'active'
      join content_revisions h on h.id = d.head_revision_id
      where coalesce(c.edited_at, c.updated_at) < ${cutoff}
        and ${CRDT_BYTES} > 2 * octet_length(coalesce(h.content, '')) + 8192
    `)
    return result.rows.map((row) => ({
      bytes: toNumber(row.bytes),
      count: 1,
      documentId: String(row.document_id),
    }))
  }

  async crdtReclaimable(documentId: string): Promise<number> {
    const result = await this.db.execute<{ bytes: string | null }>(sql`
      select ${CRDT_BYTES} - 2 * octet_length(coalesce(h.content, '')) as bytes
      from content_crdt_docs c
      join drafts d on d.document_id = c.document_id and d.status = 'active'
      join content_revisions h on h.id = d.head_revision_id
      where c.document_id = ${documentId}
      limit 1
    `)
    return Math.max(0, toNumber(result.rows[0]?.bytes))
  }

  async orphanCrdtDocs(): Promise<DocumentCandidate[]> {
    const result = await this.db.execute<{
      bytes: string
      document_id: string
    }>(sql`
      select c.document_id, ${CRDT_BYTES} as bytes
      from content_crdt_docs c
      where not exists (
        select 1 from drafts d where d.document_id = c.document_id and d.status = 'active'
      )
    `)
    return result.rows.map((row) => ({
      bytes: toNumber(row.bytes),
      count: 1,
      documentId: String(row.document_id),
    }))
  }

  private async countCards(filter: DraftCardFilter) {
    const counts = await this.relationCounts(filter)
    return filter.relation
      ? counts[filter.relation]
      : counts.ahead + counts.fresh + counts.in_sync
  }

  private cardWhere(filter: DraftCardFilter): SQL {
    const conditions: SQL[] = [sql`d.status = ${filter.status ?? 'active'}`]
    if (filter.refType) conditions.push(sql`cd.ref_type = ${filter.refType}`)
    if (filter.hasRef !== undefined) {
      conditions.push(
        filter.hasRef ? sql`cd.ref_id is not null` : sql`cd.ref_id is null`,
      )
    }
    if (filter.search) {
      const pattern = `%${filter.search}%`
      conditions.push(
        sql`(h.title ilike ${pattern} or h.text ilike ${pattern} or h.content ilike ${pattern})`,
      )
    }
    return sql.join(conditions, sql` and `)
  }

  private async draftCandidates(where: SQL): Promise<DraftCandidate[]> {
    const result = await this.db.execute<{
      bytes: string
      document_id: string
      draft_id: string
      title: string
    }>(sql`
      select d.id as draft_id, d.document_id, h.title,
        coalesce((
          select sum(${REVISION_BYTES}) from content_revisions r
          where r.document_id = d.document_id and r.id is distinct from cd.published_revision_id
        ), 0)
        + coalesce((select ${CRDT_BYTES} from content_crdt_docs c where c.document_id = d.document_id), 0) as bytes
      from drafts d
      join content_documents cd on cd.id = d.document_id
      join content_revisions h on h.id = d.head_revision_id
      where ${where}
      order by d.updated_at asc
    `)
    return result.rows.map((row) => ({
      bytes: toNumber(row.bytes),
      count: 1,
      documentId: String(row.document_id),
      draftId: String(row.draft_id),
      title: row.title,
    }))
  }
}
