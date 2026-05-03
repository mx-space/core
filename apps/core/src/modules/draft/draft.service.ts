import { Injectable } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { FileReferenceType } from '~/modules/file/file-reference.enum'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { ContentFormat } from '~/shared/types/content-format.type'

import { DraftRefType } from './draft.enum'
import { DraftRepository, type DraftRow } from './draft.repository'
import type { CreateDraftDto, UpdateDraftDto } from './draft.schema'
import type { DraftHistoryModel } from './draft.types'
import { DraftHistoryService } from './draft-history.service'

@Injectable()
export class DraftService {
  constructor(
    private readonly draftRepository: DraftRepository,
    private readonly fileReferenceService: FileReferenceService,
    private readonly draftHistoryService: DraftHistoryService,
  ) {}

  get repository() {
    return this.draftRepository
  }

  async list(page: number, size: number, filter: any = {}) {
    return this.draftRepository.list(page, size, filter)
  }

  async count(filter: any = {}) {
    return this.draftRepository.count(filter)
  }

  async create(dto: CreateDraftDto): Promise<DraftRow> {
    if (dto.refId) {
      const existing = await this.draftRepository.findByRef(
        dto.refType as DraftRefType,
        dto.refId,
      )
      if (existing) return this.update(existing.id, dto)
    }

    const draft = await this.draftRepository.create({
      ...dto,
      refType: dto.refType as DraftRefType,
      contentFormat: dto.contentFormat ?? ContentFormat.Markdown,
      typeSpecificData: dto.typeSpecificData,
      meta: dto.meta,
    })

    if (draft.text) {
      await this.fileReferenceService.updateReferencesForDocument(
        draft,
        draft.id,
        FileReferenceType.Draft,
      )
    }

    return draft
  }

  async update(id: string, dto: UpdateDraftDto): Promise<DraftRow> {
    const draft = await this.draftRepository.findById(id)
    if (!draft) throw new BizException(ErrorCodeEnum.DraftNotFound)

    const hasContentChange = this.draftHistoryService.hasContentChange(
      {
        title: draft.title,
        text: draft.text,
        content: draft.content ?? undefined,
        contentFormat: draft.contentFormat as ContentFormat,
        typeSpecificData: JSON.stringify(draft.typeSpecificData ?? undefined),
      },
      dto,
    )

    let history = draft.history
    if (hasContentChange && (draft.title || draft.text || draft.content)) {
      history = this.draftHistoryService.pushHistoryEntry(
        {
          version: draft.version,
          title: draft.title,
          text: draft.text,
          contentFormat: draft.contentFormat as ContentFormat,
          content: draft.content ?? undefined,
          typeSpecificData: JSON.stringify(draft.typeSpecificData ?? undefined),
          savedAt: draft.updatedAt || draft.createdAt || new Date(),
        },
        draft.history as any,
      ).history as any
    }

    const updated = await this.draftRepository.update(id, {
      ...dto,
      contentFormat: dto.contentFormat,
      typeSpecificData: dto.typeSpecificData,
      meta: dto.meta,
      version: hasContentChange ? draft.version + 1 : draft.version,
      history,
    })
    if (!updated) throw new BizException(ErrorCodeEnum.DraftNotFound)

    if (dto.text !== undefined) {
      await this.fileReferenceService.updateReferencesForDocument(
        updated,
        updated.id,
        FileReferenceType.Draft,
      )
    }

    return updated
  }

  async findById(id: string): Promise<DraftRow | null> {
    return this.draftRepository.findById(id)
  }

  async findByRef(
    refType: DraftRefType,
    refId: string,
  ): Promise<DraftRow | null> {
    const draft = await this.draftRepository.findByRef(refType, refId)
    if (!draft) return null
    if (
      draft.publishedVersion !== undefined &&
      draft.publishedVersion === draft.version
    ) {
      return null
    }
    return draft
  }

  async findNewDrafts(refType: DraftRefType): Promise<DraftRow[]> {
    const result = await this.draftRepository.list(1, 50, {
      refType,
      hasRef: false,
    })
    return result.data
  }

  async delete(id: string): Promise<void> {
    const result = await this.draftRepository.deleteById(id)
    if (!result) throw new BizException(ErrorCodeEnum.DraftNotFound)
    await this.fileReferenceService.removeReferencesForDocument(
      id,
      FileReferenceType.Draft,
    )
  }

  async deleteByRef(refType: DraftRefType, refId: string): Promise<void> {
    const draft = await this.draftRepository.findByRef(refType, refId)
    if (!draft) return
    await this.draftRepository.deleteById(draft.id)
    await this.fileReferenceService.removeReferencesForDocument(
      draft.id,
      FileReferenceType.Draft,
    )
  }

  async getHistory(id: string) {
    const draft = await this.draftRepository.findById(id)
    if (!draft) throw new BizException(ErrorCodeEnum.DraftNotFound)
    return this.draftHistoryService.getHistorySummary(draft.history as any)
  }

  async getHistoryVersion(
    id: string,
    version: number,
  ): Promise<DraftHistoryModel> {
    const draft = await this.draftRepository.findById(id)
    if (!draft) throw new BizException(ErrorCodeEnum.DraftNotFound)
    const historyEntry = draft.history.find((h) => h.version === version)
    if (!historyEntry)
      throw new BizException(ErrorCodeEnum.DraftHistoryNotFound)
    return this.draftHistoryService.resolveHistoryEntry(
      historyEntry as any,
      draft.history as any,
      draft.text ?? '',
      draft.content ?? undefined,
    )
  }

  async restoreVersion(id: string, version: number): Promise<DraftRow> {
    const draft = await this.draftRepository.findById(id)
    if (!draft) throw new BizException(ErrorCodeEnum.DraftNotFound)
    const historyEntry = draft.history.find((h) => h.version === version)
    if (!historyEntry)
      throw new BizException(ErrorCodeEnum.DraftHistoryNotFound)
    const resolved = this.draftHistoryService.resolveHistoryEntry(
      historyEntry as any,
      draft.history as any,
      draft.text ?? '',
      draft.content ?? undefined,
    )
    return this.update(id, {
      title: resolved.title,
      text: resolved.text ?? '',
      content: resolved.content,
      contentFormat: resolved.contentFormat as ContentFormat,
      typeSpecificData: resolved.typeSpecificData
        ? JSON.safeParse(resolved.typeSpecificData)
        : undefined,
    } as UpdateDraftDto)
  }

  async linkToPublished(draftId: string, publishedId: string): Promise<void> {
    const draft = await this.draftRepository.findById(draftId)
    if (!draft) return
    await this.draftRepository.linkToPublished(
      draftId,
      publishedId,
      draft.refType,
    )
  }

  async markAsPublished(draftId: string): Promise<void> {
    const draft = await this.draftRepository.findById(draftId)
    if (!draft) return
    await this.draftRepository.update(draftId, {
      publishedVersion: draft.version,
    })
  }
}
