import { mxLexicalToMarkdown } from '@mx-space/editor'
import { Injectable, Logger } from '@nestjs/common'
import { type LoroDoc, type OpId, VersionVector } from 'loro-crdt'

import { AppErrorCode, createAppException } from '~/common/errors'
import { FileReferenceType } from '~/modules/file/file-reference.enum'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import type { EntityId } from '~/shared/id/entity-id'
import { ContentFormat } from '~/shared/types/content-format.type'

import type { DraftRefType } from './draft.enum'
import { DraftRepository } from './draft.repository'
import type {
  CheckpointInput,
  CheckpointKind,
  ContentDocumentRow,
  ContentRevisionRow,
  CrdtDocRow,
  CrdtFields,
  CrdtFieldsPatch,
  DraftBranchRow,
  RevisionSnapshot,
} from './draft.types'
import {
  canonicalSnapshot,
  pickSnapshot,
  sameRevisionContent,
} from './draft-content'
import {
  createContentDoc,
  createDocument,
  type DocContent,
  editDocAt,
  readDocContent,
  revertChange,
  vetUpdate,
} from './draft-crdt.doc'
import { DraftCrdtRepository } from './draft-crdt.repository'

const COMPACT_THRESHOLD = 100
const MAX_UPDATE_BYTES = 4 * 1024 * 1024

const EMPTY_STATE = JSON.stringify({
  root: {
    children: [],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

interface Session {
  branch: DraftBranchRow
  doc: LoroDoc
  document: ContentDocumentRow
  row: CrdtDocRow
}

export interface CrdtChange {
  deps: OpId[]
  id: OpId
  lamport: number
  message: string | undefined
  timestamp: number
}

export type CrdtCheckpoint = Pick<
  ContentRevisionRow,
  | 'contentFormat'
  | 'createdAt'
  | 'frontiers'
  | 'id'
  | 'kind'
  | 'parentRevisionId'
  | 'title'
>

export interface CrdtHistory {
  changes: CrdtChange[]
  checkpoints: CrdtCheckpoint[]
}

export interface DocumentChange {
  documentId: string
  origin?: string
  update: Uint8Array
}

export type DocumentResetReason = 'compacted' | 'deleted'

export interface DocumentReset {
  documentId: string
  reason: DocumentResetReason
}

export interface CheckpointResult {
  branch: DraftBranchRow
  revision: ContentRevisionRow
}

const fieldsOf = (snapshot: RevisionSnapshot): CrdtFields => ({
  meta: snapshot.meta,
  typeSpecificData: snapshot.typeSpecificData,
})

const sameBytes = (left: Uint8Array, right: Uint8Array) =>
  left.length === right.length && left.every((byte, i) => byte === right[i])

const changedKeys = (
  base: Record<string, unknown> | null,
  next: Record<string, unknown> | null,
): Record<string, unknown> | undefined => {
  const patch: Record<string, unknown> = {}
  for (const key of new Set([
    ...Object.keys(base ?? {}),
    ...Object.keys(next ?? {}),
  ])) {
    const value = next?.[key] ?? null
    if (JSON.stringify(base?.[key] ?? null) !== JSON.stringify(value)) {
      patch[key] = value
    }
  }
  return Object.keys(patch).length ? patch : undefined
}

@Injectable()
export class DraftCrdtService {
  private readonly logger = new Logger(DraftCrdtService.name)
  private readonly changeListeners = new Set<(change: DocumentChange) => void>()
  private readonly resetListeners = new Set<(reset: DocumentReset) => void>()

  constructor(
    private readonly drafts: DraftRepository,
    private readonly crdt: DraftCrdtRepository,
    private readonly fileReferences: FileReferenceService,
  ) {}

  onDocumentChanged(listener: (change: DocumentChange) => void) {
    this.changeListeners.add(listener)
    return () => {
      this.changeListeners.delete(listener)
    }
  }

  onDocumentReset(listener: (reset: DocumentReset) => void) {
    this.resetListeners.add(listener)
    return () => {
      this.resetListeners.delete(listener)
    }
  }

  announceReset(documentId: EntityId | string, reason: DocumentResetReason) {
    const reset = { documentId: String(documentId), reason }
    for (const listener of this.resetListeners) {
      try {
        listener(reset)
      } catch (error) {
        this.logger.warn(
          `document reset listener failed: ${(error as Error).message}`,
        )
      }
    }
  }

  async usesCrdt(branchId: EntityId | string): Promise<boolean> {
    const branch = await this.drafts.findBranchById(branchId)
    if (!branch) return false
    if (await this.crdt.findDoc(branch.documentId)) return true
    const head = await this.drafts.findRevisionById(branch.headRevisionId)
    return head?.contentFormat === ContentFormat.Lexical
  }

  async workingCopy(branchId: EntityId | string): Promise<DraftBranchRow> {
    return (await this.open(branchId)).branch
  }

  async workingCopyOfDocument(
    documentId: EntityId | string,
  ): Promise<DraftBranchRow | null> {
    const document = await this.drafts.findDocumentById(documentId)
    if (!document) return null
    if (!(await this.crdt.findDoc(document.id))) {
      const [candidate] = await this.drafts.findBranchesByDocument(document.id)
      const revisionId =
        candidate?.headRevisionId ?? document.publishedRevisionId
      if (!revisionId) return null
      const head = await this.drafts.findRevisionById(revisionId)
      if (head?.contentFormat !== ContentFormat.Lexical) return null
    }
    return (await this.openDocument(document)).branch
  }

  async exportUpdates(
    branchId: EntityId | string,
    since?: Uint8Array,
  ): Promise<Uint8Array> {
    return (await this.exportFor(branchId, since)).update
  }

  async exportFor(
    branchId: EntityId | string,
    since?: Uint8Array,
  ): Promise<{ documentId: string; update: Uint8Array }> {
    const { doc, document } = await this.open(branchId)
    const documentId = String(document.id)
    if (!since) return { documentId, update: doc.export({ mode: 'snapshot' }) }
    let from: VersionVector
    try {
      from = VersionVector.decode(since)
    } catch {
      return { documentId, update: doc.export({ mode: 'snapshot' }) }
    }
    if (!this.knowsRoot(doc, from)) {
      throw createAppException(AppErrorCode.DRAFT_CRDT_STALE, { documentId })
    }
    return { documentId, update: doc.export({ from, mode: 'update' }) }
  }

  async importUpdate(
    branchId: EntityId | string,
    bytes: Uint8Array,
    origin?: string,
    author?: string,
  ): Promise<{ branch: DraftBranchRow; document: ContentDocumentRow }> {
    const session = await this.open(branchId)
    if (bytes.length > MAX_UPDATE_BYTES) {
      this.reject(session.branch, 'update is too large')
    }
    try {
      vetUpdate(session.doc, bytes, { author })
    } catch (error) {
      this.reject(session.branch, (error as Error).message)
    }
    await this.append(session, bytes)
    this.notifyChanged(session.document.id, bytes, origin)
    return { branch: session.branch, document: session.document }
  }

  async createCheckpoint(
    branchId: EntityId | string,
    kind: Extract<CheckpointKind, 'publish' | 'save'>,
  ): Promise<CheckpointResult> {
    const session = await this.open(branchId)
    const head = await this.revision(session.branch.headRevisionId)
    const snapshot = this.materialize(session, readDocContent(session.doc))
    if (head.frontiers && sameRevisionContent(pickSnapshot(head), snapshot)) {
      return { branch: session.branch, revision: head }
    }
    return this.checkpoint(session, kind, snapshot)
  }

  async updateFields(
    branchId: EntityId | string,
    patch: CrdtFieldsPatch,
  ): Promise<CrdtFields> {
    const { document } = await this.open(branchId)
    return this.crdt.mergeFields(document.id, patch)
  }

  async mergeDocumentFields(
    documentId: EntityId | string,
    typeSpecificData: Record<string, unknown>,
  ): Promise<void> {
    if (!(await this.crdt.findDoc(documentId))) return
    await this.crdt.mergeFields(documentId, { typeSpecificData })
  }

  async legacyWrite(
    branchId: EntityId | string,
    baseRevisionId: EntityId | string | null,
    snapshot: RevisionSnapshot,
  ): Promise<CheckpointResult> {
    return this.mutate(branchId, async (session) => {
      if (snapshot.contentFormat !== ContentFormat.Lexical) {
        throw createAppException(AppErrorCode.DRAFT_CRDT_FORMAT_UNSUPPORTED, {
          branchId: session.branch.id,
          contentFormat: snapshot.contentFormat,
        })
      }
      const base = baseRevisionId
        ? await this.revision(baseRevisionId, session.document.id)
        : null
      const target: DocContent = {
        content: snapshot.content ?? EMPTY_STATE,
        title: snapshot.title,
      }
      const writeFields = fieldsOf(snapshot)
      const message = `legacy-save ${base?.id ?? session.branch.headRevisionId}`
      const at = this.knownFrontiers(
        session.doc,
        base ? (base.frontiers ?? (await this.importedFrontiers(base))) : null,
      )

      const bytes = editDocAt(
        session.doc,
        at ?? session.doc.frontiers(),
        target,
        message,
      )
      let own: CheckpointInput
      if (at) {
        const fork = session.doc.forkAt(at)
        fork.import(bytes)
        own = {
          frontiers: fork.frontiers(),
          kind: 'legacy-save',
          snapshot: this.materialize(
            session,
            readDocContent(fork),
            writeFields,
          ),
        }
      } else {
        own = {
          frontiers: null,
          kind: 'legacy-save',
          snapshot: this.materialize(session, target, writeFields),
        }
      }

      await this.apply(session, bytes)
      const fields = await this.mergeChangedFields(
        session,
        base ? fieldsOf(base) : session.row.fields,
        writeFields,
      )
      const merged = this.materialize(
        session,
        readDocContent(session.doc),
        fields,
      )
      const inputs: CheckpointInput[] = sameRevisionContent(
        own.snapshot,
        merged,
      )
        ? [
            {
              frontiers: session.doc.frontiers(),
              kind: 'legacy-save',
              snapshot: merged,
            },
          ]
        : [
            own,
            {
              frontiers: session.doc.frontiers(),
              kind: 'legacy-save',
              snapshot: merged,
            },
          ]
      const { branch, revisions } = await this.appendCheckpoints(
        session,
        inputs,
      )
      return { branch, revision: revisions[0] }
    })
  }

  async restore(
    branchId: EntityId | string,
    revisionId: EntityId | string,
  ): Promise<CheckpointResult> {
    return this.mutate(branchId, (session) =>
      this.restoreIn(session, revisionId),
    )
  }

  async undo(
    branchId: EntityId | string,
    id: OpId,
    before: OpId[],
  ): Promise<CheckpointResult> {
    return this.mutate(branchId, async (session) => {
      try {
        session.doc.getChangeAt(id)
      } catch {
        this.reject(session.branch, 'unknown change')
      }
      await this.apply(
        session,
        revertChange(session.doc, id, before, `undo ${id.peer}@${id.counter}`),
      )
      return this.checkpoint(
        session,
        'undo',
        this.materialize(session, readDocContent(session.doc)),
      )
    })
  }

  async history(branchId: EntityId | string): Promise<CrdtHistory> {
    const { doc, document } = await this.open(branchId)
    const checkpoints = (await this.drafts.findRevisionsByDocument(document.id))
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          Number(BigInt(right.id) - BigInt(left.id)),
      )
      .map((revision): CrdtCheckpoint => ({
        contentFormat: revision.contentFormat,
        createdAt: revision.createdAt,
        frontiers: revision.frontiers ?? null,
        id: revision.id,
        kind: revision.kind ?? null,
        parentRevisionId: revision.parentRevisionId,
        title: revision.title,
      }))
    const changes = [...doc.getAllChanges().values()]
      .flat()
      .sort((left, right) => right.lamport - left.lamport)
      .map((change) => ({
        deps: change.deps,
        id: { counter: change.counter + change.length - 1, peer: change.peer },
        lamport: change.lamport,
        message: change.message,
        timestamp: change.timestamp,
      }))
    return { changes, checkpoints }
  }

  private async open(
    branchId: EntityId | string,
    locked = false,
  ): Promise<Session> {
    const requested = await this.drafts.findBranchById(branchId)
    if (!requested) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, {
        id: String(branchId),
      })
    }
    const document = await this.drafts.findDocumentById(requested.documentId)
    if (!document) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, {
        id: requested.id,
      })
    }
    return this.openDocument(document, locked)
  }

  private async openDocument(
    document: ContentDocumentRow,
    locked = false,
  ): Promise<Session> {
    let row = await this.crdt.findDoc(document.id)
    let branch = await this.ensureWorkingCopy(document, Boolean(row))
    if (!row) ({ branch, row } = await this.importDoc(document, branch))

    let updates = await this.crdt.findUpdates(document.id)
    // A compaction committed between the two reads has deleted rows our snapshot lacks.
    for (;;) {
      const current = await this.crdt.findDoc(document.id)
      if (!current || sameBytes(current.snapshotVersion, row.snapshotVersion)) {
        break
      }
      row = current
      updates = await this.crdt.findUpdates(document.id)
    }
    const doc = createDocument()
    doc.import(row.snapshot)
    if (updates.length) doc.importBatch(updates.map((update) => update.bytes))
    const session: Session = { branch, doc, document, row }

    const head = await this.revision(branch.headRevisionId)
    if (!head.frontiers && head.id !== row.syncedRevisionId) {
      if (!locked) {
        return this.crdt.withDocumentLock(document.id, () =>
          this.openDocument(document, true),
        )
      }
      await this.reconcile(session, head)
    }
    if (updates.length >= COMPACT_THRESHOLD) {
      void this.compact(
        session,
        updates.map((update) => update.id),
      )
    }
    return session
  }

  private mutate<T>(
    branchId: EntityId | string,
    run: (session: Session) => Promise<T>,
  ): Promise<T> {
    return this.drafts.findBranchById(branchId).then((branch) => {
      if (!branch) {
        throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, {
          id: String(branchId),
        })
      }
      return this.crdt.withDocumentLock(branch.documentId, async () =>
        run(await this.open(branchId, true)),
      )
    })
  }

  private async ensureWorkingCopy(
    document: ContentDocumentRow,
    imported: boolean,
  ): Promise<DraftBranchRow> {
    const active = await this.drafts.findBranchesByDocument(document.id)
    if (active.length) {
      const [keep, ...rest] = active
      if (!imported) await this.assertLexical(keep)
      for (const branch of rest) await this.retire(document, branch)
      return keep
    }
    if (!document.publishedRevisionId) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, {
        id: document.id,
      })
    }
    const published = await this.revision(document.publishedRevisionId)
    const { branch } = await this.drafts.createBranch(
      document.id,
      published.id,
      pickSnapshot(published),
      true,
    )
    if (!imported) await this.assertLexical(branch)
    return branch
  }

  private async assertLexical(branch: DraftBranchRow) {
    const head = await this.revision(branch.headRevisionId)
    if (head.contentFormat !== ContentFormat.Lexical) {
      throw createAppException(AppErrorCode.DRAFT_CRDT_FORMAT_UNSUPPORTED, {
        branchId: branch.id,
        contentFormat: head.contentFormat,
      })
    }
  }

  private async retire(document: ContentDocumentRow, branch: DraftBranchRow) {
    await this.drafts.archiveBranch(branch.id)
    const share = await this.drafts.findShareByDocument(document.id)
    if (share?.mode === 'follow' && share.draftId === branch.id) {
      await this.drafts.upsertShare(document.id, share.token, {
        mode: 'pinned',
        revisionId: branch.headRevisionId,
      })
    }
    await this.fileReferences.removeReferencesForDocument(
      branch.id,
      FileReferenceType.Draft,
    )
  }

  private async importDoc(
    document: ContentDocumentRow,
    branch: DraftBranchRow,
  ): Promise<{ branch: DraftBranchRow; row: CrdtDocRow }> {
    const head = await this.revision(branch.headRevisionId)
    const doc = createContentDoc(
      { content: head.content ?? EMPTY_STATE, title: head.title },
      `import ${head.id}`,
    )
    const snapshot = doc.export({ mode: 'snapshot' })
    const fields = fieldsOf(head)
    const row = await this.crdt.createDoc({
      documentId: document.id,
      fields,
      snapshot,
      snapshotVersion: doc.oplogVersion().encode(),
      syncedRevisionId: head.id,
    })
    if (!sameBytes(row.snapshot, snapshot)) return { branch, row }

    const { branch: moved, revisions } = await this.crdt.appendCheckpoints(
      branch.id,
      [
        {
          frontiers: doc.frontiers(),
          kind: 'import',
          snapshot: this.materializeFor(
            document.refType,
            readDocContent(doc),
            fields,
          ),
        },
      ],
    )
    await this.crdt.setSyncedRevision(document.id, revisions[0].id)
    return {
      branch: moved,
      row: { ...row, syncedRevisionId: revisions[0].id },
    }
  }

  private async reconcile(session: Session, head: ContentRevisionRow) {
    if (head.contentFormat !== ContentFormat.Lexical) {
      this.logger.warn(
        `Skipping non-Lexical legacy head ${head.id} on CRDT document ${session.document.id}`,
      )
      return
    }
    const synced = session.row.syncedRevisionId
      ? await this.drafts.findRevisionById(session.row.syncedRevisionId)
      : null
    await this.apply(
      session,
      editDocAt(
        session.doc,
        this.knownFrontiers(session.doc, synced?.frontiers) ??
          session.doc.frontiers(),
        { content: head.content ?? EMPTY_STATE, title: head.title },
        `legacy-save ${head.id}`,
      ),
    )
    const fields = await this.mergeChangedFields(
      session,
      synced ? fieldsOf(synced) : session.row.fields,
      fieldsOf(head),
    )
    const { branch } = await this.appendCheckpoints(session, [
      {
        frontiers: session.doc.frontiers(),
        kind: 'legacy-save',
        snapshot: this.materialize(
          session,
          readDocContent(session.doc),
          fields,
        ),
      },
    ])
    session.branch = branch
  }

  private async restoreIn(
    session: Session,
    revisionId: EntityId | string,
  ): Promise<CheckpointResult> {
    const revision = await this.revision(revisionId, session.document.id)
    if (revision.contentFormat !== ContentFormat.Lexical) {
      throw createAppException(AppErrorCode.DRAFT_CRDT_FORMAT_UNSUPPORTED, {
        branchId: session.branch.id,
        contentFormat: revision.contentFormat,
      })
    }
    await this.apply(
      session,
      editDocAt(
        session.doc,
        session.doc.frontiers(),
        { content: revision.content ?? EMPTY_STATE, title: revision.title },
        `restore ${revision.id}`,
      ),
    )
    const fields = fieldsOf(revision)
    await this.crdt.replaceFields(session.document.id, fields)
    session.row = { ...session.row, fields }
    return this.checkpoint(
      session,
      'restore',
      this.materialize(session, readDocContent(session.doc), fields),
    )
  }

  private async append(session: Session, bytes: Uint8Array) {
    try {
      await this.crdt.appendUpdate(
        session.document.id,
        bytes,
        session.document.crdtEpoch,
      )
    } catch (error) {
      if ((error as Error).message !== 'CRDT_EPOCH_CHANGED') throw error
      this.reject(session.branch, 'the document was rebuilt')
    }
  }

  private async apply(session: Session, bytes: Uint8Array) {
    await this.append(session, bytes)
    session.doc.import(bytes)
    this.notifyChanged(session.document.id, bytes)
  }

  private notifyChanged(
    documentId: EntityId | string,
    update: Uint8Array,
    origin?: string,
  ) {
    const change = { documentId: String(documentId), origin, update }
    for (const listener of this.changeListeners) {
      try {
        listener(change)
      } catch (error) {
        this.logger.warn(
          `document change listener failed: ${(error as Error).message}`,
        )
      }
    }
  }

  private async checkpoint(
    session: Session,
    kind: CheckpointKind,
    snapshot: RevisionSnapshot,
  ): Promise<CheckpointResult> {
    const { branch, revisions } = await this.appendCheckpoints(session, [
      { frontiers: session.doc.frontiers(), kind, snapshot },
    ])
    return { branch, revision: revisions[0] }
  }

  private async appendCheckpoints(session: Session, inputs: CheckpointInput[]) {
    const result = await this.crdt.appendCheckpoints(session.branch.id, inputs)
    const head = result.revisions.at(-1)!
    await this.crdt.setSyncedRevision(session.document.id, head.id)
    session.row = { ...session.row, syncedRevisionId: head.id }
    await this.fileReferences.updateReferencesForDocument(
      head,
      result.branch.id,
      FileReferenceType.Draft,
    )
    return result
  }

  private async mergeChangedFields(
    session: Session,
    base: CrdtFields | null,
    next: CrdtFields,
  ): Promise<CrdtFields> {
    const patch: CrdtFieldsPatch = {
      meta: changedKeys(base?.meta ?? null, next.meta),
      typeSpecificData: changedKeys(
        base?.typeSpecificData ?? null,
        next.typeSpecificData,
      ),
    }
    const current = session.row.fields ?? { meta: null, typeSpecificData: null }
    if (!patch.meta && !patch.typeSpecificData) return current
    const fields = await this.crdt.mergeFields(session.document.id, patch)
    session.row = { ...session.row, fields }
    return fields
  }

  private async compact(session: Session, foldedIds: EntityId[]) {
    try {
      await this.crdt.compact(session.document.id, {
        expectedVersion: session.row.snapshotVersion,
        foldedIds,
        snapshot: session.doc.export({ mode: 'snapshot' }),
        snapshotVersion: session.doc.oplogVersion().encode(),
      })
    } catch (error) {
      this.logger.warn(
        `Compaction of ${session.document.id} failed: ${(error as Error).message}`,
      )
    }
  }

  // A legacy revision has no version of its own, but the import checkpoint made from it does.
  private async importedFrontiers(revision: ContentRevisionRow) {
    const checkpoints = await this.drafts.findRevisionsByDocument(
      revision.documentId,
    )
    return (
      checkpoints.find(
        (row) => row.kind === 'import' && row.parentRevisionId === revision.id,
      )?.frontiers ?? null
    )
  }

  // A rebuilt document starts from a new root change; a client that never saw it holds another lineage.
  private knowsRoot(doc: LoroDoc, from: VersionVector) {
    for (const peer of doc.oplogVersion().toJSON().keys()) {
      const first = doc.getChangeAt({ counter: 0, peer })
      if (!first.deps.length && !from.get(peer)) return false
    }
    return true
  }

  private knownFrontiers(
    doc: LoroDoc,
    frontiers: CheckpointInput['frontiers'] | undefined,
  ) {
    if (!frontiers?.length) return null
    try {
      doc.frontiersToVV(frontiers)
      return frontiers
    } catch {
      return null
    }
  }

  private materialize(
    session: Session,
    content: DocContent,
    fields: CrdtFields | null = session.row.fields,
  ): RevisionSnapshot {
    return this.materializeFor(session.document.refType, content, fields)
  }

  private materializeFor(
    refType: DraftRefType,
    content: DocContent,
    fields: CrdtFields | null,
  ): RevisionSnapshot {
    return canonicalSnapshot(refType, {
      content: content.content,
      contentFormat: ContentFormat.Lexical,
      images: null,
      meta: fields?.meta ?? null,
      text: mxLexicalToMarkdown(content.content),
      title: content.title,
      typeSpecificData: fields?.typeSpecificData ?? null,
    })
  }

  private async revision(
    id: EntityId | string,
    documentId?: EntityId,
  ): Promise<ContentRevisionRow> {
    const revision = await this.drafts.findRevisionById(id)
    if (!revision || (documentId && revision.documentId !== documentId)) {
      throw createAppException(AppErrorCode.CONTENT_REVISION_NOT_FOUND, {
        id: String(id),
      })
    }
    return revision
  }

  private reject(branch: DraftBranchRow, reason: string): never {
    throw createAppException(AppErrorCode.DRAFT_CRDT_UPDATE_REJECTED, {
      branchId: branch.id,
      reason,
    })
  }
}
