import { Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { FileReferenceType } from '~/modules/file/file-reference.enum'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { CONTENT_PUBLISH_TASK } from '~/modules/publish/publish.types'
import { WsPresenceService } from '~/processors/gateway/ws/ws-presence.service'
import { TaskQueueService } from '~/processors/task-queue/task-queue.service'
import { TaskStatus } from '~/processors/task-queue/task-queue.types'
import type { EntityId } from '~/shared/id/entity-id'

import { CLEANUP_CATEGORIES, type DraftRefType } from './draft.enum'
import { DraftRepository } from './draft.repository'
import type { DraftBranchRow, DraftRelation } from './draft.types'
import {
  type CleanupTx,
  DraftCleanupRepository,
  type Freed,
  planPrune,
} from './draft-cleanup.repository'
import { pickSnapshot, sameRevisionContent } from './draft-content'
import {
  createContentDoc,
  createDocument,
  readDocContent,
} from './draft-crdt.doc'
import { DraftCrdtService } from './draft-crdt.service'
import {
  DraftOrganizerRepository,
  type OrganizerFilter,
} from './draft-organizer.repository'
import {
  type DocumentCandidate,
  type DraftCandidate,
  DraftStorageRepository,
  type StorageTotals,
} from './draft-storage.repository'

export { CLEANUP_CATEGORIES } from './draft.enum'
export type CleanupCategory = (typeof CLEANUP_CATEGORIES)[number]

export interface FreedTotals {
  bytes: number
  crdtDocs: number
  drafts: number
  revisions: number
}

export interface CleanupPreview {
  archived: DraftCandidate[]
  categories: Record<CleanupCategory, { bytes: number; count: number }>
  inSync: DraftCandidate[]
  olderThanDays: number
}

export interface CleanupInput {
  archivedDraftIds?: string[]
  categories: CleanupCategory[]
  olderThanDays: number
}

export interface CleanupResult {
  freed: FreedTotals
  skipped: string[]
}

export type OrganizerSkipReason =
  'changed' | 'editing' | 'publishing' | 'unconfirmed' | 'failed'
export interface OrganizerInput {
  discardChanges: boolean
  items: { documentId: string; version: string }[]
}
export interface OrganizerResult {
  freed: FreedTotals
  organized: number
  skipped: { documentId: string; reason: OrganizerSkipReason; title: string }[]
}

export interface StorageSummary extends StorageTotals {
  reclaimableBytes: number
  relations: Record<DraftRelation, number>
}

export interface CompactPreview {
  crdtBytes: number
  revisionBytes: number
  revisionIds: string[]
}

export interface ScheduledCleanupOptions {
  compactCrdt: boolean
  deleteInSyncDrafts: boolean
  enable: boolean
  olderThanDays: number
  pruneRevisions: boolean
  removeOrphanCrdt: boolean
}

const DAY_MS = 86_400_000
const DEFAULT_PREVIEW_DAYS = 30
const SCHEDULED_MIN_DAYS = 7

class CleanupSkip extends Error {}

const emptyFreed = (): FreedTotals => ({
  bytes: 0,
  crdtDocs: 0,
  drafts: 0,
  revisions: 0,
})

const addFreed = (target: FreedTotals, next: Partial<FreedTotals>) => {
  target.bytes += next.bytes ?? 0
  target.crdtDocs += next.crdtDocs ?? 0
  target.drafts += next.drafts ?? 0
  target.revisions += next.revisions ?? 0
}

const tally = (candidates: DocumentCandidate[]) => ({
  bytes: candidates.reduce((sum, item) => sum + Math.max(0, item.bytes), 0),
  count: candidates.reduce((sum, item) => sum + item.count, 0),
})

const cutoffOf = (days: number) => new Date(Date.now() - days * DAY_MS)

@Injectable()
export class DraftCleanupService {
  private readonly logger = new Logger(DraftCleanupService.name)

  constructor(
    private readonly drafts: DraftRepository,
    private readonly crdtService: DraftCrdtService,
    private readonly cleanup: DraftCleanupRepository,
    private readonly storageRepository: DraftStorageRepository,
    private readonly fileReferences: FileReferenceService,
    private readonly tasks: TaskQueueService,
    private readonly organizer: DraftOrganizerRepository,
    private readonly presence: WsPresenceService,
  ) {}

  async organizerPreview(filter: OrganizerFilter) {
    return (await this.organizer.candidates(filter)).map(
      ({ draftIds, publishedRevisionId, ...item }) => item,
    )
  }

  async organize(input: OrganizerInput): Promise<OrganizerResult> {
    const result: OrganizerResult = {
      freed: emptyFreed(),
      organized: 0,
      skipped: [],
    }
    const pending = await this.publishingDocuments()
    for (const { documentId, version } of input.items) {
      let title = ''
      let reason: OrganizerSkipReason = 'changed'
      try {
        const removed = await this.cleanup.withDocument(
          documentId,
          async (tx) => {
            await this.organizer.lockState(tx, documentId)
            const [current] = await this.organizer.candidates(
              { olderThanDays: 0 },
              tx,
              documentId,
            )
            title = current?.title ?? ''
            if (!current || current.version !== version) return null
            if (pending.has(documentId)) {
              reason = 'publishing'
              return null
            }
            const occupied = await Promise.all(
              ['admin', 'web'].map((ns: 'admin' | 'web') =>
                this.presence.roomHasMembers(ns, `collab:${documentId}`),
              ),
            )
            if (occupied.some(Boolean)) {
              reason = 'editing'
              return null
            }
            if (current.hasChanges && !input.discardChanges) {
              reason = 'unconfirmed'
              return null
            }
            await this.cleanup.bumpEpoch(tx, documentId)
            for (const id of current.draftIds) {
              await this.cleanup.releaseShare(
                tx,
                documentId,
                id,
                current.publishedRevisionId as EntityId,
              )
              await this.cleanup.deleteDraftRow(tx, id)
            }
            const crdt = await this.cleanup.deleteCrdt(tx, documentId)
            const revisions = await this.cleanup.pruneRevisions(tx, documentId)
            return {
              draftIds: current.draftIds,
              freed: {
                bytes: crdt.bytes + revisions.bytes,
                crdtDocs: crdt.count,
                drafts: current.draftCount,
                revisions: revisions.count,
              },
            }
          },
        )
        if (!removed) {
          result.skipped.push({ documentId, reason, title })
          continue
        }
        addFreed(result.freed, removed.freed)
        result.organized++
        this.crdtService.announceReset(documentId, 'deleted')
        for (const id of removed.draftIds) {
          try {
            await this.fileReferences.removeReferencesForDocument(
              id,
              FileReferenceType.Draft,
            )
          } catch (error) {
            this.logger.warn(
              `Removing file references for draft ${id} failed: ${(error as Error).message}`,
            )
          }
        }
      } catch (error) {
        this.logger.warn(
          `Organizing document ${documentId} failed: ${(error as Error).message}`,
        )
        result.skipped.push({ documentId, reason: 'failed', title })
      }
    }
    return result
  }

  async deleteDraft(id: EntityId | string): Promise<FreedTotals> {
    const branch = await this.branchOrThrow(id)
    await this.assertNotPublishing(branch.documentId)
    return this.conflictOnSkip(branch, () => this.removeDraft(branch, false))
  }

  async deleteDrafts(ids: string[]): Promise<CleanupResult> {
    const freed = emptyFreed()
    const skipped: string[] = []
    const pending = await this.publishingDocuments()
    for (const id of ids) {
      const branch = await this.drafts.findBranchById(id)
      if (!branch || pending.has(String(branch.documentId))) {
        skipped.push(id)
        continue
      }
      try {
        addFreed(freed, await this.removeDraft(branch, false))
      } catch (error) {
        if (!(error instanceof CleanupSkip)) {
          this.logger.warn(
            `Deleting draft ${id} failed: ${(error as Error).message}`,
          )
        }
        skipped.push(id)
      }
    }
    return { freed, skipped }
  }

  async compact(id: EntityId | string): Promise<FreedTotals> {
    const branch = await this.branchOrThrow(id)
    await this.assertNotPublishing(branch.documentId)
    return this.conflictOnSkip(branch, () => this.compactBranch(branch))
  }

  async compactPreview(id: EntityId | string): Promise<CompactPreview> {
    const branch = await this.branchOrThrow(id)
    const documentId = String(branch.documentId)
    const [{ keep, nodes }, crdtBytes] = await Promise.all([
      this.cleanup.inspect(documentId),
      this.storageRepository.crdtReclaimable(documentId),
    ])
    const plan = planPrune(nodes, (node) => !keep.has(node.id))
    return {
      crdtBytes,
      revisionBytes: plan.bytes,
      revisionIds: nodes
        .filter((node) => plan.removed.has(node.id))
        .map((node) => node.id),
    }
  }

  async preview(olderThanDays: number): Promise<CleanupPreview> {
    const cutoff = cutoffOf(olderThanDays)
    const [inSync, stale, idle, orphans, archived] = await Promise.all([
      this.storageRepository.inSyncDrafts(cutoff),
      this.storageRepository.staleRevisions(cutoff),
      this.storageRepository.idleCrdtDocs(cutoff),
      this.storageRepository.orphanCrdtDocs(),
      this.storageRepository.archivedDrafts(),
    ])
    const inSyncDocuments = new Set(inSync.map((item) => item.documentId))
    return {
      archived,
      categories: {
        A: tally(inSync),
        B: tally(stale.filter((item) => !inSyncDocuments.has(item.documentId))),
        C: tally(idle.filter((item) => !inSyncDocuments.has(item.documentId))),
        D: tally(orphans),
      },
      inSync,
      olderThanDays,
    }
  }

  async run(input: CleanupInput): Promise<CleanupResult> {
    const cutoff = cutoffOf(input.olderThanDays)
    const categories = new Set(input.categories)
    const pending = await this.publishingDocuments()
    const freed = emptyFreed()
    const skipped = new Set<string>()
    const guard = async (
      documentId: string,
      work: () => Promise<Partial<FreedTotals>>,
    ) => {
      if (pending.has(documentId)) {
        skipped.add(documentId)
        return
      }
      try {
        addFreed(freed, await work())
      } catch (error) {
        if (!(error instanceof CleanupSkip)) {
          this.logger.warn(
            `Cleanup of document ${documentId} failed: ${(error as Error).message}`,
          )
        }
        skipped.add(documentId)
      }
    }

    if (categories.has('A')) {
      for (const item of await this.storageRepository.inSyncDrafts(cutoff)) {
        await guard(item.documentId, async () => {
          const branch = await this.drafts.findBranchById(item.draftId)
          return branch ? this.removeDraft(branch, true) : {}
        })
      }
    }
    for (const id of input.archivedDraftIds ?? []) {
      const branch = await this.drafts.findBranchById(id)
      if (branch?.status !== 'archived') continue
      await guard(String(branch.documentId), () =>
        this.removeDraft(branch, false),
      )
    }
    if (categories.has('B')) {
      for (const item of await this.storageRepository.staleRevisions(cutoff)) {
        await guard(item.documentId, async () => {
          const pruned = await this.cleanup.withDocument(
            item.documentId,
            (tx) => this.cleanup.pruneRevisions(tx, item.documentId, cutoff),
          )
          return { bytes: pruned.bytes, revisions: pruned.count }
        })
      }
    }
    if (categories.has('C')) {
      for (const item of await this.storageRepository.idleCrdtDocs(cutoff)) {
        await guard(item.documentId, async () => {
          const [branch] = await this.drafts.findBranchesByDocument(
            item.documentId,
          )
          return branch ? this.compactBranch(branch, cutoff) : {}
        })
      }
    }
    if (categories.has('D')) {
      for (const item of await this.storageRepository.orphanCrdtDocs()) {
        await guard(item.documentId, async () => {
          const removed = await this.cleanup.withDocument(
            item.documentId,
            async (tx) => {
              const statuses = await this.cleanup.draftStatuses(
                tx,
                item.documentId,
              )
              if (statuses.includes('active')) throw new CleanupSkip()
              await this.cleanup.bumpEpoch(tx, item.documentId)
              return this.cleanup.deleteCrdt(tx, item.documentId)
            },
          )
          return { bytes: removed.bytes, crdtDocs: removed.count }
        })
      }
    }
    return { freed, skipped: [...skipped] }
  }

  runScheduled(options: ScheduledCleanupOptions) {
    if (!options.enable) return Promise.resolve(null)
    const switches: Array<[CleanupCategory, boolean]> = [
      ['A', options.deleteInSyncDrafts],
      ['B', options.pruneRevisions],
      ['C', options.compactCrdt],
      ['D', options.removeOrphanCrdt],
    ]
    return this.run({
      categories: switches.filter(([, on]) => on).map(([key]) => key),
      olderThanDays: Math.max(SCHEDULED_MIN_DAYS, options.olderThanDays),
    })
  }

  async storage(refType?: DraftRefType): Promise<StorageSummary> {
    const [totals, preview, relations] = await Promise.all([
      this.storageRepository.totals(),
      this.preview(DEFAULT_PREVIEW_DAYS),
      this.storageRepository.relationCounts({ refType }),
    ])
    const reclaimableBytes = Object.values(preview.categories).reduce(
      (sum, item) => sum + item.bytes,
      0,
    )
    return { ...totals, reclaimableBytes, relations }
  }

  private async removeDraft(
    branch: DraftBranchRow,
    requireInSync: boolean,
  ): Promise<FreedTotals> {
    const documentId = String(branch.documentId)
    const freed = emptyFreed()
    let removedCrdt = false
    await this.cleanup.withDocument(documentId, async (tx) => {
      const document = await this.drafts.findDocumentById(documentId)
      if (!document) throw new CleanupSkip()
      if (requireInSync) await this.assertInSync(tx, branch, document)
      await this.cleanup.bumpEpoch(tx, documentId)
      await this.cleanup.releaseShare(
        tx,
        documentId,
        branch.id,
        document.publishedRevisionId,
      )
      await this.cleanup.deleteDraftRow(tx, branch.id)
      freed.drafts = 1
      const statuses = await this.cleanup.draftStatuses(tx, documentId)
      if (branch.status === 'active' && !statuses.includes('active')) {
        const crdt = await this.cleanup.deleteCrdt(tx, documentId)
        addFreed(freed, { bytes: crdt.bytes, crdtDocs: crdt.count })
        removedCrdt = crdt.count > 0
      }
      addFreed(freed, this.asRevisions(await this.prune(tx, documentId)))
      const orphaned =
        !document.publishedRevisionId &&
        !statuses.length &&
        !(await this.cleanup.hasPublicationEvents(tx, documentId))
      if (orphaned) await this.cleanup.deleteDocument(tx, documentId)
    })
    await this.fileReferences.removeReferencesForDocument(
      branch.id,
      FileReferenceType.Draft,
    )
    if (branch.status === 'active' || removedCrdt) {
      this.crdtService.announceReset(documentId, 'deleted')
    }
    return freed
  }

  private async compactBranch(
    branch: DraftBranchRow,
    before?: Date,
  ): Promise<FreedTotals> {
    const documentId = String(branch.documentId)
    const hasCrdt = await this.cleanup.hasCrdt(documentId)
    if (hasCrdt) await this.crdtService.createCheckpoint(branch.id, 'save')
    const freed = emptyFreed()
    let rebuilt = false
    await this.cleanup.withDocument(documentId, async (tx) => {
      if (hasCrdt) {
        addFreed(freed, { bytes: await this.rebuild(tx, branch) })
        rebuilt = true
      }
      addFreed(
        freed,
        this.asRevisions(await this.prune(tx, documentId, before)),
      )
    })
    if (rebuilt) this.crdtService.announceReset(documentId, 'compacted')
    return freed
  }

  private async rebuild(tx: CleanupTx, branch: DraftBranchRow) {
    const documentId = String(branch.documentId)
    const state = await this.cleanup.crdtState(tx, documentId)
    const current = await this.drafts.findBranchById(branch.id)
    if (!state || !current) throw new CleanupSkip()
    const head = await this.drafts.findRevisionById(current.headRevisionId)
    const content = readDocContent(this.load(state))
    if (head?.content !== content.content || head.title !== content.title) {
      throw new CleanupSkip()
    }
    await this.cleanup.bumpEpoch(tx, documentId)
    const fresh = createContentDoc(content, `compact ${head.id}`)
    return this.cleanup.replaceCrdt(tx, {
      documentId,
      frontiers: fresh.frontiers(),
      headRevisionId: head.id,
      snapshot: fresh.export({ mode: 'snapshot' }),
      snapshotVersion: fresh.oplogVersion().encode(),
    })
  }

  private async assertInSync(
    tx: CleanupTx,
    branch: DraftBranchRow,
    document: { publishedRevisionId: EntityId | null },
  ) {
    const current = await this.drafts.findBranchById(branch.id)
    if (
      !current ||
      current.status !== 'active' ||
      current.headRevisionId !== document.publishedRevisionId
    ) {
      throw new CleanupSkip()
    }
    const state = await this.cleanup.crdtState(tx, branch.documentId)
    if (!state) return
    const head = await this.drafts.findRevisionById(current.headRevisionId)
    const content = readDocContent(this.load(state))
    if (head?.content !== content.content || head.title !== content.title) {
      throw new CleanupSkip()
    }
    const published = pickSnapshot(head)
    const fields = state.fields ?? { meta: null, typeSpecificData: null }
    if (
      !sameRevisionContent(published, {
        ...published,
        meta: fields.meta,
        typeSpecificData: fields.typeSpecificData,
      })
    ) {
      throw new CleanupSkip()
    }
  }

  private load(state: { snapshot: Uint8Array; updates: Uint8Array[] }) {
    const doc = createDocument()
    doc.import(state.snapshot)
    if (state.updates.length) doc.importBatch(state.updates)
    return doc
  }

  private async conflictOnSkip<T>(
    branch: DraftBranchRow,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work()
    } catch (error) {
      if (!(error instanceof CleanupSkip)) throw error
      throw createAppException(AppErrorCode.DRAFT_CLEANUP_CONFLICT, {
        documentId: String(branch.documentId),
      })
    }
  }

  private prune(tx: CleanupTx, documentId: string, before?: Date) {
    return this.cleanup.pruneRevisions(tx, documentId, before)
  }

  private asRevisions(freed: Freed): Partial<FreedTotals> {
    return { bytes: freed.bytes, revisions: freed.count }
  }

  private async branchOrThrow(id: EntityId | string) {
    const branch = await this.drafts.findBranchById(id)
    if (!branch) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, { id: String(id) })
    }
    return branch
  }

  private async assertNotPublishing(documentId: EntityId | string) {
    if ((await this.publishingDocuments()).has(String(documentId))) {
      throw createAppException(AppErrorCode.DRAFT_PUBLISH_PENDING, {
        documentId: String(documentId),
      })
    }
  }

  private async publishingDocuments(): Promise<Set<string>> {
    const documents = new Set<string>()
    for (let page = 1; ; page++) {
      const { data, total } = await this.tasks.getTasks({
        page,
        size: 200,
        status: [TaskStatus.Pending, TaskStatus.Running],
        type: CONTENT_PUBLISH_TASK,
      })
      for (const task of data) {
        const documentId = (task.payload as { documentId?: unknown })
          ?.documentId
        if (documentId) documents.add(String(documentId))
      }
      if (!data.length || page * 200 >= total) return documents
    }
  }
}
