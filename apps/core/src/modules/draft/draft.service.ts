import { Injectable } from '@nestjs/common'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { FileReferenceType } from '~/modules/file/file-reference.model'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { InjectModel } from '~/transformers/model.transformer'
import { dbTransforms } from '~/utils/db-transform.util'
import DiffMatchPatch from 'diff-match-patch'
import { Types } from 'mongoose'
import { DraftHistoryModel, DraftModel, DraftRefType } from './draft.model'
import type { CreateDraftDto, UpdateDraftDto } from './draft.schema'

const dmp = new DiffMatchPatch()

@Injectable()
export class DraftService {
  private readonly MAX_HISTORY_VERSIONS = 100
  /**
   * 每 N 个版本存储一次全量快照
   * 例如: v1(全量) → v2(diff) → v3(diff) → v4(diff) → v5(diff) → v6(全量) → ...
   */
  private readonly FULL_SNAPSHOT_INTERVAL = 5
  /**
   * 当 diff 大小超过原文大小的这个比例时，直接存全量
   */
  private readonly DIFF_SIZE_THRESHOLD = 0.7

  constructor(
    @InjectModel(DraftModel)
    private readonly draftModel: MongooseModel<DraftModel>,
    private readonly fileReferenceService: FileReferenceService,
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

    // Track file references for the draft
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

    // 只有内容有实际变化时才保存到历史
    const hasContentChange =
      (dto.title !== undefined && dto.title !== draft.title) ||
      (dto.text !== undefined && dto.text !== draft.text) ||
      (dto.typeSpecificData !== undefined &&
        JSON.stringify(dto.typeSpecificData) !== draft.typeSpecificData)

    if (hasContentChange && (draft.title || draft.text)) {
      // 保存当前版本到历史（使用混合策略）
      const historyEntry = this.createHistoryEntry(
        draft.version,
        draft.title,
        draft.text,
        draft.typeSpecificData,
        draft.updated || draft.created || new Date(),
        draft.history,
      )

      draft.history.unshift(historyEntry)
      if (
        draft.history.length > this.MAX_HISTORY_VERSIONS &&
        this.canTrimHistory(draft.history)
      ) {
        // 删除时确保不会断链（保留至少一个全量快照）
        draft.history = this.trimHistoryWithFullSnapshot(draft.history)
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

    // Track file references for the draft
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
      throw new BizException(ErrorCodeEnum.DraftNotFound)
    }

    // Remove file references associated with this draft
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

    return draft.history.map((h) => ({
      version: h.version,
      title: h.title,
      savedAt: h.savedAt,
      isFullSnapshot: h.isFullSnapshot ?? true,
    }))
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

    // 如果是 diff 版本，需要恢复完整内容
    if (!historyEntry.isFullSnapshot) {
      const restoredText = this.restoreTextFromHistory(
        version,
        draft.history,
        draft.text ?? '',
      )
      return {
        ...historyEntry,
        text: restoredText,
        isFullSnapshot: true,
      }
    }

    return historyEntry
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

    // 保存当前版本到历史（使用混合策略）
    const newHistoryEntry = this.createHistoryEntry(
      draft.version,
      draft.title,
      draft.text,
      draft.typeSpecificData,
      draft.updated || new Date(),
      draft.history,
    )
    draft.history.unshift(newHistoryEntry)

    // 恢复历史版本的完整内容
    let restoredText = historyEntry.text ?? ''
    if (!historyEntry.isFullSnapshot) {
      restoredText = this.restoreTextFromHistory(
        version,
        draft.history,
        draft.text ?? '',
      )
    }

    draft.title = historyEntry.title
    draft.text = restoredText
    draft.typeSpecificData = historyEntry.typeSpecificData
    draft.version = draft.version + 1

    // 保持历史版本数量限制
    if (
      draft.history.length > this.MAX_HISTORY_VERSIONS &&
      this.canTrimHistory(draft.history)
    ) {
      draft.history = this.trimHistoryWithFullSnapshot(draft.history)
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

  /**
   * 创建历史记录条目（混合策略：周期性全量 + 中间增量）
   */
  private createHistoryEntry(
    version: number,
    title: string,
    text: string,
    typeSpecificData: string | undefined,
    savedAt: Date,
    existingHistory: DraftHistoryModel[],
  ): DraftHistoryModel {
    const historyText = text ?? ''

    // 判断是否需要存储全量快照
    const shouldFullSnapshot = this.shouldStoreFullSnapshot(
      version,
      historyText,
      existingHistory,
    )

    if (shouldFullSnapshot) {
      return {
        version,
        title,
        text: historyText,
        typeSpecificData,
        savedAt,
        isFullSnapshot: true,
      }
    }

    // 存储 diff：计算当前文本相对于最近全量快照的差异
    const baseSnapshot = this.findNearestFullSnapshot(existingHistory)
    const baseText = baseSnapshot?.text ?? historyText
    const patches = dmp.patch_make(baseText, historyText)
    const patchText = dmp.patch_toText(patches)

    // 当文本没有实际 diff（仅标题变化等），避免空字符串触发 required 校验
    if (!patchText) {
      return {
        version,
        title,
        typeSpecificData,
        savedAt,
        isFullSnapshot: false,
        refVersion: baseSnapshot?.version,
        baseVersion: baseSnapshot?.version,
      }
    }

    return {
      version,
      title,
      text: patchText,
      typeSpecificData,
      savedAt,
      isFullSnapshot: false,
      baseVersion: baseSnapshot?.version,
    }
  }

  /**
   * 判断是否应该存储全量快照
   */
  private shouldStoreFullSnapshot(
    version: number,
    text: string,
    existingHistory: DraftHistoryModel[],
  ): boolean {
    // 第一个版本总是全量
    if (existingHistory.length === 0) {
      return true
    }

    // 每 N 个版本存一次全量
    if (version % this.FULL_SNAPSHOT_INTERVAL === 1) {
      return true
    }

    // 查找最近的全量快照
    const nearestFullSnapshot = existingHistory.find((h) => h.isFullSnapshot)
    if (!nearestFullSnapshot) {
      return true
    }

    // 计算 diff 大小，如果 diff 太大则直接存全量
    const patches = dmp.patch_make(nearestFullSnapshot.text ?? '', text)
    const patchText = dmp.patch_toText(patches)

    if (patchText.length > text.length * this.DIFF_SIZE_THRESHOLD) {
      return true
    }

    return false
  }

  /**
   * 查找最近的全量快照文本
   */
  private findNearestFullSnapshot(
    history: DraftHistoryModel[],
  ): DraftHistoryModel | undefined {
    return history.find((h) => h.isFullSnapshot)
  }

  private findNearestFullSnapshotText(
    history: DraftHistoryModel[],
    currentText: string,
  ): string {
    return this.findNearestFullSnapshot(history)?.text ?? currentText
  }

  /**
   * 从历史记录中恢复指定版本的完整文本
   * diff 以最近全量快照为基准，因此只需要基准快照 + 目标 diff
   */
  private restoreTextFromHistory(
    targetVersion: number,
    history: DraftHistoryModel[],
    currentText: string,
    visited: Set<number> = new Set(),
  ): string {
    if (visited.has(targetVersion)) {
      return currentText
    }
    visited.add(targetVersion)

    const targetIndex = history.findIndex((h) => h.version === targetVersion)
    if (targetIndex === -1) {
      return currentText
    }

    const targetEntry = history[targetIndex]
    if (targetEntry.refVersion !== undefined) {
      const refEntry = history.find((h) => h.version === targetEntry.refVersion)
      if (refEntry?.isFullSnapshot) {
        return refEntry.text ?? currentText
      }
      return this.restoreTextFromHistory(
        targetEntry.refVersion,
        history,
        currentText,
        visited,
      )
    }
    if (targetEntry.isFullSnapshot) {
      return targetEntry.text ?? currentText
    }

    // 向后查找最近的全量快照
    let baseText = currentText
    for (let i = targetIndex; i < history.length; i++) {
      if (history[i].isFullSnapshot) {
        baseText = history[i].text ?? currentText
        break
      }
    }

    try {
      const patches = dmp.patch_fromText(targetEntry.text ?? '')
      const [newText, results] = dmp.patch_apply(patches, baseText)
      return results.every((r) => r) ? newText : baseText
    } catch {
      // patch 解析或应用失败时回退到基准快照，避免返回损坏文本
      return baseText
    }
  }

  /**
   * 裁剪历史记录，确保保留至少一个全量快照
   */
  private trimHistoryWithFullSnapshot(
    history: DraftHistoryModel[],
  ): DraftHistoryModel[] {
    if (history.length <= this.MAX_HISTORY_VERSIONS) {
      return history
    }

    // 保留前 MAX_HISTORY_VERSIONS 个版本
    const trimmed = history.slice(0, this.MAX_HISTORY_VERSIONS)

    // 将失效的引用转为真实快照，避免 trim 后链路断裂
    const trimmedVersions = new Set<number>(trimmed.map((h) => h.version))
    for (const entry of trimmed) {
      if (
        entry.refVersion !== undefined &&
        !trimmedVersions.has(entry.refVersion)
      ) {
        const resolvedText = this.restoreTextFromHistory(
          entry.version,
          history,
          '',
        )
        entry.text = resolvedText
        entry.isFullSnapshot = true
        entry.refVersion = undefined
        entry.baseVersion = undefined
      }
    }

    // 如果裁剪后仍然没有全量快照，保留窗口之后最近的一个全量快照作为基准
    const hasFullSnapshot = trimmed.some((h) => h.isFullSnapshot)
    if (!hasFullSnapshot) {
      const baselineFullSnapshot = history
        .slice(this.MAX_HISTORY_VERSIONS)
        .find((h) => h.isFullSnapshot)
      if (baselineFullSnapshot) {
        trimmed[trimmed.length - 1] = baselineFullSnapshot
      }
    }

    return trimmed
  }

  /**
   * 只有当最新记录是全量快照时才允许裁剪
   */
  private canTrimHistory(history: DraftHistoryModel[]): boolean {
    return history[0]?.isFullSnapshot === true
  }
}
