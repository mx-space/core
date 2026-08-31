import {
  MX_MARKDOWN_CONVERTER_VERSION,
  type SerializedMxEditorState,
} from '@mx-space/editor'
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common'
import { and, eq } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  aiTranslations,
  contentDocuments,
  contentRevisions,
  drafts,
  notes,
  pages,
  posts,
} from '~/database/schema'
import type { ArticleContent } from '~/modules/ai/ai-translation/ai-translation.types'
import { buildSourceMetaHashes } from '~/modules/ai/ai-translation/translation-meta'
import { DraftRefType } from '~/modules/draft/draft.enum'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { acquireContentFormatTransitionLock } from '~/shared/content-format-transition-lock'
import { parseEntityId } from '~/shared/id/entity-id'
import { ContentFormat } from '~/shared/types/content-format.type'
import { computeContentHash } from '~/utils/content.util'

import type { MarkdownToLexicalMigrationDescriptor } from './content-migration.schema'
import type { MigrationMemberConversionResult } from './content-migration.types'
import {
  alignmentFor,
  alignRootBlockIds,
  analyzeMigrationMarkdown,
  existingLexicalResult,
  isFullyAligned,
  sha256,
} from './content-migration.utils'

type PostPatch = Partial<typeof posts.$inferInsert>
type NotePatch = Partial<typeof notes.$inferInsert>
type PagePatch = Partial<typeof pages.$inferInsert>

interface CommitCommon {
  refId: string
  descriptor: MarkdownToLexicalMigrationDescriptor
  branchId?: string
  source: Omit<ArticleContent, 'meta'> & {
    content: string
    contentFormat: ContentFormat.Lexical
    meta?: Record<string, unknown> | null
  }
}

export type MarkdownMigrationCommitInput = CommitCommon &
  (
    | { refType: DraftRefType.Post; patch: PostPatch }
    | { refType: DraftRefType.Note; patch: NotePatch }
    | { refType: DraftRefType.Page; patch: PagePatch }
  )

type PersistedSource = {
  id: string
  title: string | null
  text: string | null
  content: string | null
  contentFormat: string
  subtitle?: string | null
  summary?: string | null
  tags?: string[]
  meta: Record<string, unknown> | null
  modifiedAt: Date | null
  createdAt: Date
}

function sourceLanguage(
  source: { meta?: Record<string, unknown> | null },
  fallback = 'unknown',
): string {
  const lang = source.meta?.lang
  return typeof lang === 'string' && lang ? lang : fallback
}

function asArticleContent(
  source: PersistedSource,
  converted: {
    content: SerializedMxEditorState
    text: string
  },
): ArticleContent {
  return {
    title: source.title ?? '',
    text: converted.text,
    subtitle: source.subtitle,
    summary: source.summary,
    tags: source.tags,
    contentFormat: ContentFormat.Lexical,
    content: JSON.stringify(converted.content),
  }
}

@Injectable()
export class ContentMigrationCommitService {
  constructor(
    @Inject(PG_DB_TOKEN) private readonly db: AppDatabase,
    private readonly lexicalService: LexicalService,
  ) {}

  private validateDescriptor(
    input: MarkdownMigrationCommitInput,
  ): MigrationMemberConversionResult {
    const { descriptor } = input
    if (descriptor.converterVersion !== MX_MARKDOWN_CONVERTER_VERSION) {
      throw new ConflictException(
        'Markdown converter version changed; run the migration check again',
      )
    }

    const source = analyzeMigrationMarkdown(descriptor.sourceMarkdown, input)
    if (source.sourceHash !== descriptor.sourceHash) {
      throw new BadRequestException('Migration source hash does not match')
    }
    if (source.status === 'blocked') {
      throw new BadRequestException(
        'Migration source is no longer convertible with this profile',
      )
    }
    return source
  }

  private assertPreconditionShape(input: MarkdownMigrationCommitInput) {
    const counts = new Map<string, number>()
    for (const precondition of input.descriptor.preconditions) {
      const key = `${precondition.kind}:${precondition.id}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    if ([...counts.values()].some((count) => count !== 1)) {
      throw new BadRequestException(
        'Migration preconditions contain duplicate members',
      )
    }

    const sourcePreconditions = input.descriptor.preconditions.filter(
      (item) => item.kind === 'source',
    )
    if (
      sourcePreconditions.length !== 1 ||
      sourcePreconditions[0].id !== input.refId
    ) {
      throw new BadRequestException(
        'Migration must contain exactly one source precondition',
      )
    }

    const branchPreconditions = input.descriptor.preconditions.filter(
      (item) => item.kind === 'branch',
    )
    if (
      (input.branchId &&
        (branchPreconditions.length !== 1 ||
          branchPreconditions[0].id !== input.branchId)) ||
      (!input.branchId && branchPreconditions.length > 0)
    ) {
      throw new BadRequestException(
        'Migration branch precondition does not match the submitted branch',
      )
    }
  }

  private assertSubmittedLexicalPair(input: MarkdownMigrationCommitInput) {
    let parsed: SerializedMxEditorState
    try {
      parsed = JSON.parse(input.source.content) as SerializedMxEditorState
    } catch {
      throw new BadRequestException('Submitted Lexical content is invalid JSON')
    }
    if (!parsed?.root || !Array.isArray(parsed.root.children)) {
      throw new BadRequestException('Submitted Lexical content has no root')
    }
    if (
      this.lexicalService.lexicalToMarkdown(input.source.content) !==
      input.source.text
    ) {
      throw new BadRequestException(
        'Submitted Lexical content and Markdown projection do not match',
      )
    }
  }

  private async lockSource(
    tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0],
    input: MarkdownMigrationCommitInput,
  ): Promise<PersistedSource> {
    const id = parseEntityId(input.refId)
    switch (input.refType) {
      case DraftRefType.Post: {
        const [row] = await tx
          .select()
          .from(posts)
          .where(eq(posts.id, id))
          .limit(1)
          .for('update')
        if (!row)
          throw new ConflictException('Source document no longer exists')
        return row
      }
      case DraftRefType.Note: {
        const [row] = await tx
          .select()
          .from(notes)
          .where(eq(notes.id, id))
          .limit(1)
          .for('update')
        if (!row)
          throw new ConflictException('Source document no longer exists')
        return row as PersistedSource
      }
      case DraftRefType.Page: {
        const [row] = await tx
          .select()
          .from(pages)
          .where(eq(pages.id, id))
          .limit(1)
          .for('update')
        if (!row)
          throw new ConflictException('Source document no longer exists')
        return row
      }
    }
  }

  private async updateSource(
    tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0],
    input: MarkdownMigrationCommitInput,
    preserveModifiedAt: Date | null,
  ) {
    const id = parseEntityId(input.refId)
    switch (input.refType) {
      case DraftRefType.Post: {
        await tx
          .update(posts)
          .set({ ...input.patch, modifiedAt: preserveModifiedAt })
          .where(eq(posts.id, id))
        return
      }
      case DraftRefType.Note: {
        await tx
          .update(notes)
          .set({ ...input.patch, modifiedAt: preserveModifiedAt })
          .where(eq(notes.id, id))
        return
      }
      case DraftRefType.Page: {
        await tx
          .update(pages)
          .set({ ...input.patch, modifiedAt: preserveModifiedAt })
          .where(eq(pages.id, id))
      }
    }
  }

  async commitMarkdownToLexical(
    input: MarkdownMigrationCommitInput,
  ): Promise<void> {
    const baseline = this.validateDescriptor(input)
    this.assertPreconditionShape(input)
    this.assertSubmittedLexicalPair(input)
    if (baseline.status !== 'convertible') {
      throw new BadRequestException('Migration source is not convertible')
    }

    await this.db.transaction(async (tx) => {
      await acquireContentFormatTransitionLock(tx, input)
      const persisted = await this.lockSource(tx, input)
      if (persisted.contentFormat !== ContentFormat.Markdown) {
        throw new ConflictException('Source document is no longer Markdown')
      }

      const sourcePrecondition = input.descriptor.preconditions.find(
        (item) => item.kind === 'source',
      )!
      const persistedSource = analyzeMigrationMarkdown(
        persisted.text ?? '',
        input,
      )
      if (persistedSource.sourceHash !== sourcePrecondition.hash) {
        throw new ConflictException(
          'Published source changed after the migration check',
        )
      }

      const branchPrecondition = input.descriptor.preconditions.find(
        (item) => item.kind === 'branch',
      )
      if (input.branchId && branchPrecondition) {
        const [draft] = await tx
          .select({
            branch: drafts,
            document: contentDocuments,
            revision: contentRevisions,
          })
          .from(drafts)
          .innerJoin(
            contentDocuments,
            eq(contentDocuments.id, drafts.documentId),
          )
          .innerJoin(
            contentRevisions,
            eq(contentRevisions.id, drafts.headRevisionId),
          )
          .where(eq(drafts.id, parseEntityId(input.branchId)))
          .limit(1)
          .for('update')
        if (
          !draft ||
          draft.document.refType !== input.refType ||
          String(draft.document.refId) !== input.refId
        ) {
          throw new ConflictException(
            'Draft no longer belongs to the source document',
          )
        }
        const draftHash =
          draft.revision.contentFormat === ContentFormat.Lexical &&
          draft.revision.content
            ? sha256(draft.revision.content)
            : analyzeMigrationMarkdown(draft.revision.text, input).sourceHash
        if (
          draft.branch.headRevisionId !== branchPrecondition.headRevisionId ||
          draftHash !== branchPrecondition.hash
        ) {
          throw new ConflictException('Draft changed after the migration check')
        }
      }

      const translationRows = await tx
        .select()
        .from(aiTranslations)
        .where(
          and(
            eq(aiTranslations.refId, parseEntityId(input.refId)),
            eq(aiTranslations.refType, input.refType),
          ),
        )
        .for('update')
      const translationPreconditions = input.descriptor.preconditions.filter(
        (item) => item.kind === 'translation',
      )
      const expectedTranslationIds = new Set<string>(
        translationPreconditions.map((item) => String(item.id)),
      )
      if (
        translationRows.length !== expectedTranslationIds.size ||
        translationRows.some(
          (row) => !expectedTranslationIds.has(String(row.id)),
        )
      ) {
        throw new ConflictException(
          'Translation set changed after the migration check',
        )
      }

      const baselineArticle = asArticleContent(persisted, baseline)
      const baselineContent = baselineArticle.content!
      const sourceBlockSnapshots = this.lexicalService
        .extractRootBlocks(baselineContent)
        .map((block) => ({
          id: block.id ?? '',
          fingerprint: block.fingerprint,
          type: block.type,
          index: block.index,
        }))
      const sourceMetaHashes = buildSourceMetaHashes(baselineArticle)

      for (const translation of translationRows) {
        const precondition = translationPreconditions.find(
          (item) => item.id === String(translation.id),
        )!
        const result =
          translation.contentFormat === ContentFormat.Lexical
            ? existingLexicalResult(translation)
            : analyzeMigrationMarkdown(
                translation.text,
                input,
                baseline.sourceHash,
              )
        if (!result || result.sourceHash !== precondition.hash) {
          throw new ConflictException(
            `Translation ${translation.lang} changed after the migration check`,
          )
        }
        if (result.status === 'blocked') {
          throw new ConflictException(
            `Translation ${translation.lang} is no longer convertible`,
          )
        }
        const alignment = alignmentFor(baseline, result)
        if (!isFullyAligned(alignment)) {
          throw new ConflictException(
            `Translation ${translation.lang} no longer aligns with the source`,
          )
        }

        const content = alignRootBlockIds(baseline.content, result.content)
        const serializedContent = JSON.stringify(content)
        const sourceLang = sourceLanguage(persisted, translation.sourceLang)
        await tx
          .update(aiTranslations)
          .set({
            contentFormat: ContentFormat.Lexical,
            content: serializedContent,
            text: this.lexicalService.lexicalToMarkdown(serializedContent),
            hash: computeContentHash(baselineArticle, sourceLang),
            sourceModifiedAt: persisted.modifiedAt,
            sourceBlockSnapshots,
            sourceMetaHashes,
          })
          .where(eq(aiTranslations.id, translation.id))
      }

      const finalLang = sourceLanguage(input.source, sourceLanguage(persisted))
      const pureRepresentationMigration =
        baseline.sourceHash === persistedSource.sourceHash &&
        computeContentHash(baselineArticle, finalLang) ===
          computeContentHash(input.source, finalLang)
      const modifiedAt = pureRepresentationMigration
        ? persisted.modifiedAt
        : ((input.patch as { modifiedAt?: Date | null }).modifiedAt ??
          new Date())

      await this.updateSource(tx, input, modifiedAt)
    })
  }
}
