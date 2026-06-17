import { Effect } from 'effect'

import type { AiTaskFailed } from '../../domain/errors'
import {
  type AiService,
  type AiTaskCreateResult,
  type AiTaskFinalView,
  type AiTaskType,
} from '../../services/Ai'
import type { ApiError } from '../../services/Api'
import { Renderer, type RendererService } from '../../services/Renderer'

const synthesizePending = (created: AiTaskCreateResult): AiTaskFinalView => ({
  type: created.type,
  taskId: created.taskId,
  status: 'pending',
  refId: created.refId,
  targetLanguages: created.targetLanguages,
})

/**
 * Drive a freshly-created task to a terminal state, emitting progress to
 * stderr via the renderer. With `noWait`, returns a synthetic pending view.
 */
export const followTask = (
  ai: AiService,
  renderer: RendererService,
  created: AiTaskCreateResult,
  noWait: boolean,
): Effect.Effect<AiTaskFinalView, AiTaskFailed | ApiError> =>
  Effect.gen(function* () {
    if (!created.created) {
      yield* renderer.emitInfo(
        `[ai] joining existing task taskId=${created.taskId}`,
      )
    } else {
      yield* renderer.emitInfo(`[ai] task pending… taskId=${created.taskId}`)
    }
    if (noWait) return synthesizePending(created)
    const final = yield* ai.waitForTask(created.taskId, {
      type: created.type,
      onProgress: (msg) => {
        // Fire-and-forget; stderr write is sync.
        // We intentionally don't await the Effect — onProgress runs inside
        // the polling loop and must stay sync.
        process.stderr.write(`${msg}\n`)
      },
    })
    return {
      ...final,
      refId: final.refId ?? created.refId,
      targetLanguages: final.targetLanguages ?? created.targetLanguages,
    }
  })

// Re-export for convenience.
export type { AiTaskType }
export { Renderer }
