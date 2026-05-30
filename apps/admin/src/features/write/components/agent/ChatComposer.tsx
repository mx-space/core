import { ArrowUp, Square } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import type { ProviderModelsResponse } from '~/api/ai'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { ModelSelector } from './ModelSelector'
import type { AgentStreamStatus, SelectedAgentModel } from './types'

interface ChatComposerProps {
  streamStatus: AgentStreamStatus
  agentReady: boolean
  value: string
  onChange: (value: string) => void
  providerGroups: ProviderModelsResponse[]
  isLoadingModels: boolean
  selectedModel: SelectedAgentModel | null
  onSelectModel: (model: SelectedAgentModel) => void
  onSend: (message: string) => void
  onAbort: () => void
}

export function ChatComposer({
  streamStatus,
  agentReady,
  value,
  onChange,
  providerGroups,
  isLoadingModels,
  selectedModel,
  onSelectModel,
  onSend,
  onAbort,
}: ChatComposerProps) {
  const { t } = useI18n()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isComposing, setIsComposing] = useState(false)

  const isRunning =
    streamStatus === 'connecting' || streamStatus === 'streaming'
  const canSend =
    !isRunning && agentReady && Boolean(selectedModel) && Boolean(value.trim())

  useEffect(() => {
    if (!value) {
      const ta = textareaRef.current
      if (ta) ta.style.height = 'auto'
    }
  }, [value])

  function grow(ta: HTMLTextAreaElement) {
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`
  }

  function handleSend() {
    if (!canSend) return
    onSend(value.trim())
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex shrink-0 flex-col border-t border-neutral-200 dark:border-neutral-800">
      {isRunning && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400">
          <span className="relative flex size-1.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
          </span>
          <span>{t('write.agent.status.processing')}</span>
        </div>
      )}

      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        placeholder={t('write.agent.input.placeholder')}
        className="outline-hidden min-h-20 w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-sm leading-relaxed text-neutral-800 placeholder:text-neutral-400 dark:text-neutral-200"
        onChange={(e) => {
          onChange(e.target.value)
          grow(e.target)
        }}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
      />

      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div className="flex items-center gap-2">
          <ModelSelector
            providerGroups={providerGroups}
            selectedModel={selectedModel}
            isLoading={isLoadingModels}
            onSelect={onSelectModel}
          />
          {!isRunning && (
            <span className="text-xs text-neutral-400/60">
              {t('write.agent.input.hintSend')}
            </span>
          )}
        </div>

        {isRunning ? (
          <button
            type="button"
            aria-label={t('write.agent.aborting')}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-red-500 text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
            onClick={onAbort}
          >
            <Square aria-hidden="true" className="size-3" fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            aria-label={t('write.agent.button.send')}
            disabled={!canSend}
            className={cn(
              'inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
              'bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300',
              'disabled:pointer-events-none disabled:bg-neutral-100 disabled:text-neutral-300 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600',
            )}
            onClick={handleSend}
          >
            <ArrowUp aria-hidden="true" className="size-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}
