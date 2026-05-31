import type { AgentStore, AgentStoreStatus } from '@haklex/rich-agent-core'
import { agentStoreSelectors } from '@haklex/rich-agent-core'
import { ArrowUp, Square, X } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'

import type { ProviderModelsResponse } from '~/api/ai'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { ModelSelector } from './ModelSelector'
import type { SelectedAgentModel } from './types'

interface ChatComposerProps {
  store: AgentStore
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

const STATUS_LABEL_KEYS = {
  thinking: 'write.agent.status.thinking',
  writing: 'write.agent.status.writing',
  calling_tool: 'write.agent.status.callingTool',
} as const

export function ChatComposer({
  store,
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
  const status = useStore(store, agentStoreSelectors.status)
  const pinnedSelection = useStore(store, agentStoreSelectors.pinnedSelection)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isComposing, setIsComposing] = useState(false)

  const isRunning = status !== 'idle' && status !== 'done'
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
    <div className="flex shrink-0 flex-col border-t border-border">
      {pinnedSelection && (
        <div className="mx-2 mt-2 flex items-center gap-1.5 rounded bg-surface-inset px-2.5 py-1.5 text-xs text-fg-muted">
          <span className="min-w-0 flex-1 truncate">
            {pinnedSelection.type === 'text'
              ? `"${
                  pinnedSelection.text.length > 60
                    ? `${pinnedSelection.text.slice(0, 60)}…`
                    : pinnedSelection.text
                }"`
              : t('write.agent.selection.blocks', {
                  count: pinnedSelection.blockIds.length,
                })}
          </span>
          <button
            type="button"
            aria-label={t('write.agent.selection.dismiss')}
            className="inline-flex size-4 shrink-0 items-center justify-center text-fg-subtle hover:text-fg"
            onClick={() => store.getState().clearPinnedSelection()}
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </div>
      )}

      {isRunning && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-fg-subtle">
          <span className="relative flex size-1.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
          </span>
          <span>{t(resolveStatusKey(status))}</span>
        </div>
      )}

      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        placeholder={t('write.agent.input.placeholder')}
        className="outline-hidden min-h-20 w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-sm leading-relaxed text-fg placeholder:text-fg-subtle"
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
            <span className="text-xs text-fg-subtle">
              {t('write.agent.input.hintSend')}
            </span>
          )}
        </div>

        {isRunning ? (
          <button
            type="button"
            aria-label={t('write.agent.aborting')}
            className="focus-visible:outline-hidden inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-fg text-background transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-fg/20"
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
              'inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors',
              'bg-fg text-background hover:opacity-90',
              'disabled:pointer-events-none disabled:bg-surface-inset disabled:text-fg-subtle',
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

function resolveStatusKey(status: AgentStoreStatus) {
  if (
    status === 'thinking' ||
    status === 'writing' ||
    status === 'calling_tool'
  )
    return STATUS_LABEL_KEYS[status]
  return 'write.agent.status.processing'
}
