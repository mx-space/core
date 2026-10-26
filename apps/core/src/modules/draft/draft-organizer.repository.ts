import { Inject, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { BaseRepository } from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

import type { DraftRefType } from './draft.enum'
import type { CleanupTx } from './draft-cleanup.repository'

export interface OrganizerFilter {
  olderThanDays: number
  refType?: DraftRefType
  search?: string
}

export interface OrganizerCandidate {
  bytes: number
  documentId: string
  draftCount: number
  draftIds: string[]
  hasChanges: boolean
  lastEditedAt: Date
  publishedRevisionId: string
  refType: DraftRefType
  revisionCount: number
  title: string
  version: string
}

@Injectable()
export class DraftOrganizerRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  async candidates(
    filter: OrganizerFilter,
    tx: AppDatabase | CleanupTx = this.db,
    documentId?: string,
  ): Promise<OrganizerCandidate[]> {
    const cutoff = new Date(Date.now() - filter.olderThanDays * 86_400_000)
    const result = await tx.execute<{
      bytes: string
      document_id: string
      draft_ids: string[]
      has_changes: boolean
      last_edited_at: Date
      published_revision_id: string
      ref_type: DraftRefType
      revision_count: string
      title: string
      version: string
    }>(sql`
      with candidates as (
        select cd.id as document_id, p.title, cd.ref_type, cd.published_revision_id,
          d.ids as draft_ids,
          greatest(cd.created_at, cd.updated_at, p.created_at, d.last_edit, c.edited_at,
            live.last_edit) as last_edited_at,
          d.changed or coalesce(c.edited_at > p.created_at, false) as has_changes,
          rs.revision_count,
          rs.bytes + coalesce(octet_length(c.snapshot) + octet_length(c.snapshot_version), 0)
            + us.bytes as bytes,
          md5(jsonb_build_array(to_jsonb(cd), d.state, rs.state, us.state,
            c.updated_at, c.edited_at, c.fields, encode(c.snapshot_version, 'hex'),
            live.last_edit, shares.state)::text) as version
        from content_documents cd
        join content_revisions p on p.id = cd.published_revision_id
        join lateral (
          select modified_at as last_edit from posts where cd.ref_type = 'post' and id = cd.ref_id and is_published
          union all
          select modified_at from notes where cd.ref_type = 'note' and id = cd.ref_id and is_published
            and (public_at is null or public_at <= now())
          union all
          select modified_at from pages where cd.ref_type = 'page' and id = cd.ref_id
        ) live on true
        join lateral (
          select array_agg(d.id::text order by d.id) as ids,
            jsonb_agg(jsonb_build_array(d.id, d.base_revision_id, d.head_revision_id, d.status, d.updated_at) order by d.id) as state,
            max(coalesce(d.updated_at, d.created_at)) as last_edit,
            bool_or(d.status = 'active'
              and not coalesce(h.kind = 'import' and h.parent_revision_id = p.id, false) and
              (h.title, h.text, h.content, h.content_format, h.images, h.meta, h.type_specific_data)
              is distinct from
              (p.title, p.text, p.content, p.content_format, p.images, p.meta, p.type_specific_data)) as changed
          from drafts d join content_revisions h on h.id = d.head_revision_id
          where d.document_id = cd.id
          having count(*) > 0
        ) d on true
        left join content_crdt_docs c on c.document_id = cd.id
        left join lateral (
          select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb) as state
          from content_document_shares s where s.document_id = cd.id
        ) shares on true
        join lateral (
          select count(*) filter (where reclaimable) as revision_count,
            coalesce(sum(bytes) filter (where reclaimable), 0) as bytes,
            jsonb_build_array(count(*), max(id), max(created_at)) as state
          from (
            select r.id, r.created_at,
              octet_length(coalesce(r.content, '')) + octet_length(r.text)
              + coalesce(octet_length(r.images::text), 0)
              + coalesce(octet_length(r.meta::text), 0)
              + coalesce(octet_length(r.type_specific_data::text), 0) as bytes,
              r.id <> cd.published_revision_id
              and not exists (select 1 from content_publication_events e where e.document_id = cd.id and (e.revision_id = r.id or e.previous_revision_id = r.id))
              and not exists (select 1 from content_document_shares s where s.document_id = cd.id and s.revision_id = r.id) as reclaimable
            from content_revisions r where r.document_id = cd.id
          ) revisions
        ) rs on true
        join lateral (
          select coalesce(sum(octet_length(bytes)), 0) as bytes,
            jsonb_build_array(count(*), max(id)) as state
          from content_crdt_updates where document_id = cd.id
        ) us on true
        where ${documentId ? sql`cd.id = ${documentId}` : sql`true`}
          and ${filter.refType ? sql`cd.ref_type = ${filter.refType}` : sql`true`}
          and ${filter.search ? sql`p.title ilike ${`%${filter.search}%`}` : sql`true`}
      )
      select * from candidates
      where ${filter.olderThanDays ? sql`last_edited_at < ${cutoff}` : sql`true`}
      order by last_edited_at, document_id
    `)
    return result.rows.map((row) => ({
      bytes: Number(row.bytes),
      documentId: String(row.document_id),
      draftCount: row.draft_ids.length,
      draftIds: row.draft_ids,
      hasChanges: row.has_changes,
      lastEditedAt: new Date(row.last_edited_at),
      publishedRevisionId: String(row.published_revision_id),
      refType: row.ref_type,
      revisionCount: Number(row.revision_count),
      title: row.title,
      version: row.version,
    }))
  }

  async lockState(tx: CleanupTx, documentId: string) {
    await tx.execute(
      sql`select id from drafts where document_id = ${documentId} order by id for update`,
    )
    await tx.execute(
      sql`select document_id from content_crdt_docs where document_id = ${documentId} for update`,
    )
  }
}
