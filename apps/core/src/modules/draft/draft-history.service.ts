import { Injectable } from '@nestjs/common'

import { ContentFormat } from '~/shared/types/content-format.type'

import type { DiffStrategy } from './diff'
import { jsonDiffStrategy, textDiffStrategy } from './diff'
import type { DraftHistoryModel } from './draft.types'

export interface DraftStateSnapshot {
  version: number
  title: string
  text: string
  contentFormat: ContentFormat
  content?: string
  typeSpecificData?: string
  savedAt: Date
}

export interface HistoryPushResult {
  entry: DraftHistoryModel
  history: DraftHistoryModel[]
}

@Injectable()
export class DraftHistoryService {
  private readonly MAX_HISTORY_VERSIONS = 100
  private readonly FULL_SNAPSHOT_INTERVAL = 5
  private readonly DIFF_SIZE_THRESHOLD = 0.7

  pushHistoryEntry(
    snapshot: DraftStateSnapshot,
    existingHistory: DraftHistoryModel[],
  ): HistoryPushResult {
    const entry = this.createHistoryEntry(
      snapshot.version,
      snapshot.title,
      snapshot.text,
      snapshot.typeSpecificData,
      snapshot.savedAt,
      existingHistory,
      snapshot.contentFormat,
      snapshot.content,
    )

    const history = [entry, ...existingHistory]
    if (
      history.length > this.MAX_HISTORY_VERSIONS &&
      this.canTrimHistory(history)
    ) {
      return { entry, history: this.trimHistoryWithFullSnapshot(history) }
    }

    return { entry, history }
  }

  hasContentChange(
    current: {
      title: string
      text: string
      content?: string
      contentFormat?: ContentFormat
      typeSpecificData?: string
    },
    incoming: {
      title?: string
      text?: string
      content?: string
      contentFormat?: ContentFormat
      typeSpecificData?: Record<string, any>
    },
  ): boolean {
    if (
      incoming.contentFormat !== undefined &&
      incoming.contentFormat !== current.contentFormat
    ) {
      return true
    }

    if (incoming.title !== undefined && incoming.title !== current.title) {
      return true
    }

    if (
      incoming.typeSpecificData !== undefined &&
      JSON.stringify(incoming.typeSpecificData) !== current.typeSpecificData
    ) {
      return true
    }

    const format =
      incoming.contentFormat ?? current.contentFormat ?? ContentFormat.Markdown
    if (format === ContentFormat.Lexical) {
      return (
        incoming.content !== undefined && incoming.content !== current.content
      )
    }

    return incoming.text !== undefined && incoming.text !== current.text
  }

  resolveHistoryEntry(
    entry: DraftHistoryModel,
    allHistory: DraftHistoryModel[],
    currentText: string,
    currentContent?: string,
  ): DraftHistoryModel {
    if (entry.isFullSnapshot) {
      return entry
    }

    const format = entry.contentFormat ?? ContentFormat.Markdown
    const isLexical = format === ContentFormat.Lexical

    if (isLexical) {
      const restoredContent = this.restoreFromHistory(
        entry.version,
        allHistory,
        currentContent ?? '',
        this.getStrategy(format),
        'content',
      )
      return {
        ...entry,
        content: restoredContent,
        isFullSnapshot: true,
      }
    }

    const restoredText = this.restoreFromHistory(
      entry.version,
      allHistory,
      currentText,
      this.getStrategy(format),
      'text',
    )
    const content =
      entry.content ?? this.findNearestFullSnapshot(allHistory)?.content

    return {
      ...entry,
      text: restoredText,
      content,
      isFullSnapshot: true,
    }
  }

  getHistorySummary(history: DraftHistoryModel[]): Array<{
    version: number
    title: string
    savedAt: Date
    isFullSnapshot: boolean
  }> {
    return history.map((h) => ({
      version: h.version,
      title: h.title,
      savedAt: h.savedAt,
      isFullSnapshot: h.isFullSnapshot ?? true,
    }))
  }

  // ── Private ──

  private getStrategy(
    contentFormat: ContentFormat = ContentFormat.Markdown,
  ): DiffStrategy {
    return contentFormat === ContentFormat.Lexical
      ? jsonDiffStrategy
      : textDiffStrategy
  }

  private getPrimaryField(contentFormat: ContentFormat): 'text' | 'content' {
    return contentFormat === ContentFormat.Lexical ? 'content' : 'text'
  }

  private createHistoryEntry(
    version: number,
    title: string,
    text: string,
    typeSpecificData: string | undefined,
    savedAt: Date,
    existingHistory: DraftHistoryModel[],
    contentFormat: ContentFormat = ContentFormat.Markdown,
    content?: string,
  ): DraftHistoryModel {
    const strategy = this.getStrategy(contentFormat)
    const primaryField = this.getPrimaryField(contentFormat)
    const primaryValue =
      primaryField === 'content' ? (content ?? '') : (text ?? '')

    const shouldFullSnapshot = this.shouldStoreFullSnapshot(
      version,
      primaryValue,
      existingHistory,
      strategy,
      primaryField,
    )

    if (shouldFullSnapshot) {
      return {
        version,
        title,
        text: primaryField === 'text' ? primaryValue : undefined,
        contentFormat,
        content: primaryField === 'content' ? primaryValue : content,
        typeSpecificData,
        savedAt,
        isFullSnapshot: true,
      }
    }

    const baseSnapshot = this.findNearestFullSnapshot(existingHistory)
    const baseValue =
      primaryField === 'content'
        ? (baseSnapshot?.content ?? primaryValue)
        : (baseSnapshot?.text ?? primaryValue)
    const patchText = strategy.createPatch(baseValue, primaryValue)

    if (!patchText) {
      const result: DraftHistoryModel = {
        version,
        title,
        contentFormat,
        typeSpecificData,
        savedAt,
        isFullSnapshot: false,
        refVersion: baseSnapshot?.version,
        baseVersion: baseSnapshot?.version,
      }
      if (primaryField === 'text') {
        const diffContent =
          content !== baseSnapshot?.content ? content : undefined
        result.content = diffContent
      }
      return result
    }

    const result: DraftHistoryModel = {
      version,
      title,
      contentFormat,
      typeSpecificData,
      savedAt,
      isFullSnapshot: false,
      baseVersion: baseSnapshot?.version,
    }

    if (primaryField === 'text') {
      result.text = patchText
      const diffContent =
        content !== baseSnapshot?.content ? content : undefined
      result.content = diffContent
    } else {
      result.content = patchText
    }

    return result
  }

  private shouldStoreFullSnapshot(
    version: number,
    primaryValue: string,
    existingHistory: DraftHistoryModel[],
    strategy: DiffStrategy,
    primaryField: 'text' | 'content',
  ): boolean {
    if (existingHistory.length === 0) {
      return true
    }

    if (version % this.FULL_SNAPSHOT_INTERVAL === 1) {
      return true
    }

    const nearestFullSnapshot = existingHistory.find((h) => h.isFullSnapshot)
    if (!nearestFullSnapshot) {
      return true
    }

    const baseValue =
      primaryField === 'content'
        ? (nearestFullSnapshot.content ?? '')
        : (nearestFullSnapshot.text ?? '')
    const patch = strategy.createPatch(baseValue, primaryValue)

    if (strategy.isOversized(patch, primaryValue, this.DIFF_SIZE_THRESHOLD)) {
      return true
    }

    return false
  }

  private findNearestFullSnapshot(
    history: DraftHistoryModel[],
  ): DraftHistoryModel | undefined {
    return history.find((h) => h.isFullSnapshot)
  }

  private restoreFromHistory(
    targetVersion: number,
    history: DraftHistoryModel[],
    currentValue: string,
    strategy: DiffStrategy,
    field: 'text' | 'content',
    visited: Set<number> = new Set(),
  ): string {
    if (visited.has(targetVersion)) {
      return currentValue
    }
    visited.add(targetVersion)

    const targetIndex = history.findIndex((h) => h.version === targetVersion)
    if (targetIndex === -1) {
      return currentValue
    }

    const targetEntry = history[targetIndex]
    if (targetEntry.refVersion !== undefined) {
      const refEntry = history.find((h) => h.version === targetEntry.refVersion)
      if (refEntry?.isFullSnapshot) {
        return (
          (field === 'content' ? refEntry.content : refEntry.text) ??
          currentValue
        )
      }
      return this.restoreFromHistory(
        targetEntry.refVersion,
        history,
        currentValue,
        strategy,
        field,
        visited,
      )
    }
    if (targetEntry.isFullSnapshot) {
      return (
        (field === 'content' ? targetEntry.content : targetEntry.text) ??
        currentValue
      )
    }

    let baseValue = currentValue
    for (let i = targetIndex; i < history.length; i++) {
      if (history[i].isFullSnapshot) {
        baseValue =
          (field === 'content' ? history[i].content : history[i].text) ??
          currentValue
        break
      }
    }

    const patchValue =
      (field === 'content' ? targetEntry.content : targetEntry.text) ?? ''
    return strategy.applyPatch(baseValue, patchValue)
  }

  private trimHistoryWithFullSnapshot(
    history: DraftHistoryModel[],
  ): DraftHistoryModel[] {
    if (history.length <= this.MAX_HISTORY_VERSIONS) {
      return history
    }

    const trimmed = history.slice(0, this.MAX_HISTORY_VERSIONS)

    const trimmedVersions = new Set<number>(trimmed.map((h) => h.version))
    for (const entry of trimmed) {
      if (
        entry.refVersion !== undefined &&
        !trimmedVersions.has(entry.refVersion)
      ) {
        const format = entry.contentFormat ?? ContentFormat.Markdown
        const strategy = this.getStrategy(format)
        const field = this.getPrimaryField(format)
        const resolvedValue = this.restoreFromHistory(
          entry.version,
          history,
          '',
          strategy,
          field,
        )
        if (field === 'content') {
          entry.content = resolvedValue
        } else {
          entry.text = resolvedValue
        }
        entry.isFullSnapshot = true
        entry.refVersion = undefined
        entry.baseVersion = undefined
      }
    }

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

  private canTrimHistory(history: DraftHistoryModel[]): boolean {
    return history[0]?.isFullSnapshot === true
  }
}
