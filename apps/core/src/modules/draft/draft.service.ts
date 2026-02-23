import { Injectable } from '@nestjs/common'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { FileReferenceType } from '~/modules/file/file-reference.model'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { InjectModel } from '~/transformers/model.transformer'
import { dbTransforms } from '~/utils/db-transform.util'
import { Types } from 'mongoose'
import { DraftHistoryService } from './draft-history.service'
import { DraftHistoryModel, DraftModel, DraftRefType } from './draft.model'
import type { CreateDraftDto, UpdateDraftDto } from './draft.schema'

@Injectable()
export class DraftService {
  constructor(
    @InjectModel(DraftModel)
    private readonly draftModel: MongooseModel<DraftModel>,
    private readonly fileReferenceService: FileReferenceService,
    private readonly draftHistoryService: DraftHistoryService,
  ) {}

  get model() {
    return this.draftModel
  }

  async create(dto: CreateDraftDto): Promise<DraftModel> {
    if (dto.refId) {
      const existing = await this.draftModel.findOne({
        refType: dto.refType,
        refId: Types.ObjectId.createFromHexString(dto.refId),
      })
      if (existing) {
        return this.update(existing.id, dto)
      }
    }

    const draft = await this.draftModel.create({
      ...dto,
      refId: dto.refId
        ? Types.ObjectId.createFromHexString(dto.refId)
        : undefined,
      typeSpecificData: dto.typeSpecificData
        ? JSON.stringify(dto.typeSpecificData)
        : undefined,
      meta: dto.meta
        ? (dbTransforms.json(dto.meta) as unknown as DraftModel['meta'])
        : undefined,
      version: 1,
      history: [],
    })

    if (draft.text) {
      await this.fileReferenceService.updateReferencesForDocument(
        draft.text,
        draft.id,
        FileReferenceType.Draft,
      )
    }

    return draft.toObject()
  }

  async update(id: string, dto: UpdateDraftDto): Promise<DraftModel> {
    const draft = await this.draftModel.findById(id)
    if (!draft) {
      throw new BizException(ErrorCodeEnum.DraftNotFound)
    }

    const hasContentChange = this.draftHistoryService.hasContentChange(
      {
        title: draft.title,
        text: draft.text,
        content: draft.content,
        contentFormat: draft.contentFormat,
        typeSpecificData: draft.typeSpecificData,
      },
      dto,
    )

    if (hasContentChange && (draft.title || draft.text || draft.content)) {
      const { history } = this.draftHistoryService.pushHistoryEntry(
        {
          version: draft.version,
          title: draft.title,
          text: draft.text,
          contentFormat: draft.contentFormat,
          content: draft.content,
          typeSpecificData: draft.typeSpecificData,
          savedAt: draft.updated || draft.created || new Date(),
        },
        draft.history,
      )
      draft.history = history
    }

    if (dto.title !== undefined) draft.title = dto.title
    if (dto.text !== undefined) draft.text = dto.text
    if (dto.content !== undefined) draft.content = dto.content
    if (dto.contentFormat !== undefined) draft.contentFormat = dto.contentFormat
    if (dto.images !== undefined) draft.images = dto.images
    if (dto.meta !== undefined) draft.meta = dbTransforms.json(dto.meta) as any
    if (dto.typeSpecificData !== undefined) {
      draft.typeSpecificData = JSON.stringify(dto.typeSpecificData)
    }

    if (hasContentChange) {
      draft.version = draft.version + 1
    }

    await draft.save()

    if (dto.text !== undefined) {
      await this.fileReferenceService.updateReferencesForDocument(
        draft.text,
        draft.id,
        FileReferenceType.Draft,
      )
    }

    return draft.toObject()
  }

  async findById(id: string): Promise<DraftModel | null> {
    const draft = await this.draftModel.findById(id).lean({ getters: true })
    if (!draft) return null

    return this.transformDraft(draft)
  }

  async findByRef(
    refType: DraftRefType,
    refId: string,
  ): Promise<DraftModel | null> {
    const draft = await this.draftModel
      .findOne({
        refType,
        refId: Types.ObjectId.createFromHexString(refId),
      })
      .lean({ getters: true })

    if (!draft) return null

    if (
      draft.publishedVersion !== undefined &&
      draft.publishedVersion === draft.version
    ) {
      return null
    }

    return this.transformDraft(draft)
  }

  async findNewDrafts(refType: DraftRefType): Promise<DraftModel[]> {
    const drafts = await this.draftModel
      .find({
        refType,
        refId: { $exists: false },
      })
      .sort({ updated: -1 })
      .lean({ getters: true })

    return drafts.map((d) => this.transformDraft(d))
  }

  async delete(id: string): Promise<void> {
    const result = await this.draftModel.deleteOne({ _id: id })
    if (result.deletedCount === 0) {
      throw new BizException(ErrorCodeEnum.DraftNotFound)
    }

    await this.fileReferenceService.removeReferencesForDocument(
      id,
      FileReferenceType.Draft,
    )
  }

  async deleteByRef(refType: DraftRefType, refId: string): Promise<void> {
    const refObjectId = Types.ObjectId.createFromHexString(refId)
    const drafts = await this.draftModel
      .find({ refType, refId: refObjectId })
      .select('_id')
      .lean()
    if (drafts.length === 0) return

    await this.draftModel.deleteMany({ refType, refId: refObjectId })
    await Promise.all(
      drafts.map((draft) =>
        this.fileReferenceService.removeReferencesForDocument(
          draft._id.toString(),
          FileReferenceType.Draft,
        ),
      ),
    )
  }

  async getHistory(id: string): Promise<
    Array<{
      version: number
      title: string
      savedAt: Date
      isFullSnapshot: boolean
    }>
  > {
    const draft = await this.draftModel.findById(id).lean()
    if (!draft) {
      throw new BizException(ErrorCodeEnum.DraftNotFound)
    }

    return this.draftHistoryService.getHistorySummary(draft.history)
  }

  async getHistoryVersion(
    id: string,
    version: number,
  ): Promise<DraftHistoryModel> {
    const draft = await this.draftModel.findById(id).lean()
    if (!draft) {
      throw new BizException(ErrorCodeEnum.DraftNotFound)
    }

    const historyEntry = draft.history.find((h) => h.version === version)
    if (!historyEntry) {
      throw new BizException(ErrorCodeEnum.DraftHistoryNotFound)
    }

    return this.draftHistoryService.resolveHistoryEntry(
      historyEntry,
      draft.history,
      draft.text ?? '',
      draft.content,
    )
  }

  async restoreVersion(id: string, version: number): Promise<DraftModel> {
    const draft = await this.draftModel.findById(id)
    if (!draft) {
      throw new BizException(ErrorCodeEnum.DraftNotFound)
    }

    const historyEntry = draft.history.find((h) => h.version === version)
    if (!historyEntry) {
      throw new BizException(ErrorCodeEnum.DraftHistoryNotFound)
    }

    const { history } = this.draftHistoryService.pushHistoryEntry(
      {
        version: draft.version,
        title: draft.title,
        text: draft.text,
        contentFormat: draft.contentFormat,
        content: draft.content,
        typeSpecificData: draft.typeSpecificData,
        savedAt: draft.updated || new Date(),
      },
      draft.history,
    )
    draft.history = history

    const resolved = this.draftHistoryService.resolveHistoryEntry(
      historyEntry,
      draft.history,
      draft.text ?? '',
      draft.content,
    )

    draft.title = resolved.title
    draft.text = resolved.text ?? ''
    if (resolved.content !== undefined) draft.content = resolved.content
    if (resolved.contentFormat) draft.contentFormat = resolved.contentFormat
    draft.typeSpecificData = resolved.typeSpecificData
    draft.version = draft.version + 1

    await draft.save()
    return draft.toObject()
  }

  async linkToPublished(draftId: string, publishedId: string): Promise<void> {
    await this.draftModel.findByIdAndUpdate(draftId, {
      refId: Types.ObjectId.createFromHexString(publishedId),
    })
  }

  async markAsPublished(draftId: string): Promise<void> {
    const draft = await this.draftModel.findById(draftId)
    if (!draft) return

    draft.publishedVersion = draft.version
    await draft.save()
  }

  private transformDraft(draft: DraftModel): DraftModel {
    if (draft.typeSpecificData && typeof draft.typeSpecificData === 'string') {
      try {
        ;(draft as any).typeSpecificData = JSON.parse(draft.typeSpecificData)
      } catch {
        // keep as is
      }
    }
    return draft
  }
}
