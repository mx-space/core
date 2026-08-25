import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common'
import { isNotNil } from 'es-toolkit'
import { omit } from 'es-toolkit/compat'
import slugify from 'slugify'

import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import type { MarkdownToLexicalMigrationDescriptor } from '~/modules/content-migration/content-migration.schema'
import { ContentMigrationCommitService } from '~/modules/content-migration/content-migration-commit.service'
import { FileReferenceType } from '~/modules/file/file-reference.enum'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { isLexical } from '~/utils/content.util'
import { scheduleManager } from '~/utils/schedule.util'

import { DraftRefType } from '../draft/draft.enum'
import { DraftService } from '../draft/draft.service'
import { EnrichmentService } from '../enrichment/enrichment.service'
import { PageRepository } from './page.repository'
import { PAGE_PROTECTED_KEYS, type PageModel } from './page.types'

@Injectable()
export class PageService {
  constructor(
    private readonly pageRepository: PageRepository,
    private readonly imageService: ImageService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly eventManager: EventManagerService,
    private readonly lexicalService: LexicalService,
    private readonly contentMigrationCommitService: ContentMigrationCommitService,
    private readonly enrichmentService: EnrichmentService,
    @Inject(forwardRef(() => DraftService))
    private readonly draftService: DraftService,
  ) {}

  public get repository() {
    return this.pageRepository
  }

  private normalizeMeta(meta: unknown) {
    if (meta === undefined) return undefined
    if (meta === null) return null
    return meta as Record<string, unknown>
  }

  async list(page = 1, size = 10) {
    return this.pageRepository.list(page, size)
  }

  async listPaginated(page = 1, size = 10) {
    return this.pageRepository.list(page, size)
  }

  async findAll() {
    return this.pageRepository.findAll()
  }

  async findRecent(size: number) {
    return this.pageRepository.findRecent(size)
  }

  async findById(id: string) {
    return this.pageRepository.findById(id)
  }

  async findBySlug(slug: string) {
    return this.pageRepository.findBySlug(slug)
  }

  async findManyByIds(ids: string[]) {
    return this.pageRepository.findManyByIds(ids)
  }

  public async create(doc: PageModel & { draftId?: string }) {
    this.lexicalService.normalizeContentForStorage(doc)

    const { draftId } = doc
    const count = await this.pageRepository.count()
    if (count >= 10) {
      throw createAppException(AppErrorCode.MAX_COUNT_LIMIT)
    }
    if (!doc.order) {
      doc.order = count + 1
    }
    const res = await this.pageRepository.create({
      title: doc.title,
      slug: slugify(doc.slug),
      subtitle: doc.subtitle,
      text: doc.text,
      content: doc.content,
      contentFormat: doc.contentFormat ?? ContentFormat.Markdown,
      images: doc.images as unknown[],
      meta: this.normalizeMeta(doc.meta) as Record<string, unknown> | null,
      order: doc.order,
    })

    if (draftId) {
      await this.fileReferenceService.removeReferencesForDocument(
        draftId,
        FileReferenceType.Draft,
      )
      await this.draftService.linkToPublished(draftId, res.id)
      await this.draftService.markAsPublished(draftId)
    }

    scheduleManager.schedule(async () => {
      await this.fileReferenceService.activateReferences(
        res,
        res.id,
        FileReferenceType.Page,
      )

      if (!isLexical(res)) {
        this.imageService.saveImageDimensionsFromMarkdownText(
          res.text,
          res.images,
          async (images) => {
            await this.pageRepository.setImages(res.id, images)
            this.eventManager.broadcast(BusinessEvents.PAGE_UPDATE, res, {
              scope: EventScope.TO_SYSTEM,
            })
          },
        )
      }
    })

    this.eventManager.emit(
      BusinessEvents.PAGE_CREATE,
      { id: res.id },
      { scope: EventScope.TO_SYSTEM_VISITOR },
    )

    this.enrichmentService.scheduleDocPrefetch(res)

    return res
  }

  public async updateById(
    id: string,
    doc: Partial<PageModel> & {
      draftId?: string
      migration?: MarkdownToLexicalMigrationDescriptor
    },
  ) {
    this.lexicalService.normalizeContentForStorage(doc)

    const { draftId, migration } = doc

    const oldDoc = await this.findById(id)
    if (!oldDoc) {
      throw createAppException(AppErrorCode.NO_CONTENT_MODIFIABLE)
    }

    const isMarkdownToLexical =
      oldDoc.contentFormat === ContentFormat.Markdown &&
      doc.contentFormat === ContentFormat.Lexical
    if (
      oldDoc.contentFormat === ContentFormat.Lexical &&
      doc.contentFormat === ContentFormat.Markdown
    ) {
      throw new BadRequestException(
        'Published Lexical content cannot be downgraded to Markdown',
      )
    }
    if (isMarkdownToLexical && !migration) {
      throw new BadRequestException(
        'Markdown-to-Lexical writes require a migration descriptor',
      )
    }
    if (migration && !isMarkdownToLexical) {
      throw new BadRequestException(
        'Migration descriptor is only valid for Markdown-to-Lexical writes',
      )
    }

    if (['text', 'title', 'subtitle'].some((key) => isNotNil(doc[key]))) {
      doc.modifiedAt = new Date()
    }
    if (doc.slug) {
      doc.slug = slugify(doc.slug)
    }

    const patch = omit(doc, PAGE_PROTECTED_KEYS as any) as Partial<PageModel>
    const repositoryPatch = {
      title: patch.title,
      slug: patch.slug,
      subtitle: patch.subtitle,
      text: patch.text,
      content: patch.content,
      contentFormat: patch.contentFormat,
      images: patch.images as unknown[] | undefined,
      meta:
        patch.meta !== undefined
          ? (this.normalizeMeta(patch.meta) as Record<string, unknown> | null)
          : undefined,
      order: patch.order,
    }
    let newDoc
    if (migration) {
      if (!doc.content || doc.text === undefined) {
        throw new BadRequestException(
          'Lexical migration requires content and text',
        )
      }
      await this.contentMigrationCommitService.commitMarkdownToLexical({
        refType: DraftRefType.Page,
        refId: id,
        descriptor: migration,
        draftId,
        patch: repositoryPatch,
        source: {
          title: repositoryPatch.title ?? oldDoc.title,
          subtitle:
            repositoryPatch.subtitle === undefined
              ? oldDoc.subtitle
              : repositoryPatch.subtitle,
          text: doc.text,
          content: doc.content,
          contentFormat: ContentFormat.Lexical,
          meta:
            repositoryPatch.meta === undefined
              ? oldDoc.meta
              : repositoryPatch.meta,
        },
      })
      newDoc = await this.pageRepository.findById(id)
    } else {
      newDoc = await this.pageRepository.update(id, repositoryPatch)
    }

    if (!newDoc) {
      throw createAppException(AppErrorCode.NO_CONTENT_MODIFIABLE)
    }

    if (draftId && !migration) {
      await this.draftService.markAsPublished(draftId)
    }

    scheduleManager.schedule(async () => {
      await this.fileReferenceService.updateReferencesForDocument(
        newDoc,
        newDoc.id,
        FileReferenceType.Page,
      )

      await Promise.all([
        !isLexical(newDoc) &&
          this.imageService.saveImageDimensionsFromMarkdownText(
            newDoc.text,
            newDoc.images,
            async (images) => {
              await this.pageRepository.setImages(id, images)
            },
          ),
        this.eventManager.emit(
          BusinessEvents.PAGE_UPDATE,
          { id: newDoc.id },
          { scope: EventScope.TO_SYSTEM_VISITOR },
        ),
      ])
    })

    this.enrichmentService.scheduleDocPrefetch(newDoc)
  }

  async updateOrder(id: string, order: number) {
    return this.pageRepository.updateOrder(id, order)
  }

  async deleteById(id: string) {
    await Promise.all([
      this.pageRepository.deleteById(id),
      this.draftService.deleteByRef(DraftRefType.Page, id),
      this.fileReferenceService.removeReferencesForDocument(
        id,
        FileReferenceType.Page,
      ),
    ])
    this.eventManager.emit(
      BusinessEvents.PAGE_DELETE,
      { id },
      { scope: EventScope.TO_SYSTEM_VISITOR },
    )
  }
}
