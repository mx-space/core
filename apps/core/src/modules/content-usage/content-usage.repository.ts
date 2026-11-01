import { Inject, Injectable, Logger } from '@nestjs/common'
import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { createDocument, readDocContent } from '~/modules/draft/draft-crdt.doc'
import {
  buildFileUrlReferencePattern,
  containsFileUrlReference,
} from '~/modules/file/file-reference-usage.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

import type {
  ContentUsage,
  DraftUsage,
  OtherUsage,
  PublishedUsage,
} from './content-usage.types'

export const DYNAMIC_CATALOG_SNIPPET_PATH = 'dynamic-widgets-catalog'

type Row = Record<string, unknown> & { url: string }

const text = (value: unknown) => (value == null ? '' : String(value))

const REVISION_HAYSTACK = sql.raw(
  `concat_ws(E'\\n', r.text, r.content, r.images::text, r.meta::text, r.type_specific_data::text)`,
)

const SOURCES = {
  posts: sql`(
    select p.id, p.title, p.slug,
      concat_ws(E'\n', p.text, p.content, p.images::text, p.meta::text) as haystack
    from posts p
  )`,
  notes: sql`(
    select n.id, n.title, n.nid::text as slug,
      concat_ws(E'\n', n.text, n.content, n.images::text, n.meta::text) as haystack
    from notes n
  )`,
  pages: sql`(
    select g.id, g.title, g.slug,
      concat_ws(E'\n', g.text, g.content, g.images::text, g.meta::text) as haystack
    from pages g
  )`,
  translations: sql`(
    select t.id, t.title || ' (' || t.lang || ')' as title, t.ref_id as slug,
      concat_ws(E'\n', t.title, t.subtitle, t.summary, t.text, t.content) as haystack
    from ai_translations t
  )`,
  shares: sql`(
    select s.id, r.title, null::text as slug, ${REVISION_HAYSTACK} as haystack
    from content_document_shares s
    join content_revisions r on r.id = s.revision_id
    where s.mode = 'pinned'
  )`,
  draftHeads: sql`(
    select d.id as draft_id, d.document_id, r.title, ${REVISION_HAYSTACK} as haystack
    from drafts d
    join content_revisions r on r.id = d.head_revision_id
    where d.status = 'active'
  )`,
  snippets: sql`(
    select sn.id, sn.path as title, concat_ws(E'\n', sn.raw, sn.comment) as haystack
    from snippets sn
    where sn.path <> ${DYNAMIC_CATALOG_SNIPPET_PATH}
  )`,
  topics: sql`(
    select tp.id, tp.name as title,
      concat_ws(E'\n', tp.description, tp.introduce, tp.icon) as haystack
    from topics tp
  )`,
  recentlies: sql`(
    select rc.id, left(rc.content, 60) as title,
      concat_ws(E'\n', rc.content, rc.metadata::text) as haystack
    from recentlies rc
  )`,
  revisions: sql`(
    select r.id, ${REVISION_HAYSTACK} as haystack
    from content_revisions r
  )`,
}

@Injectable()
export class ContentUsageRepository {
  private readonly logger = new Logger(ContentUsageRepository.name)

  constructor(@Inject(PG_DB_TOKEN) private readonly db: AppDatabase) {}

  async findUsage(urls: string[]): Promise<ContentUsage[]> {
    const unique = [...new Set(urls.filter(Boolean))]
    if (unique.length === 0) return []

    const [
      posts,
      notes,
      pages,
      translations,
      shares,
      heads,
      snippets,
      topics,
      recentlies,
      revisions,
      files,
      live,
    ] = await Promise.all([
      this.match(unique, SOURCES.posts, sql`s.id, s.title, s.slug`),
      this.match(unique, SOURCES.notes, sql`s.id, s.title, s.slug`),
      this.match(unique, SOURCES.pages, sql`s.id, s.title, s.slug`),
      this.match(unique, SOURCES.translations, sql`s.id, s.title, s.slug`),
      this.match(unique, SOURCES.shares, sql`s.id, s.title`),
      this.match(
        unique,
        SOURCES.draftHeads,
        sql`s.draft_id, s.document_id, s.title`,
      ),
      this.match(unique, SOURCES.snippets, sql`s.id, s.title`),
      this.match(unique, SOURCES.topics, sql`s.id, s.title`),
      this.match(unique, SOURCES.recentlies, sql`s.id, s.title`),
      this.match(unique, SOURCES.revisions, sql`s.id`),
      this.fileReferences(unique),
      this.liveDraftMatches(unique),
    ])

    const usage = new Map<string, ContentUsage>(
      unique.map((url) => [
        url,
        {
          bytes: null,
          drafts: [],
          fileReferenceId: null,
          historyOnly: false,
          other: [],
          published: [],
          url,
        },
      ]),
    )
    const published = (rows: Row[], type: PublishedUsage['type']) => {
      for (const row of rows)
        usage.get(row.url)!.published.push({
          id: text(row.id),
          title: text(row.title),
          type,
          ...(row.slug == null ? {} : { slug: text(row.slug) }),
        })
    }
    const other = (rows: Row[], type: OtherUsage['type']) => {
      for (const row of rows)
        usage
          .get(row.url)!
          .other.push({ id: text(row.id), title: text(row.title), type })
    }
    published(posts, 'post')
    published(notes, 'note')
    published(pages, 'page')
    published(translations, 'translation')
    published(shares, 'share')
    other(snippets, 'snippet')
    other(topics, 'topic')
    other(recentlies, 'recently')

    for (const row of heads) {
      usage.get(row.url)!.drafts.push({
        documentId: text(row.document_id),
        draftId: text(row.draft_id),
        live: false,
        title: text(row.title),
      })
    }
    for (const hit of live) {
      const drafts = usage.get(hit.url)!.drafts
      const existing = drafts.find((item) => item.draftId === hit.draftId)
      if (existing) existing.live = true
      else drafts.push(hit)
    }

    const inRevisions = new Set(revisions.map((row) => row.url))
    for (const file of files) {
      const entry = usage.get(file.url)!
      entry.fileReferenceId = text(file.id)
      entry.bytes = file.byte_size == null ? null : Number(file.byte_size)
    }
    for (const entry of usage.values()) {
      entry.historyOnly =
        inRevisions.has(entry.url) &&
        entry.published.length === 0 &&
        entry.drafts.length === 0 &&
        entry.other.length === 0
    }
    return [...usage.values()]
  }

  private async match(urls: string[], source: SQL, columns: SQL) {
    const result = await this.db.execute<Row>(sql`
      with candidates(url, pattern) as (values ${candidateValues(urls)})
      select c.url, ${columns}
      from candidates c
      join ${source} s on s.haystack ~ c.pattern
    `)
    return result.rows
  }

  private async fileReferences(urls: string[]) {
    const result = await this.db.execute<{
      byte_size: string | null
      id: string
      url: string
    }>(sql`
      select distinct on (f.file_url) f.file_url as url, f.id, f.byte_size
      from file_references f
      where f.file_url in (${sql.join(
        urls.map((url) => sql`${url}`),
        sql`, `,
      )})
      order by f.file_url, f.created_at desc
    `)
    return result.rows
  }

  private async liveDraftMatches(
    urls: string[],
  ): Promise<Array<DraftUsage & { url: string }>> {
    const result = await this.db.execute<{
      document_id: string
      draft_id: string
      snapshot: Buffer
      title: string
    }>(sql`
      select d.id as draft_id, d.document_id, h.title, c.snapshot
      from drafts d
      join content_revisions h on h.id = d.head_revision_id
      join content_crdt_docs c on c.document_id = d.document_id
      where d.status = 'active' and c.edited_at > h.created_at
    `)
    const hits: Array<DraftUsage & { url: string }> = []
    for (const row of result.rows) {
      const draft = {
        documentId: text(row.document_id),
        draftId: text(row.draft_id),
        live: true,
        title: text(row.title),
      }
      const serialized = await this.readLiveContent(
        row.document_id,
        row.snapshot,
      )
      for (const url of urls) {
        if (serialized === null || containsFileUrlReference(serialized, url))
          hits.push({ ...draft, url })
      }
    }
    return hits
  }

  // A draft whose live content cannot be decoded is reported as using every
  // URL: cleanup must never treat unreadable work in progress as "unused".
  private async readLiveContent(documentId: string, snapshot: Buffer) {
    try {
      const updates = await this.db.execute<{ bytes: Buffer }>(sql`
        select u.bytes from content_crdt_updates u
        where u.document_id = ${documentId}
        order by u.created_at asc, u.id asc
      `)
      const doc = createDocument()
      doc.import(new Uint8Array(snapshot))
      if (updates.rows.length)
        doc.importBatch(updates.rows.map((row) => new Uint8Array(row.bytes)))
      const content = readDocContent(doc)
      return `${content.title}\n${content.content}\n${JSON.stringify(content.fields ?? null)}`
    } catch (error) {
      this.logger.warn(
        `Could not decode live draft ${documentId}: ${(error as Error).message}`,
      )
      return null
    }
  }
}

function candidateValues(urls: string[]) {
  return sql.join(
    urls.map((url) => sql`(${url}, ${buildFileUrlReferencePattern(url)})`),
    sql`, `,
  )
}
