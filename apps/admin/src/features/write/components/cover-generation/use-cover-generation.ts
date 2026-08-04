import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
  draftImagePrompt,
  generateImage,
  getImageModels,
  getImagePresets,
  resolveImageTaskOutcome,
} from '~/api/ai-image'
import { ApiRequestError } from '~/api/http'
import { getTask } from '~/api/tasks'
import {
  fallbackPollingIntervalMs,
  liveSubscribeIntervalMs,
} from '~/features/tasks/constants'
import { useTaskDetailSubscription } from '~/features/tasks/hooks/useTaskSubscription'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'

const DRAFT_PROMPT_SUMMARY_FALLBACK_LENGTH = 800
const AI_NOT_ENABLED_ERROR_CODE = 'AI_NOT_ENABLED'

export type CoverGenerationMode = 'manual' | 'preset'

export interface CoverCandidate {
  createdAt: number
  prompt: string
  taskId: string
  url: string
}

interface UseCoverGenerationParams {
  currentCover: string
  defaultModel?: string
  draftId?: string
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
  const [mode, setMode] = useState<CoverGenerationMode>('preset')
  const [presetId, setPresetId] = useState('')
  const [promptText, setPromptText] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [candidates, setCandidates] = useState<CoverCandidate[]>([])
  const [pendingTaskId, setPendingTaskId] = useState<null | string>(null)
  const [writerProviderMissing, setWriterProviderMissing] = useState(false)

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

  const modelsQuery = useQuery({
    enabled: params.enabled,
    queryFn: getImageModels,
    queryKey: adminQueryKeys.ai.imageModels(),
    select: (res: any) => (Array.isArray(res) ? res : (res?.data ?? [])),
    staleTime: 5 * 60_000,
  })
  const models = modelsQuery.data ?? []

  useEffect(() => {
    if (selectedModel || !params.defaultModel) return
    setSelectedModel(params.defaultModel)
  }, [selectedModel, params.defaultModel])

  useEffect(() => {
    if (open) return
    setMode('preset')
    setPromptText('')
    setWriterProviderMissing(false)
  }, [open])

  const summaryFallback =
    params.summary.trim() ||
    params.text.trim().slice(0, DRAFT_PROMPT_SUMMARY_FALLBACK_LENGTH)
  const canDraftPrompt =
    Boolean(params.refId) ||
    Boolean(params.draftId) ||
    Boolean(params.title.trim() && summaryFallback)

  const { isPending: isDraftingPrompt, mutate: draftPrompt } = useMutation({
    mutationFn: draftImagePrompt,
    onError: (error) => {
      if (
        error instanceof ApiRequestError &&
        error.code === AI_NOT_ENABLED_ERROR_CODE
      ) {
        setWriterProviderMissing(true)
        return
      }
      toast.error(
        getErrorMessage(error, t('write.coverGeneration.toast.draftFailed')),
      )
    },
    onSuccess: (result) => {
      setPromptText(result.prompt)
      setWriterProviderMissing(false)
      setMode('manual')
    },
  })

  const onViewEditPrompt = () => {
    if (!presetId || !canDraftPrompt) return
    setWriterProviderMissing(false)
    draftPrompt({
      presetId,
      draftId: params.draftId,
      refId: params.refId,
      summary: summaryFallback,
      title: params.title,
    })
  }

  const onWriteManually = () => {
    setWriterProviderMissing(false)
    setPromptText('')
    setMode('manual')
  }

  const onUsePreset = () => {
    setPromptText('')
    setMode('preset')
  }

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
    refetchIntervalInBackground: true,
  })

  useEffect(() => {
    const task = taskQuery.data
    if (!task || !pendingTaskId || task.id !== pendingTaskId) return

    const outcome = resolveImageTaskOutcome(task)
    if (outcome.status === 'pending') return

    if (outcome.status === 'success') {
      setCandidates((prev) => [
        {
          createdAt: outcome.completedAt,
          prompt: outcome.prompt ?? promptText,
          taskId: task.id,
          url: outcome.url,
        },
        ...prev,
      ])
    } else if (outcome.reason === 'missing_url') {
      toast.error(t('write.coverGeneration.toast.missingResult'))
    } else {
      toast.error(
        getErrorMessage(
          outcome.error ? new Error(outcome.error) : undefined,
          t('write.coverGeneration.toast.generateFailed'),
        ),
      )
    }
    setPendingTaskId(null)
  }, [taskQuery.data, pendingTaskId, promptText, t])

  const canGenerate =
    mode === 'manual'
      ? Boolean(promptText.trim())
      : Boolean(presetId) && canDraftPrompt

  return {
    canDraftPrompt,
    canGenerate,
    candidates,
    closeDrawer: () => setOpen(false),
    currentCover: params.currentCover,
    isDraftingPrompt,
    isGenerating: generateMutation.isPending || Boolean(pendingTaskId),
    mode,
    models,
    modelsLoading: modelsQuery.isLoading,
    onGenerate: () => {
      if (!canGenerate) return
      if (mode === 'manual') {
        generateMutation.mutate({
          model: selectedModel || undefined,
          prompt: promptText.trim(),
          presetId: presetId || undefined,
          purpose: 'cover',
          refId: params.refId,
          requestId: crypto.randomUUID(),
        })
        return
      }
      generateMutation.mutate({
        draftId: params.draftId,
        model: selectedModel || undefined,
        presetId,
        purpose: 'cover',
        refId: params.refId,
        requestId: crypto.randomUUID(),
        summary: summaryFallback,
        title: params.title,
      })
    },
    onSelectCandidate: params.onSelectCover,
    onUsePreset,
    onViewEditPrompt,
    onWriteManually,
    open,
    openDrawer: () => setOpen(true),
    presetId,
    presets,
    presetsLoading: presetsQuery.isLoading,
    promptText,
    selectedModel,
    setPresetId,
    setPromptText,
    setSelectedModel,
    writerProviderMissing,
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
