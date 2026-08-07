import { Inject, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  aiInsights,
  aiSummaries,
  aiTranslations,
  aiTtsBlocks,
  comments,
  draftHistories,
  drafts,
  links,
  metaPresets,
  notes,
  options,
  ownerProfiles,
  pages,
  posts,
  projects,
  readers,
  recentlies,
  says,
  serverlessStorages,
  snippets,
  topics,
  translationEntries,
} from '~/database/schema'
import type { AppDatabase } from '~/processors/database/postgres.provider'

import type { FileUsageMatch } from './file-usage.types'

export interface PersistedUsageSource {
  fields: Record<string, unknown>
  sourceId: string
  sourceType: string
}

export function buildFileUrlReferencePattern(fileUrl: string): string {
  const escaped = fileUrl.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  return `(?:^|[\\s"'<(\\[{=:])${escaped}(?:$|[\\s"'>)\\]},;]|[?#]|\\.(?=$|[\\s"'>)\\]}]))`
}

export function containsFileUrlReference(
  serialized: string,
  fileUrl: string,
): boolean {
  return new RegExp(buildFileUrlReferencePattern(fileUrl), 'u').test(serialized)
}

export function findUsageMatchesInSources(
  fileUrls: string[],
  sources: PersistedUsageSource[],
): FileUsageMatch[] {
  const candidates = [...new Set(fileUrls.filter(Boolean))].map((fileUrl) => ({
    fileUrl,
    pattern: new RegExp(buildFileUrlReferencePattern(fileUrl), 'u'),
  }))
  const matches = new Map<string, FileUsageMatch>()

  for (const source of sources) {
    for (const [sourceField, value] of Object.entries(source.fields)) {
      if (value === null || value === undefined) continue
      const serialized =
        typeof value === 'string' ? value : JSON.stringify(value)
      if (!serialized) continue

      for (const { fileUrl, pattern } of candidates) {
        if (!pattern.test(serialized)) continue
        const match: FileUsageMatch = {
          fileUrl,
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          sourceField,
        }
        matches.set(
          [fileUrl, source.sourceType, source.sourceId, sourceField].join('\0'),
          match,
        )
      }
    }
  }

  return [...matches.values()]
}

/**
 * Resolves actual persisted usage independently of file_references.refId.
 *
 * A file reference row stores only one representative owner, while the same
 * URL may legitimately be reused by multiple documents or modules. Isolated
 * file deletion therefore uses this conservative, cross-module check as its
 * final safety boundary.
 */
@Injectable()
export class FileReferenceUsageRepository {
  constructor(@Inject(PG_DB_TOKEN) private readonly db: AppDatabase) {}

  async findReferencedUrls(fileUrls: string[]): Promise<Set<string>> {
    const uniqueUrls = [...new Set(fileUrls.filter(Boolean))]
    if (uniqueUrls.length === 0) return new Set()

    const candidates = sql.join(
      uniqueUrls.map(
        (url) => sql`(${url}, ${buildFileUrlReferencePattern(url)})`,
      ),
      sql`, `,
    )
    const result = await this.db.execute<{ fileUrl: string }>(sql`
      WITH candidates(file_url, pattern) AS (VALUES ${candidates})
      SELECT candidate.file_url AS "fileUrl"
      FROM candidates AS candidate
      WHERE
        EXISTS (
          SELECT 1 FROM ${posts} AS item
          WHERE concat_ws(E'\n', item.text, item.content, item.images::text, item.meta::text) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${notes} AS item
          WHERE concat_ws(E'\n', item.text, item.content, item.images::text, item.meta::text) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${pages} AS item
          WHERE concat_ws(E'\n', item.text, item.content, item.images::text, item.meta::text) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${drafts} AS item
          WHERE concat_ws(E'\n', item.text, item.content, item.images::text, item.meta::text, item.type_specific_data::text, item.history::text) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${draftHistories} AS item
          WHERE concat_ws(E'\n', item.text, item.content, item.type_specific_data::text) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${snippets} AS item
          WHERE concat_ws(E'\n', item.raw, item.comment) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${topics} AS item
          WHERE concat_ws(E'\n', item.description, item.introduce, item.icon) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${recentlies} AS item
          WHERE concat_ws(E'\n', item.content, item.metadata::text) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${comments} AS item
          WHERE item.is_deleted = false
            AND concat_ws(E'\n', item.text, item.avatar, item.meta, item.anchor::text) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${projects} AS item
          WHERE concat_ws(E'\n', item.images::text, item.avatar, item.text, item.description, item.preview_url, item.doc_url, item.project_url) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${links} AS item
          WHERE concat_ws(E'\n', item.url, item.avatar, item.description) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${says} AS item
          WHERE concat_ws(E'\n', item.text, item.source) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${options} AS item
          WHERE item.value::text ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${metaPresets} AS item
          WHERE concat_ws(E'\n', item.description, item.fields::text) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${readers} AS item
          WHERE coalesce(item.image, '') ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${ownerProfiles} AS item
          WHERE concat_ws(E'\n', item.url, item.introduce, item.social_ids::text) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${aiTranslations} AS item
          WHERE concat_ws(E'\n', item.text, item.content, item.source_block_snapshots::text) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${aiSummaries} AS item
          WHERE item.summary ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${aiInsights} AS item
          WHERE item.content ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${aiTtsBlocks} AS item
          WHERE item.url ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${translationEntries} AS item
          WHERE concat_ws(E'\n', item.source_text, item.translated_text) ~ candidate.pattern
        )
        OR EXISTS (
          SELECT 1 FROM ${serverlessStorages} AS item
          WHERE item.value::text ~ candidate.pattern
        )
    `)

    return new Set(result.rows.map((row) => row.fileUrl))
  }

  async findUsageMatches(fileUrls: string[]): Promise<FileUsageMatch[]> {
    const uniqueUrls = [...new Set(fileUrls.filter(Boolean))]
    if (uniqueUrls.length === 0) return []

    const [
      postRows,
      noteRows,
      pageRows,
      draftRows,
      draftHistoryRows,
      snippetRows,
      topicRows,
      recentlyRows,
      commentRows,
      projectRows,
      linkRows,
      sayRows,
      optionRows,
      metaPresetRows,
      readerRows,
      ownerProfileRows,
      translationRows,
      summaryRows,
      insightRows,
      ttsBlockRows,
      translationEntryRows,
      serverlessStorageRows,
    ] = await Promise.all([
      this.db
        .select({
          id: posts.id,
          text: posts.text,
          content: posts.content,
          images: posts.images,
          meta: posts.meta,
        })
        .from(posts),
      this.db
        .select({
          id: notes.id,
          text: notes.text,
          content: notes.content,
          images: notes.images,
          meta: notes.meta,
        })
        .from(notes),
      this.db
        .select({
          id: pages.id,
          text: pages.text,
          content: pages.content,
          images: pages.images,
          meta: pages.meta,
        })
        .from(pages),
      this.db
        .select({
          id: drafts.id,
          text: drafts.text,
          content: drafts.content,
          images: drafts.images,
          meta: drafts.meta,
          typeSpecificData: drafts.typeSpecificData,
          history: drafts.history,
        })
        .from(drafts),
      this.db
        .select({
          id: draftHistories.id,
          text: draftHistories.text,
          content: draftHistories.content,
          typeSpecificData: draftHistories.typeSpecificData,
        })
        .from(draftHistories),
      this.db
        .select({
          id: snippets.id,
          type: snippets.type,
          raw: snippets.raw,
          comment: snippets.comment,
        })
        .from(snippets),
      this.db
        .select({
          id: topics.id,
          description: topics.description,
          introduce: topics.introduce,
          icon: topics.icon,
        })
        .from(topics),
      this.db
        .select({
          id: recentlies.id,
          content: recentlies.content,
          metadata: recentlies.metadata,
        })
        .from(recentlies),
      this.db
        .select({
          id: comments.id,
          text: comments.text,
          avatar: comments.avatar,
          meta: comments.meta,
          anchor: comments.anchor,
        })
        .from(comments)
        .where(eq(comments.isDeleted, false)),
      this.db
        .select({
          id: projects.id,
          images: projects.images,
          avatar: projects.avatar,
          text: projects.text,
          description: projects.description,
          previewUrl: projects.previewUrl,
          docUrl: projects.docUrl,
          projectUrl: projects.projectUrl,
        })
        .from(projects),
      this.db
        .select({
          id: links.id,
          url: links.url,
          avatar: links.avatar,
          description: links.description,
        })
        .from(links),
      this.db
        .select({ id: says.id, text: says.text, source: says.source })
        .from(says),
      this.db.select({ id: options.id, value: options.value }).from(options),
      this.db
        .select({
          id: metaPresets.id,
          description: metaPresets.description,
          fields: metaPresets.fields,
        })
        .from(metaPresets),
      this.db.select({ id: readers.id, image: readers.image }).from(readers),
      this.db
        .select({
          id: ownerProfiles.id,
          url: ownerProfiles.url,
          introduce: ownerProfiles.introduce,
          socialIds: ownerProfiles.socialIds,
        })
        .from(ownerProfiles),
      this.db
        .select({
          id: aiTranslations.id,
          text: aiTranslations.text,
          content: aiTranslations.content,
          sourceBlockSnapshots: aiTranslations.sourceBlockSnapshots,
        })
        .from(aiTranslations),
      this.db
        .select({ id: aiSummaries.id, summary: aiSummaries.summary })
        .from(aiSummaries),
      this.db
        .select({ id: aiInsights.id, content: aiInsights.content })
        .from(aiInsights),
      this.db
        .select({ id: aiTtsBlocks.id, url: aiTtsBlocks.url })
        .from(aiTtsBlocks),
      this.db
        .select({
          id: translationEntries.id,
          sourceText: translationEntries.sourceText,
          translatedText: translationEntries.translatedText,
        })
        .from(translationEntries),
      this.db
        .select({ id: serverlessStorages.id, value: serverlessStorages.value })
        .from(serverlessStorages),
    ])

    const sources: PersistedUsageSource[] = []
    const append = (
      sourceType: string,
      rows: Array<{ id: string } & Record<string, unknown>>,
    ) => {
      for (const { id, ...fields } of rows) {
        sources.push({ sourceType, sourceId: id, fields })
      }
    }

    append('post', postRows)
    append('note', noteRows)
    append('page', pageRows)
    append('draft', draftRows)
    append('draft_history', draftHistoryRows)
    for (const { id, type, ...fields } of snippetRows) {
      sources.push({
        sourceType: type === 'skill' ? 'skill' : 'snippet',
        sourceId: id,
        fields,
      })
    }
    append('topic', topicRows)
    append('recently', recentlyRows)
    append('comment', commentRows)
    append('project', projectRows)
    append('link', linkRows)
    append('say', sayRows)
    append('option', optionRows)
    append('meta_preset', metaPresetRows)
    append('reader', readerRows)
    append('owner_profile', ownerProfileRows)
    append('ai_translation', translationRows)
    append('ai_summary', summaryRows)
    append('ai_insight', insightRows)
    append('ai_tts', ttsBlockRows)
    append('translation_entry', translationEntryRows)
    append('serverless_storage', serverlessStorageRows)

    return findUsageMatchesInSources(uniqueUrls, sources)
  }
}
