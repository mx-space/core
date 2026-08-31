import { SnowflakeGenerator } from '@mx-space/db-schema/id'

import { jsonDiffStrategy, textDiffStrategy } from '~/modules/draft/diff'
import { DraftRefType } from '~/modules/draft/draft.enum'
import type { RevisionSnapshot } from '~/modules/draft/draft.types'
import {
  canonicalSnapshot,
  sameRevisionContent,
} from '~/modules/draft/draft-content'

import type { AppMigration } from './types'

interface LegacyHistoryEntry {
  baseVersion?: number
  content?: string | null
  contentFormat?: string
  images?: unknown[] | string | null
  isFullSnapshot?: boolean
  meta?: Record<string, unknown> | string | null
  refVersion?: number
  savedAt: Date | string
  text?: string | null
  title: string
  typeSpecificData?: Record<string, unknown> | string | null
  version: number
}

interface LegacyDraft {
  content: string | null
  content_format: string
  created_at: Date
  history: LegacyHistoryEntry[] | null
  id: string
  images: unknown[] | string | null
  meta: Record<string, unknown> | string | null
  published_version: number | null
  ref_id: string | null
  ref_type: DraftRefType
  text: string
  title: string
  type_specific_data: Record<string, unknown> | string | null
  updated_at: Date | null
  version: number
}

interface RevisionInsert extends RevisionSnapshot {
  createdAt: Date
  legacyVersion?: number
}

const parseLegacyJson = (value: unknown): unknown => {
  let parsed = value
  for (let depth = 0; depth < 2 && typeof parsed === 'string'; depth++) {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return null
    }
  }
  return parsed
}

const parseJsonObject = (value: unknown) => {
  const parsed = parseLegacyJson(value)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null
}

const parseJsonArray = (value: unknown) => {
  const parsed = parseLegacyJson(value)
  return Array.isArray(parsed) ? parsed : null
}

const jsonParam = (value: unknown) =>
  value === null || value === undefined ? null : JSON.stringify(value)

const parseTypeSpecificData = (value: unknown) => {
  if (!value) return null
  try {
    return parseJsonObject(value)
  } catch {
    return null
  }
}

const resolveHistory = (
  entry: LegacyHistoryEntry,
  history: LegacyHistoryEntry[],
  current: Pick<LegacyDraft, 'content' | 'text'>,
): RevisionInsert => {
  const format = entry.contentFormat ?? 'markdown'
  const lexical = format === 'lexical'
  const field = lexical ? 'content' : 'text'
  let primary = (entry[field] as string | null | undefined) ?? ''
  const targetIndex = history.findIndex(
    (item) => item.version === entry.version,
  )
  const referenced =
    entry.refVersion === undefined
      ? undefined
      : history.find((item) => item.version === entry.refVersion)
  const base =
    referenced?.isFullSnapshot === true
      ? referenced
      : history.slice(targetIndex + 1).find((item) => item.isFullSnapshot)

  if (!entry.isFullSnapshot) {
    const baseValue =
      ((base?.[field] as string | null | undefined) ??
        (lexical ? current.content : current.text)) ||
      ''
    if (entry.refVersion !== undefined && !primary) {
      primary = baseValue
    } else {
      primary = (lexical ? jsonDiffStrategy : textDiffStrategy).applyPatch(
        baseValue,
        primary,
      )
    }
  }

  return {
    ...canonicalSnapshot(formatRefType(entry), {
      content: lexical ? primary : (entry.content ?? base?.content ?? null),
      contentFormat: format,
      images: parseJsonArray(entry.images),
      meta: parseJsonObject(entry.meta),
      text: lexical ? (entry.text ?? '') : primary,
      title: entry.title,
      typeSpecificData: parseTypeSpecificData(entry.typeSpecificData),
    }),
    createdAt: new Date(entry.savedAt),
    legacyVersion: entry.version,
  }
}

// History entries did not carry refType. The caller canonicalizes them again
// with the real type before insertion; this pass only resolves patch content.
const formatRefType = (_entry: LegacyHistoryEntry) => DraftRefType.Page

const articleSnapshot = async (
  client: import('pg').PoolClient,
  refType: DraftRefType,
  refId: string,
): Promise<RevisionSnapshot | null> => {
  if (refType === DraftRefType.Post) {
    const result = await client.query(
      `
      SELECT p.*,
        COALESCE(
          (SELECT jsonb_agg(pr.related_post_id ORDER BY pr.position)
           FROM post_related_posts pr WHERE pr.post_id = p.id),
          '[]'::jsonb
        ) AS related_ids
      FROM posts p WHERE p.id = $1
    `,
      [refId],
    )
    const row = result.rows[0]
    return row
      ? canonicalSnapshot(refType, {
          content: row.content,
          contentFormat: row.content_format,
          images: row.images,
          meta: row.meta,
          text: row.text,
          title: row.title,
          typeSpecificData: {
            categoryId: row.category_id,
            copyright: row.copyright,
            isPremium: row.is_premium,
            pin: Boolean(row.pin_at),
            pinOrder: row.pin_order,
            relatedId: row.related_ids,
            slug: row.slug,
            summary: row.summary,
            tags: row.tags,
          },
        })
      : null
  }
  if (refType === DraftRefType.Note) {
    const result = await client.query('SELECT * FROM notes WHERE id = $1', [
      refId,
    ])
    const row = result.rows[0]
    return row
      ? canonicalSnapshot(refType, {
          content: row.content,
          contentFormat: row.content_format,
          images: row.images,
          meta: row.meta,
          text: row.text,
          title: row.title,
          typeSpecificData: {
            bookmark: row.bookmark,
            coordinates: row.coordinates,
            location: row.location,
            mood: row.mood,
            password: row.password,
            publicAt: row.public_at,
            slug: row.slug,
            topicId: row.topic_id,
            weather: row.weather,
          },
        })
      : null
  }
  const result = await client.query('SELECT * FROM pages WHERE id = $1', [
    refId,
  ])
  const row = result.rows[0]
  return row
    ? canonicalSnapshot(refType, {
        content: row.content,
        contentFormat: row.content_format,
        images: row.images,
        meta: row.meta,
        text: row.text,
        title: row.title,
        typeSpecificData: {
          order: row.order,
          slug: row.slug,
          subtitle: row.subtitle,
        },
      })
    : null
}

export const migration: AppMigration = {
  id: '20260831-tree-content-revisions',
  description: 'Convert linear draft histories into immutable revision trees',
  async up({ pool, logger }) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const legacyExists = await client.query<{ exists: boolean }>(`
        SELECT to_regclass('public.legacy_drafts') IS NOT NULL AS exists
      `)
      if (!legacyExists.rows[0]?.exists) {
        await client.query('COMMIT')
        return
      }

      const existing = await client.query<{ count: string }>(
        'SELECT count(*) FROM drafts',
      )
      if (Number(existing.rows[0]?.count ?? 0) !== 0) {
        throw new Error(
          'Tree draft tables are not empty before legacy conversion',
        )
      }

      const legacyRows = await client.query<LegacyDraft>(
        'SELECT * FROM legacy_drafts ORDER BY created_at, id',
      )
      const separateHistoryRows = await client.query<
        LegacyHistoryEntry & { draft_id: string }
      >(`
        SELECT draft_id, version, title, text, content, content_format AS "contentFormat",
          type_specific_data AS "typeSpecificData", saved_at AS "savedAt",
          is_full_snapshot AS "isFullSnapshot", ref_version AS "refVersion",
          base_version AS "baseVersion"
        FROM legacy_draft_histories
        ORDER BY version
      `)
      const separateHistory = Map.groupBy(
        separateHistoryRows.rows,
        (entry) => entry.draft_id,
      )
      const ids = new SnowflakeGenerator({ workerId: 1023 })
      let revisionCount = 0

      for (const legacy of legacyRows.rows) {
        const documentId = ids.nextId()
        const branchId = legacy.id
        const publishedSnapshot = legacy.ref_id
          ? await articleSnapshot(client, legacy.ref_type, legacy.ref_id)
          : null
        const history = [
          ...(legacy.history ?? []),
          ...(separateHistory.get(legacy.id) ?? []),
        ]
          .filter(
            (entry, index, entries) =>
              entries.findIndex((item) => item.version === entry.version) ===
              index,
          )
          .sort((left, right) => left.version - right.version)
        const chain = history.map((entry) => {
          const resolved = resolveHistory(entry, history, legacy)
          return {
            ...resolved,
            ...canonicalSnapshot(legacy.ref_type, resolved),
          }
        })
        chain.push({
          ...canonicalSnapshot(legacy.ref_type, {
            content: legacy.content,
            contentFormat: legacy.content_format,
            images: parseJsonArray(legacy.images),
            meta: parseJsonObject(legacy.meta),
            text: legacy.text,
            title: legacy.title,
            typeSpecificData: parseJsonObject(legacy.type_specific_data),
          }),
          createdAt: legacy.updated_at ?? legacy.created_at,
          legacyVersion: legacy.version,
        })

        const uniqueChain = chain.filter(
          (revision, index) =>
            index === 0 ||
            revision.legacyVersion !== chain[index - 1].legacyVersion,
        )
        const knownPublishedIndex = legacy.published_version
          ? uniqueChain.findIndex(
              (revision) => revision.legacyVersion === legacy.published_version,
            )
          : -1
        const headMatchesArticle =
          publishedSnapshot &&
          sameRevisionContent(uniqueChain.at(-1)!, publishedSnapshot)

        await client.query(
          `INSERT INTO content_documents (id, ref_type, ref_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            documentId,
            legacy.ref_type,
            publishedSnapshot ? legacy.ref_id : null,
            legacy.created_at,
            legacy.updated_at,
          ],
        )

        let sharedRootId: string | null = null
        let publishedRevisionId: string | null = null
        let parentRevisionId: string | null = null
        const revisionByLegacyVersion = new Map<number, string>()

        if (
          publishedSnapshot &&
          knownPublishedIndex < 0 &&
          !headMatchesArticle
        ) {
          sharedRootId = ids.nextId()
          await client.query(
            `INSERT INTO content_revisions
             (id, document_id, parent_revision_id, title, text, content,
              content_format, images, meta, type_specific_data, created_at)
             VALUES ($1, $2, NULL, '', '', NULL, 'markdown', NULL, NULL, NULL, $3)`,
            [sharedRootId, documentId, legacy.created_at],
          )
          publishedRevisionId = ids.nextId()
          await client.query(
            `INSERT INTO content_revisions
             (id, document_id, parent_revision_id, title, text, content,
              content_format, images, meta, type_specific_data, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              publishedRevisionId,
              documentId,
              sharedRootId,
              publishedSnapshot.title,
              publishedSnapshot.text,
              publishedSnapshot.content,
              publishedSnapshot.contentFormat,
              jsonParam(publishedSnapshot.images),
              jsonParam(publishedSnapshot.meta),
              jsonParam(publishedSnapshot.typeSpecificData),
              legacy.updated_at ?? legacy.created_at,
            ],
          )
          parentRevisionId = sharedRootId
          revisionCount += 2
        }

        for (const revision of uniqueChain) {
          const revisionId = ids.nextId()
          await client.query(
            `INSERT INTO content_revisions
             (id, document_id, parent_revision_id, title, text, content,
              content_format, images, meta, type_specific_data, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              revisionId,
              documentId,
              parentRevisionId,
              revision.title,
              revision.text,
              revision.content,
              revision.contentFormat,
              jsonParam(revision.images),
              jsonParam(revision.meta),
              jsonParam(revision.typeSpecificData),
              revision.createdAt,
            ],
          )
          parentRevisionId = revisionId
          revisionByLegacyVersion.set(revision.legacyVersion!, revisionId)
          revisionCount++
        }

        const headRevisionId = parentRevisionId!
        if (knownPublishedIndex >= 0) {
          publishedRevisionId = revisionByLegacyVersion.get(
            legacy.published_version!,
          )!
        } else if (headMatchesArticle) {
          publishedRevisionId = headRevisionId
        }
        const baseRevisionId =
          publishedRevisionId ??
          sharedRootId ??
          revisionByLegacyVersion.values().next().value

        await client.query(
          `INSERT INTO drafts
           (id, document_id, base_revision_id, head_revision_id, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,'active',$5,$6)`,
          [
            branchId,
            documentId,
            baseRevisionId,
            headRevisionId,
            legacy.created_at,
            legacy.updated_at,
          ],
        )
        if (publishedRevisionId) {
          await client.query(
            'UPDATE content_documents SET published_revision_id = $1 WHERE id = $2',
            [publishedRevisionId, documentId],
          )
          await client.query(
            `INSERT INTO content_publication_events
             (id, document_id, revision_id, previous_revision_id, created_at)
             VALUES ($1,$2,$3,NULL,$4)`,
            [
              ids.nextId(),
              documentId,
              publishedRevisionId,
              legacy.updated_at ?? legacy.created_at,
            ],
          )
        }
      }

      await client.query('DROP TABLE legacy_draft_histories')
      await client.query('DROP TABLE legacy_drafts')
      await client.query('COMMIT')
      logger.log(
        `Converted ${legacyRows.rowCount ?? legacyRows.rows.length} draft branches and ${revisionCount} revisions`,
      )
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}
