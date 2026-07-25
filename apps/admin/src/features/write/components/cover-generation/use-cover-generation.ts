import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  draftImagePrompt,
  generateImage,
  getImagePresets,
} from '~/api/ai-image'
import { AITaskStatus, getTask } from '~/api/tasks'
import {
  fallbackPollingIntervalMs,
  liveSubscribeIntervalMs,
} from '~/features/tasks/constants'
import { useTaskDetailSubscription } from '~/features/tasks/hooks/useTaskSubscription'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'

const DRAFT_PROMPT_SUMMARY_FALLBACK_LENGTH = 800

export interface CoverCandidate {
  createdAt: number
  prompt: string
  taskId: string
  url: string
}

interface UseCoverGenerationParams {
  currentCover: string
  enabled: boolean
  onSelectCover: (url: string) => void
  refId?: string
  summary: string
  text: string
  title: string
}

export function useCoverGeneration(params: UseCoverGenerationParams) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [presetId, setPresetId] = useState('')
  const [promptText, setPromptText] = useState('')
  const [candidates, setCandidates] = useState<CoverCandidate[]>([])
  const [pendingTaskId, setPendingTaskId] = useState<null | string>(null)
  const hasDraftedRef = useRef(false)

  const presetsQuery = useQuery({
    enabled: params.enabled,
    queryFn: getImagePresets,
    queryKey: adminQueryKeys.ai.imagePresets(),
    select: (res: any) => (Array.isArray(res) ? res : (res?.data ?? [])),
    staleTime: 5 * 60_000,
  })
  const presets = presetsQuery.data ?? []

  useEffect(() => {
    if (presetId || presets.length === 0) return
    setPresetId(presets[0].id)
  }, [presetId, presets])

  const summaryFallback =
    params.summary.trim() ||
    params.text.trim().slice(0, DRAFT_PROMPT_SUMMARY_FALLBACK_LENGTH)
  const canDraftPrompt =
    Boolean(params.refId) || Boolean(params.title.trim() && summaryFallback)

  const { isPending: isDraftingPrompt, mutate: draftPrompt } = useMutation({
    mutationFn: draftImagePrompt,
    onError: (error) => {
      toast.error(
        getErrorMessage(error, t('write.coverGeneration.toast.draftFailed')),
      )
    },
    onSuccess: (result) => setPromptText(result.prompt),
  })

  useEffect(() => {
    if (!open) {
      hasDraftedRef.current = false
      return
    }
    if (hasDraftedRef.current || !presetId || !canDraftPrompt) return
    hasDraftedRef.current = true
    draftPrompt(
      params.refId
        ? { presetId, refId: params.refId }
        : { presetId, summary: summaryFallback, title: params.title },
    )
  }, [
    open,
    presetId,
    canDraftPrompt,
    draftPrompt,
    params.refId,
    params.title,
    summaryFallback,
  ])

  const generateMutation = useMutation({
    mutationFn: generateImage,
    onError: (error) => {
      toast.error(
        getErrorMessage(error, t('write.coverGeneration.toast.generateFailed')),
      )
    },
    onSuccess: (result) => setPendingTaskId(result.taskId),
  })

  const { socketConnected } = useTaskDetailSubscription(pendingTaskId)
  const taskQuery = useQuery({
    enabled: Boolean(pendingTaskId),
    queryFn: () => getTask(pendingTaskId!),
    queryKey: adminQueryKeys.tasks.taskDetail(pendingTaskId ?? ''),
    refetchInterval: () =>
      socketConnected ? liveSubscribeIntervalMs : fallbackPollingIntervalMs,
  })

  useEffect(() => {
    const task = taskQuery.data
    if (!task || !pendingTaskId || task.id !== pendingTaskId) return

    if (task.status === AITaskStatus.Completed) {
      const result = task.result as
        { prompt?: string; url?: string } | undefined
      if (result?.url) {
        setCandidates((prev) => [
          {
            createdAt: task.completedAt ?? Date.now(),
            prompt: result.prompt ?? promptText,
            taskId: task.id,
            url: result.url!,
          },
          ...prev,
        ])
      } else {
        toast.error(t('write.coverGeneration.toast.missingResult'))
      }
      setPendingTaskId(null)
    } else if (
      task.status === AITaskStatus.Failed ||
      task.status === AITaskStatus.PartialFailed ||
      task.status === AITaskStatus.Cancelled
    ) {
      toast.error(
        getErrorMessage(
          task.error ? new Error(task.error) : undefined,
          t('write.coverGeneration.toast.generateFailed'),
        ),
      )
      setPendingTaskId(null)
    }
  }, [taskQuery.data, pendingTaskId, promptText, t])

  return {
    canDraftPrompt,
    candidates,
    closeDrawer: () => setOpen(false),
    currentCover: params.currentCover,
    isDraftingPrompt,
    isGenerating: generateMutation.isPending || Boolean(pendingTaskId),
    onGenerate: () => {
      if (!promptText.trim() || !presetId) return
      generateMutation.mutate({
        prompt: promptText.trim(),
        presetId,
        purpose: 'cover',
        refId: params.refId,
        requestId: crypto.randomUUID(),
      })
    },
    onSelectCandidate: params.onSelectCover,
    open,
    openDrawer: () => setOpen(true),
    presetId,
    presets,
    presetsLoading: presetsQuery.isLoading,
    promptText,
    setPresetId,
    setPromptText,
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
