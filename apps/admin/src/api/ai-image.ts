import { getJson, postJson } from './http'
import type { AITask } from './tasks'
import { AITaskStatus, getTask } from './tasks'

export interface ImageDraftPromptRecipe {
  accent: string
  anchor: string
  family: string
  format: string
  geometry: string
  polarity: string
  scaffold: string
  text: string
  transformation: string
}

export interface ImageDraftPromptResponse {
  prompt: string
  recipe: ImageDraftPromptRecipe
}

export interface DraftImagePromptData {
  presetId: string
  refId?: string
  summary?: string
  title?: string
}

export interface ImagePreset {
  defaultAspectRatio: string
  id: string
  label: string
}

export type ImageGeneratePurpose = 'cover' | 'inline'

export type ImageAspectRatio =
  '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9'

export interface GenerateImageData {
  prompt?: string
  aspectRatio?: ImageAspectRatio
  model?: string
  presetId?: string
  purpose: ImageGeneratePurpose
  refId?: string
  requestId: string
}

export type ImageParameterDescriptor =
  | { type: 'enum'; values: string[] }
  | { type: 'range'; min: number; max: number }
  | { type: 'boolean' }

export interface ImageModel {
  id: string
  name: string
  provider: string
  supportedParameters: Record<string, ImageParameterDescriptor>
}

export function getImageModels() {
  return getJson<ImageModel[]>('/ai/image/models')
}

export interface GenerateImageResponse {
  created: boolean
  taskId: string
}

export function draftImagePrompt(data: DraftImagePromptData) {
  return postJson<ImageDraftPromptResponse, DraftImagePromptData>(
    '/ai/image/draft-prompt',
    data,
  )
}

export function generateImage(data: GenerateImageData) {
  return postJson<GenerateImageResponse, GenerateImageData>(
    '/ai/image/generate',
    data,
  )
}

export function getImagePresets() {
  return getJson<ImagePreset[]>('/ai/image/presets')
}

export interface ImageTaskResult {
  completedAt: number
  prompt?: string
  url: string
}

export type ImageTaskOutcome =
  | { status: 'pending' }
  | { error?: string; reason: 'missing_url' | 'task_error'; status: 'failed' }
  | ({ status: 'success' } & ImageTaskResult)

export function resolveImageTaskOutcome(task: AITask): ImageTaskOutcome {
  if (task.status === AITaskStatus.Completed) {
    const result = task.result as { prompt?: string; url?: string } | undefined
    // The server broadcasts the terminal status and its result as two
    // separate socket phases — a completed snapshot can briefly arrive with
    // no result attached yet, so treat that gap as still pending rather than
    // a hard failure.
    if (!result) return { status: 'pending' }
    if (!result.url) return { reason: 'missing_url', status: 'failed' }
    return {
      completedAt: task.completedAt ?? Date.now(),
      prompt: result.prompt,
      status: 'success',
      url: result.url,
    }
  }

  if (
    task.status === AITaskStatus.Failed ||
    task.status === AITaskStatus.PartialFailed ||
    task.status === AITaskStatus.Cancelled
  ) {
    return { error: task.error, reason: 'task_error', status: 'failed' }
  }

  return { status: 'pending' }
}

const DEFAULT_IMAGE_TASK_POLL_INTERVAL_MS = 5000
const DEFAULT_IMAGE_TASK_TIMEOUT_MS = 3 * 60_000

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

export async function waitForImageTask(
  taskId: string,
  options?: { intervalMs?: number; signal?: AbortSignal; timeoutMs?: number },
): Promise<ImageTaskResult> {
  const intervalMs = options?.intervalMs ?? DEFAULT_IMAGE_TASK_POLL_INTERVAL_MS
  const timeoutMs = options?.timeoutMs ?? DEFAULT_IMAGE_TASK_TIMEOUT_MS
  const deadline = Date.now() + timeoutMs

  for (;;) {
    options?.signal?.throwIfAborted()
    if (Date.now() >= deadline) {
      throw new Error(`Image task ${taskId} timed out after ${timeoutMs}ms`)
    }
    const task = await getTask(taskId)
    const outcome = resolveImageTaskOutcome(task)

    if (outcome.status === 'success') {
      const { status: _status, ...result } = outcome
      return result
    }
    if (outcome.status === 'failed') {
      throw new Error(
        outcome.reason === 'missing_url'
          ? `Image task ${taskId} completed without a result URL`
          : (outcome.error ?? `Image task ${taskId} failed`),
      )
    }

    await delay(intervalMs, options?.signal)
  }
}
