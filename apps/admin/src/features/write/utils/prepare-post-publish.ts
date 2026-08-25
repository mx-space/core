import {
  createInsightsTask,
  createSummaryTask,
  createTranslationTask,
  createTtsTask,
} from '~/api/ai'
import type { CreateNoteData } from '~/api/notes'
import type { CreatePostData } from '~/api/posts'
import { AITaskStatus, cancelTask, getTask } from '~/api/tasks'
import { publishNote, saveNote } from '~/data/resources/note.mutations'
import { publishPost, savePost } from '~/data/resources/post.mutations'
import type { AIConfig } from '~/features/settings/types/settings'
import type { NoteModel } from '~/models/note'
import type { PostModel } from '~/models/post'
import { adminQueryKeys } from '~/query/keys'
import { queryClient } from '~/query-client'
import { jotaiStore } from '~/store/jotai-store'

import type { PublishAiResource } from './publish-process-state'
import {
  addPublishProcess,
  markPublishProcessCancelled,
  publishProcessesAtom,
  updatePublishProcess,
  updatePublishProcessResource,
} from './publish-process-state'

export type { PublishAiResource } from './publish-process-state'

const TASK_POLL_INTERVAL_MS = 5_000
const TASK_TIMEOUT_MS = 30 * 60_000

const activeRuns = new Map<
  string,
  { controller: AbortController; promise: Promise<void> }
>()

const configuredLanguages = (languages?: string[]) =>
  languages?.length ? languages : undefined

async function createResourceTask(
  resource: PublishAiResource,
  refId: string,
  config?: AIConfig,
) {
  switch (resource) {
    case 'summary': {
      return createSummaryTask({
        refId,
        targetLanguages: configuredLanguages(config?.summaryTargetLanguages),
      })
    }
    case 'insights': {
      return createInsightsTask({
        refId,
        targetLanguages: configuredLanguages(config?.insightsTargetLanguages),
      })
    }
    case 'translation': {
      return createTranslationTask({
        refId,
        targetLanguages: configuredLanguages(
          config?.translationTargetLanguages,
        ),
      })
    }
    case 'tts': {
      return createTtsTask({ refId })
    }
  }
}

function cancellationError() {
  const error = new Error('Publish process cancelled')
  error.name = 'AbortError'
  return error
}

function throwIfCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw cancellationError()
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(cancellationError())
      return
    }
    const onAbort = () => {
      clearTimeout(timeout)
      reject(cancellationError())
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export async function waitForAiTask(
  taskId: string,
  options: {
    intervalMs?: number
    onUpdate?: (task: Awaited<ReturnType<typeof getTask>>) => void
    signal?: AbortSignal
    timeoutMs?: number
  } = {},
) {
  const intervalMs = options.intervalMs ?? TASK_POLL_INTERVAL_MS
  const timeoutMs = options.timeoutMs ?? TASK_TIMEOUT_MS
  const deadline = Date.now() + timeoutMs

  for (;;) {
    throwIfCancelled(options.signal)
    if (Date.now() >= deadline) {
      throw new Error(`AI task ${taskId} timed out after ${timeoutMs}ms`)
    }
    const task = await getTask(taskId)
    options.onUpdate?.(task)
    if (task.status === AITaskStatus.Completed) return task
    if (
      task.status === AITaskStatus.Failed ||
      task.status === AITaskStatus.PartialFailed ||
      task.status === AITaskStatus.Cancelled
    ) {
      throw new Error(task.error ?? `AI task ${taskId} failed`)
    }
    await delay(intervalMs, options.signal)
  }
}

interface PrepareAndPublishInput<TData> {
  config?: AIConfig
  data: TData
  id: string
  onDraftSaved?: (draft: NoteModel | PostModel) => void
  resources: PublishAiResource[]
}

type PublishMutation<TModel> = (
  id: string,
  isPublished: boolean,
  options: { preparedAiResources: PublishAiResource[] },
) => Promise<TModel | void>

async function runPublishProcess<TModel extends NoteModel | PostModel>(input: {
  config?: AIConfig
  controller: AbortController
  draft: TModel
  kind: 'note' | 'post'
  processId: string
  publish: PublishMutation<TModel>
  resources: PublishAiResource[]
}) {
  const { controller, draft, processId, resources } = input
  const results = await Promise.allSettled(
    resources.map(async (resource) => {
      try {
        throwIfCancelled(controller.signal)
        const created = await createResourceTask(
          resource,
          draft.id,
          input.config,
        )
        updatePublishProcessResource(processId, resource, (item) => ({
          ...item,
          status: AITaskStatus.Pending,
          taskId: created.taskId,
        }))
        if (controller.signal.aborted) {
          await cancelTask(created.taskId).catch(() => undefined)
          throw cancellationError()
        }
        await waitForAiTask(created.taskId, {
          onUpdate: (task) =>
            updatePublishProcessResource(processId, resource, (item) => ({
              ...item,
              error: task.error,
              status: task.status,
              task,
            })),
          signal: controller.signal,
        })
      } catch (error) {
        if (!controller.signal.aborted) {
          updatePublishProcessResource(processId, resource, (item) => ({
            ...item,
            error: getErrorMessage(error),
            status: AITaskStatus.Failed,
          }))
        }
        throw error
      }
    }),
  )

  throwIfCancelled(controller.signal)
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  )
  if (failed) throw failed.reason

  updatePublishProcess(processId, (process) => ({
    ...process,
    phase: 'publishing',
  }))
  await input.publish(draft.id, true, { preparedAiResources: resources })
  updatePublishProcess(processId, (process) => ({
    ...process,
    phase: 'completed',
  }))
  void queryClient.invalidateQueries({
    queryKey: adminQueryKeys.write.contentRoot(input.kind),
  })
}

async function prepareAndPublish<
  TData extends {
    isPublished?: boolean
    skipAiAutoGeneration?: boolean
  },
  TModel extends NoteModel | PostModel,
>(
  input: PrepareAndPublishInput<TData>,
  kind: 'note' | 'post',
  save: (id: string, data: TData) => Promise<TModel>,
  publish: PublishMutation<TModel>,
): Promise<TModel> {
  const { resources } = input

  if (resources.length === 0) {
    return save(input.id, {
      ...input.data,
      isPublished: true,
    })
  }

  const draft = await save(input.id, {
    ...input.data,
    isPublished: false,
    skipAiAutoGeneration: true,
  })
  input.onDraftSaved?.(draft)

  const processId = crypto.randomUUID()
  const controller = new AbortController()
  addPublishProcess({
    id: processId,
    kind,
    phase: 'preparing',
    refId: draft.id,
    resources: resources.map((resource) => ({
      resource,
      status: 'queued',
    })),
    startedAt: Date.now(),
    title: draft.title,
  })

  // ponytail: this browser tab owns the final publish gate; move the runner to
  // one server workflow if publishing must survive a closed browser window.
  const promise = runPublishProcess({
    config: input.config,
    controller,
    draft,
    kind,
    processId,
    publish,
    resources,
  })
    .catch((error) => {
      if (controller.signal.aborted) {
        markPublishProcessCancelled(processId)
        return
      }
      updatePublishProcess(processId, (process) => ({
        ...process,
        error: getErrorMessage(error),
        phase: 'failed',
      }))
    })
    .finally(() => activeRuns.delete(processId))
  activeRuns.set(processId, { controller, promise })
  void promise

  return draft
}

export async function cancelPublishProcess(processId: string) {
  const process = jotaiStore
    .get(publishProcessesAtom)
    .find((item) => item.id === processId)
  if (!process || process.phase !== 'preparing') return

  updatePublishProcess(processId, (current) => ({
    ...current,
    phase: 'cancelling',
  }))
  const run = activeRuns.get(processId)
  run?.controller.abort()
  await Promise.allSettled(
    process.resources.flatMap((resource) =>
      resource.taskId ? [cancelTask(resource.taskId)] : [],
    ),
  )
  if (run) await run.promise
  else markPublishProcessCancelled(processId)
}

export function prepareAndPublishPost(
  input: PrepareAndPublishInput<CreatePostData>,
) {
  return prepareAndPublish<CreatePostData, PostModel>(
    input,
    'post',
    savePost,
    publishPost,
  )
}

export function prepareAndPublishNote(
  input: PrepareAndPublishInput<CreateNoteData>,
) {
  return prepareAndPublish<CreateNoteData, NoteModel>(
    input,
    'note',
    saveNote,
    publishNote,
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
