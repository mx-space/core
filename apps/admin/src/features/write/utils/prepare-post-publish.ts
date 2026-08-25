import {
  createInsightsTask,
  createSummaryTask,
  createTranslationTask,
  createTtsTask,
} from '~/api/ai'
import type { CreateNoteData } from '~/api/notes'
import type { CreatePostData } from '~/api/posts'
import { AITaskStatus, getTask } from '~/api/tasks'
import { publishNote, saveNote } from '~/data/resources/note.mutations'
import { publishPost, savePost } from '~/data/resources/post.mutations'
import type { AIConfig } from '~/features/settings/types/settings'
import type { NoteModel } from '~/models/note'
import type { PostModel } from '~/models/post'

export type PublishAiResource = 'insights' | 'summary' | 'translation' | 'tts'

const TASK_POLL_INTERVAL_MS = 5_000
const TASK_TIMEOUT_MS = 30 * 60_000

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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForAiTask(
  taskId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
) {
  const intervalMs = options.intervalMs ?? TASK_POLL_INTERVAL_MS
  const timeoutMs = options.timeoutMs ?? TASK_TIMEOUT_MS
  const deadline = Date.now() + timeoutMs

  for (;;) {
    if (Date.now() >= deadline) {
      throw new Error(`AI task ${taskId} timed out after ${timeoutMs}ms`)
    }
    const task = await getTask(taskId)
    if (task.status === AITaskStatus.Completed) return task
    if (
      task.status === AITaskStatus.Failed ||
      task.status === AITaskStatus.PartialFailed ||
      task.status === AITaskStatus.Cancelled
    ) {
      throw new Error(task.error ?? `AI task ${taskId} failed`)
    }
    await delay(intervalMs)
  }
}

interface PrepareAndPublishInput<TData> {
  config?: AIConfig
  data: TData
  id: string
  onDraftSaved?: (draft: NoteModel | PostModel) => void
  resources: PublishAiResource[]
}

async function prepareAndPublish<
  TData extends {
    isPublished?: boolean
    skipAiAutoGeneration?: boolean
  },
  TModel extends NoteModel | PostModel,
>(
  input: PrepareAndPublishInput<TData>,
  save: (id: string, data: TData) => Promise<TModel>,
  publish: (
    id: string,
    isPublished: boolean,
    options: { preparedAiResources: PublishAiResource[] },
  ) => Promise<TModel | void>,
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

  // ponytail: the admin tab owns this safe publication gate; move it to one
  // server task if publishing must continue after the tab is closed.
  await Promise.all(
    resources.map(async (resource) => {
      const task = await createResourceTask(resource, draft.id, input.config)
      await waitForAiTask(task.taskId)
    }),
  )

  const published = await publish(draft.id, true, {
    preparedAiResources: resources,
  })
  return published ?? ({ ...draft, isPublished: true } as TModel)
}

export function prepareAndPublishPost(
  input: PrepareAndPublishInput<CreatePostData>,
) {
  return prepareAndPublish<CreatePostData, PostModel>(
    input,
    savePost,
    publishPost,
  )
}

export function prepareAndPublishNote(
  input: PrepareAndPublishInput<CreateNoteData>,
) {
  return prepareAndPublish<CreateNoteData, NoteModel>(
    input,
    saveNote,
    publishNote,
  )
}
