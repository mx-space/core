import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '~/transformers/model.transformer'
import { dbTransforms } from '~/utils/db-transform.util'
import { Types } from 'mongoose'
import { DraftHistoryModel, DraftModel, DraftRefType } from './draft.model'
import type { CreateDraftDto, UpdateDraftDto } from './draft.schema'

@Injectable()
export class DraftService {
  private readonly MAX_HISTORY_VERSIONS = 10

  constructor(
    @InjectModel(DraftModel)
    private readonly draftModel: MongooseModel<DraftModel>,
  ) {}

  get model() {
    return this.draftModel
  }

  async create(dto: CreateDraftDto): Promise<DraftModel> {
    // 如果是编辑已有内容的草稿，检查是否已存在
    if (dto.refId) {
      const existing = await this.draftModel.findOne({
        refType: dto.refType,
        refId: Types.ObjectId.createFromHexString(dto.refId),
      })
      if (existing) {
        // 更新现有草稿而不是创建新的
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

    return draft.toObject()
  }

  async update(id: string, dto: UpdateDraftDto): Promise<DraftModel> {
    const draft = await this.draftModel.findById(id)
    if (!draft) {
      throw new NotFoundException('草稿不存在')
    }

    // 只有内容有实际变化时才保存到历史
    const hasContentChange =
      (dto.title !== undefined && dto.title !== draft.title) ||
      (dto.text !== undefined && dto.text !== draft.text) ||
      (dto.typeSpecificData !== undefined &&
        JSON.stringify(dto.typeSpecificData) !== draft.typeSpecificData)

    if (hasContentChange && (draft.title || draft.text)) {
      // 保存当前版本到历史
      const historyEntry: DraftHistoryModel = {
        version: draft.version,
        title: draft.title,
        text: draft.text,
        typeSpecificData: draft.typeSpecificData,
        savedAt: draft.updated || draft.created || new Date(),
      }

      // 添加到历史，保持最多10个版本
      draft.history.unshift(historyEntry)
      if (draft.history.length > this.MAX_HISTORY_VERSIONS) {
        draft.history = draft.history.slice(0, this.MAX_HISTORY_VERSIONS)
      }
    }

    // 更新草稿内容
    if (dto.title !== undefined) draft.title = dto.title
    if (dto.text !== undefined) draft.text = dto.text
    if (dto.images !== undefined) draft.images = dto.images
    if (dto.meta !== undefined) draft.meta = dbTransforms.json(dto.meta) as any
    if (dto.typeSpecificData !== undefined) {
      draft.typeSpecificData = JSON.stringify(dto.typeSpecificData)
    }

    if (hasContentChange) {
      draft.version = draft.version + 1
    }

    await draft.save()
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

    // 如果草稿已发布（publishedVersion === version），返回 null
    // 表示草稿内容已与已发布内容同步，不需要恢复
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
      throw new NotFoundException('草稿不存在')
    }
  }

  async getHistory(
    id: string,
  ): Promise<Array<{ version: number; title: string; savedAt: Date }>> {
    const draft = await this.draftModel.findById(id).lean()
    if (!draft) {
      throw new NotFoundException('草稿不存在')
    }

    return draft.history.map((h) => ({
      version: h.version,
      title: h.title,
      savedAt: h.savedAt,
    }))
  }

  async getHistoryVersion(
    id: string,
    version: number,
  ): Promise<DraftHistoryModel> {
    const draft = await this.draftModel.findById(id).lean()
    if (!draft) {
      throw new NotFoundException('草稿不存在')
    }

    const historyEntry = draft.history.find((h) => h.version === version)
    if (!historyEntry) {
      throw new NotFoundException('历史版本不存在')
    }

    return historyEntry
  }

  async restoreVersion(id: string, version: number): Promise<DraftModel> {
    const draft = await this.draftModel.findById(id)
    if (!draft) {
      throw new NotFoundException('草稿不存在')
    }

    const historyEntry = draft.history.find((h) => h.version === version)
    if (!historyEntry) {
      throw new NotFoundException('历史版本不存在')
    }

    // 保存当前版本到历史
    draft.history.unshift({
      version: draft.version,
      title: draft.title,
      text: draft.text,
      typeSpecificData: draft.typeSpecificData,
      savedAt: draft.updated || new Date(),
    })

    // 恢复历史版本
    draft.title = historyEntry.title
    draft.text = historyEntry.text
    draft.typeSpecificData = historyEntry.typeSpecificData
    draft.version = draft.version + 1

    // 保持历史版本数量限制
    if (draft.history.length > this.MAX_HISTORY_VERSIONS) {
      draft.history = draft.history.slice(0, this.MAX_HISTORY_VERSIONS)
    }

    await draft.save()
    return draft.toObject()
  }

  async linkToPublished(draftId: string, publishedId: string): Promise<void> {
    await this.draftModel.findByIdAndUpdate(draftId, {
      refId: Types.ObjectId.createFromHexString(publishedId),
    })
  }

  /**
   * 标记草稿为已发布
   * 将 publishedVersion 设置为当前 version，表示草稿内容已同步到已发布内容
   */
  async markAsPublished(draftId: string): Promise<void> {
    const draft = await this.draftModel.findById(draftId)
    if (!draft) return

    draft.publishedVersion = draft.version
    await draft.save()
  }

  private transformDraft(draft: DraftModel): DraftModel {
    // 解析 typeSpecificData JSON
    if (draft.typeSpecificData && typeof draft.typeSpecificData === 'string') {
      try {
        ;(draft as any).typeSpecificData = JSON.parse(draft.typeSpecificData)
      } catch {
        // 保持原样
      }
    }
    return draft
  }
}
