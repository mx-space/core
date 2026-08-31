import {
  BadRequestException,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
  TaskQueueService,
  TaskStatus,
} from '~/processors/task-queue'
import { parseEntityId } from '~/shared/id/entity-id'
import { ContentFormat } from '~/shared/types/content-format.type'
import { createAbortError, throwIfAborted } from '~/utils/abort.util'

import { AiTaskService } from '../ai/ai-task/ai-task.service'
import { ContentMigrationService } from '../content-migration/content-migration.service'
import { DraftRefType } from '../draft/draft.enum'
import { DraftService } from '../draft/draft.service'
import { NoteService } from '../note/note.service'
import type { NoteModel } from '../note/note.types'
import { PageService } from '../page/page.service'
import type { PageModel } from '../page/page.types'
import { PostService } from '../post/post.service'
import type { PostModel } from '../post/post.types'
import type { CreatePublishJobDto } from './publish.schema'
import {
  CONTENT_PUBLISH_TASK,
  type PublishAiResource,
  type PublishTaskPayload,
  type PublishTaskResult,
} from './publish.types'

const TERMINAL = new Set([
  TaskStatus.Completed,
  TaskStatus.PartialFailed,
  TaskStatus.Failed,
  TaskStatus.Cancelled,
])

@Injectable()
export class PublishService implements OnModuleInit {
  constructor(
    private readonly drafts: DraftService,
    private readonly posts: PostService,
    private readonly notes: NoteService,
    private readonly pages: PageService,
    private readonly contentMigrations: ContentMigrationService,
    private readonly aiTasks: AiTaskService,
    private readonly tasks: TaskQueueService,
    private readonly processor: TaskQueueProcessor,
  ) {}

  onModuleInit() {
    this.processor.registerHandler<PublishTaskPayload>({
      type: CONTENT_PUBLISH_TASK,
      execute: (payload, context) => this.execute(payload, context),
      buildRetryTask: (task) => ({
        type: CONTENT_PUBLISH_TASK,
        payload: task.payload as Record<string, unknown>,
        dedupKey: this.dedupTarget(
          task.payload as unknown as PublishTaskPayload,
        ),
        scope: 'content',
      }),
    })
  }

  async create(dto: CreatePublishJobDto) {
    const branch = await this.drafts.findById(dto.branchId)
    if (!branch) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, {
        id: dto.branchId,
      })
    }
    if (branch.headRevisionId !== dto.revisionId) {
      throw createAppException(AppErrorCode.DRAFT_HEAD_CONFLICT, {
        actualHeadRevisionId: branch.headRevisionId,
        branchId: branch.id,
        expectedHeadRevisionId: dto.revisionId,
      })
    }
    const actualPublishedRevisionId = branch.document.publishedRevisionId
    if (actualPublishedRevisionId !== dto.expectedPublishedRevisionId) {
      throw createAppException(AppErrorCode.PUBLISHED_REVISION_CHANGED, {
        actualPublishedRevisionId,
        documentId: branch.documentId,
        expectedPublishedRevisionId: dto.expectedPublishedRevisionId,
      })
    }
    if (
      branch.relationToPublished &&
      ['descendant', 'diverged'].includes(branch.relationToPublished) &&
      !dto.confirmDiverged
    ) {
      throw new BadRequestException(
        'Publishing this revision requires divergent-publication confirmation',
      )
    }

    const existing = branch.document.refId
      ? await this.findArticle(branch.document.refType, branch.document.refId)
      : null
    const online =
      existing && 'isPublished' in existing
        ? existing.isPublished !== false
        : Boolean(existing)
    let migration: PublishTaskPayload['migration']
    if (
      existing?.contentFormat === ContentFormat.Markdown &&
      branch.headRevision.contentFormat === ContentFormat.Lexical
    ) {
      const result = await this.contentMigrations.dryRunMarkdownToLexical({
        branchId: branch.id,
        profile: 'yohaku-v1',
        refId: existing.id,
        refType: branch.document.refType,
        sourceText: existing.text ?? '',
      })
      if (
        result.status !== 'convertible' ||
        result.source.status !== 'convertible'
      ) {
        throw new BadRequestException(
          'Markdown-to-Lexical migration is blocked',
        )
      }
      migration = {
        converterVersion: result.converterVersion,
        preconditions: result.preconditions.map((item) => ({
          ...item,
          headRevisionId: item.headRevisionId
            ? parseEntityId(item.headRevisionId)
            : undefined,
          id: parseEntityId(item.id),
        })),
        profile: result.profile,
        sourceHash: result.sourceHash,
        sourceMarkdown: existing.text ?? '',
      }
    }
    const payload: PublishTaskPayload = {
      aiResources: [...new Set(dto.aiResources)],
      branchId: branch.id,
      documentId: branch.documentId,
      expectedPublishedRevisionId: dto.expectedPublishedRevisionId,
      migration,
      operation: !existing
        ? 'first-publish'
        : online
          ? 'online-update'
          : 'republish',
      refId: branch.document.refId,
      refType: branch.document.refType,
      revisionId: branch.headRevision.id,
      snapshot: structuredClone(branch.headRevision),
    }

    return this.tasks.createTask({
      type: CONTENT_PUBLISH_TASK,
      payload: payload as unknown as Record<string, unknown>,
      dedupKey: this.dedupTarget(payload),
      scope: 'content',
    })
  }

  private async execute(
    payload: PublishTaskPayload,
    context: TaskExecuteContext,
  ) {
    throwIfAborted(context.signal)
    await this.assertFrozenSelection(payload)
    await context.updateProgress(2, 'Saving article snapshot', 0, 2)

    const committed = await this.commitSnapshot(payload)
    const result: PublishTaskResult = {
      articleCommitted: committed.wasPublished,
      articleId: committed.id,
      newerDraftChanges: false,
      publishedRevisionId: payload.revisionId,
      resources: {},
    }
    if (committed.wasPublished) {
      await this.commitPublicationPointer(payload)
    }
    await context.setResult(result)

    try {
      await this.prepareResources(
        payload.aiResources,
        committed.id,
        result,
        context,
      )
    } catch (error) {
      result.newerDraftChanges = await this.hasNewerBranchHead(payload)
      await context.setResult(result)
      if ((error as Error).name === 'AbortError') {
        await this.cancelResourceTasks(result.resources)
      }
      throw error
    }

    throwIfAborted(context.signal)
    if (!committed.wasPublished) {
      await context.updateProgress(95, 'Publishing article', 1, 2)
      await this.setPublished(payload.refType, committed.id)
      await this.commitPublicationPointer(payload)
      result.articleCommitted = true
    }

    result.newerDraftChanges = await this.hasNewerBranchHead(payload)
    await context.setResult(result)
    await context.updateProgress(100, 'Published', 2, 2)
  }

  private async assertFrozenSelection(payload: PublishTaskPayload) {
    const branch = await this.drafts.findById(payload.branchId)
    if (!branch) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, {
        id: payload.branchId,
      })
    }
    if (
      branch.documentId !== payload.documentId ||
      branch.document.publishedRevisionId !==
        payload.expectedPublishedRevisionId
    ) {
      throw createAppException(AppErrorCode.PUBLISHED_REVISION_CHANGED, {
        actualPublishedRevisionId: branch.document.publishedRevisionId,
        documentId: payload.documentId,
        expectedPublishedRevisionId: payload.expectedPublishedRevisionId,
      })
    }
    payload.refId = branch.document.refId
  }

  private async commitPublicationPointer(payload: PublishTaskPayload) {
    const recorded = await this.drafts.recordPublication(
      payload.documentId,
      payload.revisionId,
      payload.expectedPublishedRevisionId,
    )
    if (recorded.kind === 'conflict') {
      throw createAppException(AppErrorCode.PUBLISHED_REVISION_CHANGED, {
        actualPublishedRevisionId: recorded.actualPublishedRevisionId,
        documentId: payload.documentId,
        expectedPublishedRevisionId: payload.expectedPublishedRevisionId,
      })
    }
    if (recorded.kind === 'missing') {
      throw createAppException(AppErrorCode.CONTENT_REVISION_NOT_FOUND, {
        id: payload.revisionId,
      })
    }
  }

  private async commitSnapshot(payload: PublishTaskPayload) {
    const existing = payload.refId
      ? await this.findArticle(payload.refType, payload.refId)
      : null
    const wasPublished =
      existing && 'isPublished' in existing
        ? existing.isPublished !== false
        : Boolean(existing)
    const data = {
      ...this.articleData(payload, existing),
      ...(payload.migration && existing?.contentFormat === 'markdown'
        ? {
            migration: payload.migration,
            migrationBranchId: payload.branchId,
          }
        : {}),
    }

    let saved: PostModel | NoteModel | PageModel | undefined | null
    if (payload.refType === DraftRefType.Post) {
      saved = existing
        ? await this.posts.updateById(existing.id, data as Partial<PostModel>)
        : await this.posts.create({
            ...(data as PostModel),
            isPublished: false,
          })
    } else if (payload.refType === DraftRefType.Note) {
      saved = existing
        ? await this.notes.updateById(existing.id, data as Partial<NoteModel>)
        : await this.notes.create({
            ...(data as NoteModel),
            isPublished: false,
          })
    } else if (existing) {
      await this.pages.updateById(existing.id, data as Partial<PageModel>)
      saved = await this.pages.findById(existing.id)
    } else {
      saved = await this.pages.create(data as PageModel)
    }
    if (!saved && existing) {
      saved = await this.findArticle(payload.refType, existing.id)
    }
    if (!saved) throw createAppException(AppErrorCode.NO_CONTENT_MODIFIABLE)

    if (!payload.refId) {
      await this.drafts.linkDocument(payload.documentId, saved.id)
      payload.refId = saved.id
    }
    return { id: String(saved.id), wasPublished }
  }

  private articleData(
    payload: PublishTaskPayload,
    existing: PostModel | NoteModel | PageModel | null,
  ) {
    const snapshot = payload.snapshot
    const typeSpecificData = { ...snapshot.typeSpecificData }
    if (payload.refType === DraftRefType.Post && 'pin' in typeSpecificData) {
      const pin = Boolean(typeSpecificData.pin)
      delete typeSpecificData.pin
      typeSpecificData.pinAt = pin
        ? existing && 'pinAt' in existing
          ? existing.pinAt || new Date()
          : new Date()
        : null
    }
    return {
      ...typeSpecificData,
      content: snapshot.content ?? undefined,
      contentFormat: snapshot.contentFormat,
      images: snapshot.images ?? undefined,
      meta: snapshot.meta,
      text: snapshot.text,
      title: snapshot.title,
    }
  }

  private async prepareResources(
    resources: PublishAiResource[],
    refId: string,
    result: PublishTaskResult,
    context: TaskExecuteContext,
  ) {
    if (!resources.length) return
    await context.updateProgress(
      10,
      'Preparing AI resources',
      0,
      resources.length,
    )

    for (const resource of resources) {
      throwIfAborted(context.signal)
      const created = await this.createResourceTask(resource, refId)
      result.resources[resource] = created.taskId
    }
    await context.setResult(result)

    let completed = 0
    for (const resource of resources) {
      const taskId = result.resources[resource]!
      const task = await this.waitForTask(taskId, context.signal)
      if (task.status !== TaskStatus.Completed) {
        throw new Error(
          `${resource} preparation ended with ${task.status}${task.error ? `: ${task.error}` : ''}`,
        )
      }
      completed++
      await context.updateProgress(
        10 + Math.round((completed / resources.length) * 80),
        `Prepared ${completed}/${resources.length}`,
        completed,
        resources.length,
      )
    }
  }

  private createResourceTask(resource: PublishAiResource, refId: string) {
    switch (resource) {
      case 'summary': {
        return this.aiTasks.createSummaryTask({ refId })
      }
      case 'insights': {
        return this.aiTasks.createInsightsTask({ refId })
      }
      case 'translation': {
        return this.aiTasks.createTranslationTask({ refId })
      }
      case 'tts': {
        return this.aiTasks.createTtsTask({ refId })
      }
    }
  }

  private async waitForTask(taskId: string, signal: AbortSignal) {
    for (;;) {
      throwIfAborted(signal)
      const task = await this.tasks.getTask(taskId)
      if (!task) throw new Error(`AI task ${taskId} disappeared`)
      if (TERMINAL.has(task.status)) return task
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, 1000)
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeout)
            reject(createAbortError())
          },
          { once: true },
        )
      })
    }
  }

  private async cancelResourceTasks(
    resources: Partial<Record<PublishAiResource, string>>,
  ) {
    await Promise.allSettled(
      Object.values(resources).map(async (taskId) => {
        const task = await this.tasks.getTask(taskId)
        if (task && !TERMINAL.has(task.status)) {
          await this.tasks.cancelTask(taskId)
        }
      }),
    )
  }

  private findArticle(refType: DraftRefType, refId: string) {
    switch (refType) {
      case DraftRefType.Post: {
        return this.posts.findById(refId)
      }
      case DraftRefType.Note: {
        return this.notes.findById(refId)
      }
      case DraftRefType.Page: {
        return this.pages.findById(refId)
      }
    }
  }

  private setPublished(refType: DraftRefType, refId: string) {
    if (refType === DraftRefType.Post) {
      return this.posts.updateById(refId, { isPublished: true })
    }
    if (refType === DraftRefType.Note) {
      return this.notes.updateById(refId, { isPublished: true })
    }
    return Promise.resolve()
  }

  private async hasNewerBranchHead(payload: PublishTaskPayload) {
    const latest = await this.drafts.findById(payload.branchId)
    return Boolean(latest && latest.headRevisionId !== payload.revisionId)
  }

  private dedupTarget(payload: PublishTaskPayload) {
    return payload.documentId
  }
}
