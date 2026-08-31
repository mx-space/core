import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { FileReferenceType } from '~/modules/file/file-reference.enum'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { DatabaseService } from '~/processors/database/database.service'
import type { EntityId } from '~/shared/id/entity-id'

import { DraftRefType } from './draft.enum'
import { DraftRepository } from './draft.repository'
import type { CreateDraftDto, UpdateDraftDto } from './draft.schema'
import type {
  ContentDocumentRow,
  ContentPublicationEventRow,
  ContentRevisionRow,
  DraftBranchRow,
  DraftBranchView,
  DraftListFilter,
  RevisionComparison,
  RevisionSnapshot,
  VersionContext,
  VersionTreeNode,
} from './draft.types'
import { canonicalSnapshot, sameRevisionContent } from './draft-content'

const projectVersionTree = (
  document: ContentDocumentRow,
  branches: DraftBranchRow[],
  revisions: ContentRevisionRow[],
  publicationEvents: ContentPublicationEventRow[],
): VersionTreeNode[] => {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]))
  const endpoints = new Set<EntityId>()
  if (document.publishedRevisionId) endpoints.add(document.publishedRevisionId)
  for (const branch of branches) endpoints.add(branch.headRevisionId)
  for (const event of publicationEvents) {
    endpoints.add(event.revisionId)
    if (event.previousRevisionId) endpoints.add(event.previousRevisionId)
  }

  const reachable = new Set<EntityId>()
  for (const endpoint of endpoints) {
    let revision = byId.get(endpoint)
    while (revision && !reachable.has(revision.id)) {
      reachable.add(revision.id)
      revision = revision.parentRevisionId
        ? byId.get(revision.parentRevisionId)
        : undefined
    }
  }

  const children = new Map<EntityId, EntityId[]>()
  for (const revision of revisions) {
    if (!reachable.has(revision.id) || !revision.parentRevisionId) continue
    const siblings = children.get(revision.parentRevisionId) ?? []
    siblings.push(revision.id)
    children.set(revision.parentRevisionId, siblings)
  }

  const visible = new Set(endpoints)
  for (const branch of branches) visible.add(branch.baseRevisionId)
  for (const revisionId of reachable) {
    const revision = byId.get(revisionId)
    if (
      !revision?.parentRevisionId ||
      (children.get(revisionId)?.length ?? 0) > 1
    ) {
      visible.add(revisionId)
    }
  }

  const baseIds = new Map<EntityId, EntityId[]>()
  const headIds = new Map<EntityId, EntityId[]>()
  for (const branch of branches) {
    baseIds.set(branch.baseRevisionId, [
      ...(baseIds.get(branch.baseRevisionId) ?? []),
      branch.id,
    ])
    headIds.set(branch.headRevisionId, [
      ...(headIds.get(branch.headRevisionId) ?? []),
      branch.id,
    ])
  }

  const publishedAt = new Map<EntityId, Date>()
  for (const event of publicationEvents) {
    publishedAt.set(event.revisionId, event.createdAt)
    if (
      event.previousRevisionId &&
      !publishedAt.has(event.previousRevisionId)
    ) {
      const previous = byId.get(event.previousRevisionId)
      if (previous) publishedAt.set(previous.id, previous.createdAt)
    }
  }
  if (
    document.publishedRevisionId &&
    !publishedAt.has(document.publishedRevisionId)
  ) {
    const published = byId.get(document.publishedRevisionId)
    if (published) publishedAt.set(published.id, published.createdAt)
  }

  // ponytail: scan one document in memory; move this projection into SQL only if
  // a real document grows beyond a few thousand revisions.
  return revisions.flatMap((revision) => {
    if (!visible.has(revision.id) || !reachable.has(revision.id)) return []
    let parentId = revision.parentRevisionId
    let collapsedRevisionCount = 0
    while (parentId && !visible.has(parentId)) {
      collapsedRevisionCount += 1
      parentId = byId.get(parentId)?.parentRevisionId ?? null
    }
    return [
      {
        branchBaseIds: baseIds.get(revision.id) ?? [],
        branchHeadIds: headIds.get(revision.id) ?? [],
        collapsedRevisionCount,
        parentNodeId: parentId,
        publishedAt: publishedAt.get(revision.id) ?? null,
        revision,
      },
    ]
  })
}

@Injectable()
export class DraftService {
  constructor(
    private readonly draftRepository: DraftRepository,
    private readonly fileReferenceService: FileReferenceService,
    private readonly databaseService: DatabaseService,
  ) {}

  get repository() {
    return this.draftRepository
  }

  async list(page: number, size: number, filter: DraftListFilter = {}) {
    const result = await this.draftRepository.list(page, size, filter)
    return {
      ...result,
      data: await Promise.all(
        result.data.map((branch) => this.hydrate(branch)),
      ),
    }
  }

  count(filter: DraftListFilter = {}) {
    return this.draftRepository.count(filter)
  }

  async getContext(
    refType: DraftRefType,
    refId: string,
  ): Promise<VersionContext> {
    const document = await this.ensurePublishedDocument(refType, refId)
    return this.contextForDocument(document)
  }

  async create(dto: CreateDraftDto): Promise<DraftBranchView> {
    const snapshot = canonicalSnapshot(dto.refType as DraftRefType, dto.data)
    let document: ContentDocumentRow
    let base: ContentRevisionRow

    if (dto.baseRevisionId) {
      const revision = await this.draftRepository.findRevisionById(
        dto.baseRevisionId,
      )
      if (!revision) {
        throw createAppException(AppErrorCode.CONTENT_REVISION_NOT_FOUND, {
          id: dto.baseRevisionId,
        })
      }
      const foundDocument = await this.draftRepository.findDocumentById(
        revision.documentId,
      )
      if (!foundDocument || foundDocument.refType !== dto.refType) {
        throw createAppException(AppErrorCode.CONTENT_REVISION_NOT_FOUND, {
          id: dto.baseRevisionId,
        })
      }
      if (dto.refId && foundDocument.refId !== dto.refId) {
        throw createAppException(AppErrorCode.CONTENT_REVISION_NOT_FOUND, {
          id: dto.baseRevisionId,
        })
      }
      document = foundDocument
      base = revision
    } else if (dto.refId) {
      document = await this.ensurePublishedDocument(
        dto.refType as DraftRefType,
        dto.refId,
      )
      if (!document.publishedRevisionId) {
        throw createAppException(AppErrorCode.CONTENT_REVISION_NOT_FOUND, {
          id: document.id,
        })
      }
      const published = await this.draftRepository.findRevisionById(
        document.publishedRevisionId,
      )
      if (!published) {
        throw createAppException(AppErrorCode.CONTENT_REVISION_NOT_FOUND, {
          id: document.publishedRevisionId,
        })
      }
      base = published
    } else {
      const created = await this.draftRepository.createDocumentWithRoot(
        dto.refType as DraftRefType,
        null,
        snapshot,
        false,
      )
      document = created.document
      base = created.revision
    }

    const created = await this.draftRepository.createBranch(
      document.id,
      base.id,
      snapshot,
      sameRevisionContent(base, snapshot),
    )
    await this.fileReferenceService.updateReferencesForDocument(
      created.headRevision,
      created.branch.id,
      FileReferenceType.Draft,
    )
    return this.hydrate(created.branch)
  }

  async update(id: string, dto: UpdateDraftDto): Promise<DraftBranchView> {
    const branch = await this.draftRepository.findBranchById(id)
    if (!branch) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, { id })
    }
    const document = await this.draftRepository.findDocumentById(
      branch.documentId,
    )
    if (!document) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, { id })
    }
    const snapshot = canonicalSnapshot(document.refType, dto.data)
    const result = await this.draftRepository.saveBranch(
      id,
      dto.expectedHeadRevisionId,
      snapshot,
    )
    if (result.kind === 'missing') {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, { id })
    }
    if (result.kind === 'conflict') {
      throw createAppException(AppErrorCode.DRAFT_HEAD_CONFLICT, {
        actualHeadRevisionId: result.actualHeadRevisionId,
        branchId: id,
        expectedHeadRevisionId: dto.expectedHeadRevisionId,
      })
    }
    await this.fileReferenceService.updateReferencesForDocument(
      result.headRevision,
      result.branch.id,
      FileReferenceType.Draft,
    )
    return this.hydrate(result.branch)
  }

  async findById(id: string): Promise<DraftBranchView | null> {
    const branch = await this.draftRepository.findBranchById(id)
    return branch ? this.hydrate(branch) : null
  }

  async findRevisionById(id: string): Promise<ContentRevisionRow> {
    const revision = await this.draftRepository.findRevisionById(id)
    if (!revision) {
      throw createAppException(AppErrorCode.CONTENT_REVISION_NOT_FOUND, { id })
    }
    return revision
  }

  async findNewDrafts(refType: DraftRefType): Promise<DraftBranchView[]> {
    const result = await this.draftRepository.list(1, 50, {
      hasRef: false,
      refType,
    })
    return Promise.all(result.data.map((branch) => this.hydrate(branch)))
  }

  async getBranchRevisions(id: string): Promise<ContentRevisionRow[]> {
    const branch = await this.draftRepository.findBranchById(id)
    if (!branch) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, { id })
    }
    const ancestry = await this.draftRepository.findAncestryIds(
      branch.headRevisionId,
    )
    const revisions = await this.draftRepository.findRevisionsByIds(ancestry)
    const byId = new Map(revisions.map((revision) => [revision.id, revision]))
    return ancestry.flatMap((revisionId) => {
      const revision = byId.get(revisionId)
      return revision ? [revision] : []
    })
  }

  async compare(leftId: string, rightId: string): Promise<RevisionComparison> {
    const [left, right] = await Promise.all([
      this.draftRepository.findRevisionById(leftId),
      this.draftRepository.findRevisionById(rightId),
    ])
    if (!left) {
      throw createAppException(AppErrorCode.CONTENT_REVISION_NOT_FOUND, {
        id: leftId,
      })
    }
    if (!right || left.documentId !== right.documentId) {
      throw createAppException(AppErrorCode.CONTENT_REVISION_NOT_FOUND, {
        id: rightId,
      })
    }
    const [leftAncestry, rightAncestry] = await Promise.all([
      this.draftRepository.findAncestryIds(left.id),
      this.draftRepository.findAncestryIds(right.id),
    ])
    const leftSet = new Set(leftAncestry)
    const rightSet = new Set(rightAncestry)
    const relation =
      left.id === right.id
        ? 'same'
        : rightSet.has(left.id)
          ? 'ancestor'
          : leftSet.has(right.id)
            ? 'descendant'
            : 'diverged'
    return {
      commonAncestorRevisionId:
        leftAncestry.find((id) => rightSet.has(id)) ?? null,
      left,
      relation,
      right,
    }
  }

  async delete(id: string): Promise<void> {
    const branch = await this.draftRepository.archiveBranch(id)
    if (!branch) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, { id })
    }
    await this.fileReferenceService.removeReferencesForDocument(
      id,
      FileReferenceType.Draft,
    )
  }

  async deleteByRef(refType: DraftRefType, refId: string): Promise<void> {
    const document = await this.draftRepository.findDocumentByRef(
      refType,
      refId,
    )
    if (document) {
      const branches = await this.draftRepository.findBranchesByDocument(
        document.id,
      )
      await Promise.all(
        branches.map((branch) =>
          this.fileReferenceService.removeReferencesForDocument(
            branch.id,
            FileReferenceType.Draft,
          ),
        ),
      )
    }
    await this.draftRepository.deleteDocumentByRef(refType, refId)
  }

  async linkDocument(documentId: string, publishedId: string) {
    return this.draftRepository.linkDocument(documentId, publishedId)
  }

  async recordPublication(
    documentId: string,
    revisionId: string,
    expectedPublishedRevisionId: string | null,
  ) {
    return this.draftRepository.recordPublication(
      documentId,
      revisionId,
      expectedPublishedRevisionId,
    )
  }

  private async ensurePublishedDocument(
    refType: DraftRefType,
    refId: string,
  ): Promise<ContentDocumentRow> {
    const existing = await this.draftRepository.findDocumentByRef(
      refType,
      refId,
    )
    if (existing) return existing

    const found = await this.databaseService.findGlobalById(refId)
    if (!found || String(found.type) !== String(refType)) {
      throw createAppException(AppErrorCode.NO_CONTENT_MODIFIABLE)
    }
    const created = await this.draftRepository.createDocumentWithRoot(
      refType,
      refId,
      this.snapshotArticle(
        refType,
        found.document as unknown as Record<string, unknown>,
      ),
      true,
    )
    return created.document
  }

  private async contextForDocument(
    document: ContentDocumentRow,
  ): Promise<VersionContext> {
    const [publishedRevision, branches, revisions, publicationEvents] =
      await Promise.all([
        document.publishedRevisionId
          ? this.draftRepository.findRevisionById(document.publishedRevisionId)
          : Promise.resolve(null),
        this.draftRepository.findBranchesByDocument(document.id),
        this.draftRepository.findRevisionsByDocument(document.id),
        this.draftRepository.findPublicationEventsByDocument(document.id),
      ])
    return {
      branches: await Promise.all(
        branches.map((branch) => this.hydrate(branch)),
      ),
      document,
      publishedRevision,
      versionTree: projectVersionTree(
        document,
        branches,
        revisions,
        publicationEvents,
      ),
    }
  }

  private async hydrate(branch: DraftBranchRow): Promise<DraftBranchView> {
    const document = await this.draftRepository.findDocumentById(
      branch.documentId,
    )
    if (!document) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, { id: branch.id })
    }
    const [baseRevision, headRevision, publishedRevision] = await Promise.all([
      this.draftRepository.findRevisionById(branch.baseRevisionId),
      this.draftRepository.findRevisionById(branch.headRevisionId),
      document.publishedRevisionId
        ? this.draftRepository.findRevisionById(document.publishedRevisionId)
        : Promise.resolve(null),
    ])
    if (!baseRevision || !headRevision) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, { id: branch.id })
    }
    const comparison = publishedRevision
      ? await this.compare(publishedRevision.id, headRevision.id)
      : null
    return {
      ...branch,
      baseRevision,
      commonAncestorRevisionId: comparison?.commonAncestorRevisionId ?? null,
      document,
      headRevision,
      publishedRevision,
      relationToPublished: comparison?.relation ?? null,
    }
  }

  private snapshotArticle(
    refType: DraftRefType,
    article: Record<string, unknown>,
  ): RevisionSnapshot {
    const common = {
      content: (article.content as string | null) ?? null,
      contentFormat: (article.contentFormat as string) ?? 'markdown',
      images: (article.images as unknown[] | null) ?? null,
      meta: (article.meta as Record<string, unknown> | null) ?? null,
      text: (article.text as string) ?? '',
      title: (article.title as string) ?? '',
    }
    if (refType === DraftRefType.Post) {
      return canonicalSnapshot(refType, {
        ...common,
        typeSpecificData: {
          categoryId: article.categoryId,
          copyright: article.copyright,
          isPremium: article.isPremium,
          pin: Boolean(article.pinAt),
          pinOrder: article.pinOrder,
          relatedId: Array.isArray(article.related)
            ? article.related.map((item) => (item as { id: string }).id)
            : [],
          slug: article.slug,
          summary: article.summary,
          tags: article.tags,
        },
      })
    }
    if (refType === DraftRefType.Note) {
      return canonicalSnapshot(refType, {
        ...common,
        typeSpecificData: {
          bookmark: article.bookmark,
          coordinates: article.coordinates,
          location: article.location,
          mood: article.mood,
          publicAt: article.publicAt,
          slug: article.slug,
          topicId: article.topicId,
          weather: article.weather,
        },
      })
    }
    return canonicalSnapshot(refType, {
      ...common,
      typeSpecificData: {
        order: article.order,
        slug: article.slug,
        subtitle: article.subtitle,
      },
    })
  }
}
