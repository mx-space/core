import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { omit } from 'es-toolkit/compat'
import slugify from 'slugify'

import { BizException } from '~/common/exceptions/biz.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { FileReferenceType } from '~/modules/file/file-reference.enum'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { isLexical } from '~/utils/content.util'
import { scheduleManager } from '~/utils/schedule.util'
import { isDefined } from '~/utils/validator.util'

import { DraftRefType } from '../draft/draft.enum'
import { DraftService } from '../draft/draft.service'
import { PageRepository, type PageRow } from './page.repository'
import { PAGE_PROTECTED_KEYS, type PageModel } from './page.types'

@Injectable()
export class PageService {
  constructor(
    private readonly pageRepository: PageRepository,
    private readonly imageService: ImageService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly eventManager: EventManagerService,
    private readonly lexicalService: LexicalService,
    @Inject(forwardRef(() => DraftService))
    private readonly draftService: DraftService,
  ) {}

  public get repository() {
    return this.pageRepository
  }

  private normalizeMeta(meta: unknown) {
    if (meta === undefined) return undefined
    if (meta === null) return null
    if (typeof meta === 'string') return JSON.safeParse(meta) ?? null
    return meta as Record<string, unknown>
  }

  toLegacy(row: PageRow | null): any {
    if (!row) return null
    return {
      ...row,
      _id: row.id,
      created: row.createdAt,
      modified: row.modifiedAt,
      commentsIndex: 0,
      allowComment: true,
    }
  }

  toLegacyMany(rows: PageRow[]) {
    return rows.map((row) => this.toLegacy(row))
  }

  toPaginate(result: Awaited<ReturnType<PageRepository['list']>>) {
    return {
      docs: this.toLegacyMany(result.data),
      totalDocs: result.pagination.total,
      page: result.pagination.currentPage,
      totalPages: result.pagination.totalPage,
      limit: result.pagination.size,
      hasNextPage: result.pagination.hasNextPage,
      hasPrevPage: result.pagination.hasPrevPage,
    }
  }

  async list(page = 1, size = 10) {
    return this.pageRepository.list(page, size)
  }

  async listPaginated(page = 1, size = 10) {
    return this.toPaginate(await this.pageRepository.list(page, size))
  }

  async findAll() {
    return this.toLegacyMany(await this.pageRepository.findAll())
  }

  async findRecent(size: number) {
    return this.toLegacyMany(await this.pageRepository.findRecent(size))
  }

  async findById(id: string) {
    return this.toLegacy(await this.pageRepository.findById(id))
  }

  async findBySlug(slug: string) {
    return this.toLegacy(await this.pageRepository.findBySlug(slug))
  }

  async findManyByIds(ids: string[]) {
    return this.toLegacyMany(await this.pageRepository.findManyByIds(ids))
  }

  public async create(doc: PageModel & { draftId?: string }) {
    this.lexicalService.populateText(doc as any)

    const { draftId } = doc
    const count = await this.pageRepository.count()
    if (count >= 10) {
      throw new BizException(ErrorCodeEnum.MaxCountLimit)
    }
    if (!doc.order) {
      doc.order = count + 1
    }
    const res = this.toLegacy(
      await this.pageRepository.create({
        title: doc.title,
        slug: slugify(doc.slug),
        subtitle: doc.subtitle,
        text: doc.text,
        content: doc.content,
        contentFormat: doc.contentFormat ?? ContentFormat.Markdown,
        images: doc.images as unknown[],
        meta: this.normalizeMeta(doc.meta) as Record<string, unknown> | null,
        order: doc.order,
      }),
    )

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

    return res
  }

  public async updateById(
    id: string,
    doc: Partial<PageModel> & { draftId?: string },
  ) {
    this.lexicalService.populateText(doc as any)

    const { draftId } = doc

    if (['text', 'title', 'subtitle'].some((key) => isDefined(doc[key]))) {
      doc.modified = new Date()
    }
    if (doc.slug) {
      doc.slug = slugify(doc.slug)
    }

    const patch = omit(doc, PAGE_PROTECTED_KEYS as any) as Partial<PageModel>
    const newDoc = this.toLegacy(
      await this.pageRepository.update(id, {
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
      }),
    )

    if (!newDoc) {
      throw new NoContentCanBeModifiedException()
    }

    if (draftId) {
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
