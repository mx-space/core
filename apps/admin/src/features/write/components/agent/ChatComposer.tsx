import type { AgentStore } from '@haklex/rich-agent-core'
import { agentStoreSelectors } from '@haklex/rich-agent-core'
import { ArrowUp, Paperclip, TextQuote, X } from 'lucide-react'
import type { ClipboardEvent, DragEvent, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'

import type { ProviderModelsResponse } from '~/api/ai'
import { uploadFileWithProgress } from '~/api/files'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { ComposerAttachmentChip } from './AttachmentChips'
import type { ComposerAttachment } from './composer-attachments'
import { ModelSelector } from './ModelSelector'
import type { SelectedAgentModel } from './types'
import {
  type UploadImage,
  useComposerAttachments,
} from './use-composer-attachments'

const ATTACH_ACCEPT =
  'image/*,text/*,.md,.markdown,.mdx,.json,.yaml,.yml,.toml,.csv,.tsv,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.rs,.go,.sh,.sql,.diff,.patch,.log'

const uploadImageFile: UploadImage = (file, onProgress) =>
  uploadFileWithProgress(file, { onProgress, type: 'image' }).then(
    (response) => response.url,
  )

interface ChatComposerProps {
  store: AgentStore
  agentReady: boolean
  value: string
  onChange: (value: string) => void
  providerGroups: ProviderModelsResponse[]
  isLoadingModels: boolean
  selectedModel: SelectedAgentModel | null
  onSelectModel: (model: SelectedAgentModel) => void
  onSend: (message: string, attachments: ComposerAttachment[]) => void
  onAbort: () => void
  uploadImage?: UploadImage
}

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
  uploadImage = uploadImageFile,
}: ChatComposerProps) {
  const { t } = useI18n()
  const status = useStore(store, agentStoreSelectors.status)
  const pinnedSelection = useStore(store, agentStoreSelectors.pinnedSelection)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const attachments = useComposerAttachments(uploadImage)

  const isRunning = status !== 'idle' && status !== 'done'
  const hasDraft = Boolean(value.trim())
  const canSend =
    agentReady && Boolean(selectedModel) && hasDraft && !attachments.uploading

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
    onSend(value.trim(), attachments.take())
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = [...(e.clipboardData?.files ?? [])]
    if (!files.length) return
    e.preventDefault()
    attachments.add(files)
  }

  function hasFiles(e: DragEvent) {
    return [...(e.dataTransfer?.types ?? [])].includes('Files')
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return
    e.preventDefault()
    setDragging(false)
    attachments.add([...e.dataTransfer.files])
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="shrink-0 px-3 pb-3">
      <div
        className={cn(
          'relative rounded-lg border border-border-strong bg-surface-card shadow-xs transition-[border-color,box-shadow] focus-within:border-fg/25 focus-within:ring-[3px] focus-within:ring-fg/5',
          dragging && 'border-accent/60 ring-[3px] ring-accent/15',
        )}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {dragging ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-[inherit] bg-surface-card/95 text-sm text-accent">
            <Paperclip aria-hidden="true" className="size-4" />
            {t('write.agent.attachment.drop')}
            <span className="text-fg-subtle">
              {t('write.agent.attachment.dropHint')}
            </span>
          </div>
        ) : null}
        {(pinnedSelection || attachments.items.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 pt-2.5">
            {pinnedSelection ? (
              <div className="flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-xs bg-surface-inset pl-2 pr-1 text-sm text-fg-muted">
                <TextQuote
                  aria-hidden="true"
                  className="size-3 shrink-0 text-fg-subtle"
                />
                <span className="min-w-0 truncate">
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
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-xs text-fg-subtle hover:bg-border hover:text-fg"
                  onClick={() => store.getState().clearPinnedSelection()}
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </div>
            ) : null}
            {attachments.items.map((item) => (
              <ComposerAttachmentChip
                item={item}
                key={item.id}
                onRemove={attachments.remove}
                onRetry={attachments.retry}
              />
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder={t('write.agent.input.placeholder')}
          className="outline-hidden block min-h-12 w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-base leading-relaxed text-fg placeholder:text-fg-subtle"
          onChange={(e) => {
            onChange(e.target.value)
            grow(e.target)
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
        />

        <div className="flex items-center gap-1 px-1.5 pb-1.5 pt-1">
          <input
            accept={ATTACH_ACCEPT}
            className="hidden"
            multiple
            onChange={(e) => {
              attachments.add([...(e.target.files ?? [])])
              e.target.value = ''
            }}
            ref={fileInputRef}
            tabIndex={-1}
            type="file"
          />
          <button
            aria-label={t('write.agent.attachment.add')}
            className="focus-visible:outline-hidden inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15"
            onClick={() => fileInputRef.current?.click()}
            title={t('write.agent.attachment.add')}
            type="button"
          >
            <Paperclip aria-hidden="true" className="size-4" />
          </button>
          <ModelSelector
            providerGroups={providerGroups}
            selectedModel={selectedModel}
            isLoading={isLoadingModels}
            onSelect={onSelectModel}
          />
          <span className="flex-1" />
          {attachments.uploading ? (
            <span className="mr-1 text-sm text-fg-subtle">
              {t('write.agent.input.hintUploading')}
            </span>
          ) : isRunning ? null : (
            <span className="mr-1 text-sm text-fg-subtle">
              {t('write.agent.input.hintSend')}
            </span>
          )}

          {isRunning && !hasDraft ? (
            <button
              type="button"
              aria-label={t('write.agent.aborting')}
              className="focus-visible:outline-hidden inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-fg text-background transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-fg/20"
              onClick={onAbort}
            >
              <span
                aria-hidden="true"
                className="size-[9px] rounded-[2px] bg-current"
              />
            </button>
          ) : (
            <button
              type="button"
              aria-label={t('write.agent.button.send')}
              disabled={!canSend}
              className={cn(
                'inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
                'bg-fg text-background hover:opacity-90',
                'disabled:pointer-events-none disabled:bg-surface-inset disabled:text-fg-subtle',
              )}
              onClick={handleSend}
            >
              <ArrowUp
                aria-hidden="true"
                className="size-4"
                strokeWidth={2.5}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
