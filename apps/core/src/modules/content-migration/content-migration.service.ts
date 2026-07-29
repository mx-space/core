import {
  analyzeMxMarkdown,
  type MarkdownConversionResult,
  MX_MARKDOWN_CONVERTER_VERSION,
} from '@mx-space/editor'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { AiTranslationRepository } from '~/modules/ai/ai-translation/ai-translation.repository'
import type { AiTranslationRow } from '~/modules/ai/ai-translation/ai-translation.types'
import { DraftRefType } from '~/modules/draft/draft.enum'
import { DraftService } from '~/modules/draft/draft.service'
import { NoteService } from '~/modules/note/note.service'
import { PageService } from '~/modules/page/page.service'
import { PostService } from '~/modules/post/post.service'
import { ContentFormat } from '~/shared/types/content-format.type'

import type { MarkdownToLexicalDryRunDto } from './content-migration.schema'
import type {
  MarkdownMigrationDryRunResponse,
  MigrationIssue,
  MigrationMemberConversionResult,
  MigrationMemberPrecondition,
} from './content-migration.types'
import {
  alignmentFor,
  analyzeMigrationMarkdown,
  existingLexicalResult,
  invalidExistingLexicalResult,
  isFullyAligned,
  memberIssues,
  sha256,
  wholeSourceRange,
} from './content-migration.utils'

type ContentDocument = {
  id: string
  text: string
  content?: string | null
  contentFormat?: string | null
  modifiedAt?: Date | null
  createdAt?: Date | null
}

@Injectable()
export class ContentMigrationService {
  constructor(
    private readonly postService: PostService,
    private readonly noteService: NoteService,
    private readonly pageService: PageService,
    private readonly draftService: DraftService,
    private readonly aiTranslationRepository: AiTranslationRepository,
  ) {}

  private async findDocument(
    refType: DraftRefType,
    refId: string,
  ): Promise<ContentDocument | null> {
    switch (refType) {
      case DraftRefType.Post: {
        return this.postService.findById(
          refId,
        ) as Promise<ContentDocument | null>
      }
      case DraftRefType.Note: {
        return this.noteService.findById(
          refId,
        ) as Promise<ContentDocument | null>
      }
      case DraftRefType.Page: {
        return this.pageService.findById(
          refId,
        ) as Promise<ContentDocument | null>
      }
    }
  }

  private analyzeSource(
    sourceText: string,
    input: { refType: DraftRefType; refId: string },
    baselineSourceHash?: string,
  ): MarkdownConversionResult {
    return analyzeMigrationMarkdown(sourceText, input, baselineSourceHash)
  }

  private alignmentIssue(input: {
    translation: AiTranslationRow
    sourceBlockCount: number
    translationBlockCount: number
    alignedBlockCount: number
  }): MigrationIssue {
    return {
      code: 'translation-structure-mismatch',
      feature: 'translation-alignment',
      message:
        'The translation root block structure does not align with the source document.',
      range: wholeSourceRange(input.translation.text),
      severity: 'blocking',
      member: 'translation',
      memberId: String(input.translation.id),
      lang: input.translation.lang,
      details: {
        sourceBlockCount: input.sourceBlockCount,
        translationBlockCount: input.translationBlockCount,
        alignedBlockCount: input.alignedBlockCount,
      },
    }
  }

  async dryRunMarkdownToLexical(
    dto: MarkdownToLexicalDryRunDto,
  ): Promise<MarkdownMigrationDryRunResponse> {
    const document = await this.findDocument(dto.refType, dto.refId)
    if (!document) throw new NotFoundException('Content document not found')
    if (
      (document.contentFormat ?? ContentFormat.Markdown) !==
      ContentFormat.Markdown
    ) {
      throw new BadRequestException('Source document is not Markdown')
    }

    const [draft, translationRows] = await Promise.all([
      dto.draftId ? this.draftService.findById(dto.draftId) : null,
      this.aiTranslationRepository.listByRefId(dto.refId),
    ])
    if (dto.draftId && !draft) {
      throw new NotFoundException('Draft not found')
    }
    if (
      draft &&
      (draft.refType !== dto.refType || String(draft.refId) !== dto.refId)
    ) {
      throw new BadRequestException('Draft does not belong to this document')
    }

    const translations = translationRows.filter(
      (translation) => translation.refType === dto.refType,
    )
    const source = this.analyzeSource(dto.sourceText, dto)
    const issues: MigrationIssue[] = memberIssues(source, 'source', dto.refId)
    const preconditions: MigrationMemberPrecondition[] = []

    const persistedSource = analyzeMxMarkdown(document.text ?? '', {
      profile: 'yohaku-v1',
    })
    preconditions.push({
      kind: 'source',
      id: dto.refId,
      hash: persistedSource.sourceHash,
    })

    if (draft) {
      const draftResult = analyzeMxMarkdown(draft.text ?? '', {
        profile: 'yohaku-v1',
      })
      preconditions.push({
        kind: 'draft',
        id: String(draft.id),
        hash:
          draft.contentFormat === ContentFormat.Lexical && draft.content
            ? sha256(draft.content)
            : draftResult.sourceHash,
        version: draft.version,
      })
    }

    const convertedTranslations: MarkdownMigrationDryRunResponse['translations'] =
      []

    for (const translation of translations) {
      let result: MigrationMemberConversionResult
      if (translation.contentFormat === ContentFormat.Lexical) {
        result =
          existingLexicalResult(translation) ??
          invalidExistingLexicalResult(translation)
      } else {
        result = this.analyzeSource(translation.text, dto, source.sourceHash)
      }

      if (result.status === 'blocked') {
        issues.push(
          ...memberIssues(
            result,
            'translation',
            String(translation.id),
            translation.lang,
          ),
        )
      }

      const alignment = alignmentFor(source, result)
      if (
        source.status === 'convertible' &&
        result.status !== 'blocked' &&
        !isFullyAligned(alignment)
      ) {
        issues.push(
          this.alignmentIssue({
            translation,
            ...alignment,
          }),
        )
      }

      preconditions.push({
        kind: 'translation',
        id: String(translation.id),
        hash: result.sourceHash,
      })
      convertedTranslations.push({
        id: String(translation.id),
        lang: translation.lang,
        result,
        alignment,
      })
    }

    return {
      status: issues.length > 0 ? 'blocked' : 'convertible',
      profile: 'yohaku-v1',
      converterVersion: MX_MARKDOWN_CONVERTER_VERSION,
      sourceHash: source.sourceHash,
      preconditions,
      source,
      translations: convertedTranslations,
      issues,
    }
  }
}
