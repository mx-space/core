import { atom } from 'jotai'

import type { AITask } from '~/api/tasks'
import { AITaskStatus } from '~/api/tasks'
import { jotaiStore } from '~/store/jotai-store'

export type PublishAiResource = 'insights' | 'summary' | 'translation' | 'tts'

export type PublishProcessPhase =
  | 'cancelled'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'preparing'
  | 'publishing'

export interface PublishProcessResource {
  error?: string
  resource: PublishAiResource
  status: AITaskStatus | 'queued'
  task?: AITask
  taskId?: string
}

export interface PublishProcess {
  error?: string
  id: string
  kind: 'note' | 'post'
  phase: PublishProcessPhase
  refId: string
  resources: PublishProcessResource[]
  startedAt: number
  title: string
}

export const publishProcessesAtom = atom<PublishProcess[]>([])
export const publishProcessDockOpenAtom = atom(false)
export const hasPublishProcessesAtom = atom(
  (get) => get(publishProcessesAtom).length > 0,
)

export function isPublishProcessActive(phase: PublishProcessPhase) {
  return (
    phase === 'preparing' || phase === 'cancelling' || phase === 'publishing'
  )
}

export function addPublishProcess(process: PublishProcess) {
  jotaiStore.set(publishProcessesAtom, (current) => [...current, process])
}

export function updatePublishProcess(
  processId: string,
  update: (process: PublishProcess) => PublishProcess,
) {
  jotaiStore.set(publishProcessesAtom, (current) =>
    current.map((process) =>
      process.id === processId ? update(process) : process,
    ),
  )
}

export function updatePublishProcessResource(
  processId: string,
  resource: PublishAiResource,
  update: (item: PublishProcessResource) => PublishProcessResource,
) {
  updatePublishProcess(processId, (process) => ({
    ...process,
    resources: process.resources.map((item) =>
      item.resource === resource ? update(item) : item,
    ),
  }))
}

export function markPublishProcessCancelled(processId: string) {
  updatePublishProcess(processId, (process) => ({
    ...process,
    phase: 'cancelled',
    resources: process.resources.map((item) =>
      item.status === AITaskStatus.Completed
        ? item
        : { ...item, status: AITaskStatus.Cancelled },
    ),
  }))
}

export function dismissPublishProcess(processId: string) {
  const next = jotaiStore
    .get(publishProcessesAtom)
    .filter(
      (process) =>
        process.id !== processId || isPublishProcessActive(process.phase),
    )
  jotaiStore.set(publishProcessesAtom, next)
  if (next.length === 0) jotaiStore.set(publishProcessDockOpenAtom, false)
}

export function openPublishProcessDock() {
  jotaiStore.set(publishProcessDockOpenAtom, true)
}
