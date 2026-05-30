import { Check, ChevronDown, Search, Sparkles } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import type { ProviderModelsResponse } from '~/api/ai'
import { useI18n } from '~/i18n'
import { Popover } from '~/ui/overlay/popover'
import { cn } from '~/utils/cn'

import {
  filterRecentModelsWithin,
  readRecentModels,
  rememberRecentModel,
  writeRecentModels,
} from './model-recents'
import type { SelectedAgentModel } from './types'

interface ModelSelectorProps {
  providerGroups: ProviderModelsResponse[]
  selectedModel: SelectedAgentModel | null
  isLoading: boolean
  onSelect: (model: SelectedAgentModel) => void
}

interface ModelRow {
  modelId: string
  providerId: string
  providerType: string
  name: string
}

interface ModelGroupView {
  key: string
  label: string
  rows: ModelRow[]
}

function getModelName(
  providerGroups: ProviderModelsResponse[],
  providerId: string,
  modelId: string,
): string {
  const group = providerGroups.find((item) => item.providerId === providerId)
  return group?.models.find((item) => item.id === modelId)?.name ?? modelId
}

export function ModelSelector({
  providerGroups,
  selectedModel,
  isLoading,
  onSelect,
}: ModelSelectorProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [recents, setRecents] = useState<SelectedAgentModel[]>(() =>
    readRecentModels(),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  const triggerLabel = useMemo(() => {
    if (isLoading) return t('write.agent.modelLoading')
    if (!selectedModel) return t('write.agent.model.placeholder')
    return getModelName(
      providerGroups,
      selectedModel.providerId,
      selectedModel.modelId,
    )
  }, [isLoading, selectedModel, providerGroups, t])

  const groups = useMemo<ModelGroupView[]>(() => {
    const normalized = query.trim().toLowerCase()

    const providerViews = providerGroups
      .map((group) => {
        const models = normalized
          ? group.models.filter(
              (model) =>
                model.name.toLowerCase().includes(normalized) ||
                model.id.toLowerCase().includes(normalized),
            )
          : group.models
        if (models.length === 0) return null
        return {
          key: group.providerId,
          label: group.providerName,
          rows: models.map((model) => ({
            modelId: model.id,
            providerId: group.providerId,
            providerType: group.providerType,
            name: model.name,
          })),
        }
      })
      .filter((view): view is ModelGroupView => view !== null)

    if (normalized) return providerViews

    const recentModels = filterRecentModelsWithin(recents, providerGroups)
    if (recentModels.length === 0) return providerViews

    return [
      {
        key: 'recent',
        label: t('write.agent.model.recent'),
        rows: recentModels.map((model) => ({
          modelId: model.modelId,
          providerId: model.providerId,
          providerType: model.providerType,
          name: getModelName(providerGroups, model.providerId, model.modelId),
        })),
      },
      ...providerViews,
    ]
  }, [query, providerGroups, recents, t])

  const isEmpty = !isLoading && providerGroups.length === 0
  const hasResults = groups.some((group) => group.rows.length > 0)

  const handleSelect = (row: ModelRow) => {
    const model: SelectedAgentModel = {
      modelId: row.modelId,
      providerId: row.providerId,
      providerType: row.providerType,
    }
    onSelect(model)
    const next = rememberRecentModel(
      model,
      filterRecentModelsWithin(recents, providerGroups),
    )
    setRecents(next)
    writeRecentModels(next)
    setOpen(false)
    setQuery('')
  }

  const handleOpenChange = (next: boolean) => {
    if (isEmpty) return
    setOpen(next)
    if (!next) setQuery('')
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <Popover.Trigger
        className="inline-flex items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg disabled:opacity-50"
        disabled={isEmpty}
        type="button"
      >
        <Sparkles aria-hidden="true" className="size-3 shrink-0" />
        <span className="max-w-[150px] truncate">
          {isEmpty ? t('write.agent.modelNoConfig') : triggerLabel}
        </span>
        <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
      </Popover.Trigger>
      <Popover.Content
        align="start"
        className="flex max-h-80 w-72 flex-col"
        initialFocus={inputRef}
        side="top"
        sideOffset={6}
      >
        <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
          <Search
            aria-hidden="true"
            className="size-3.5 shrink-0 text-fg-subtle"
          />
          <input
            className="outline-hidden min-w-0 flex-1 bg-transparent text-xs text-fg placeholder:text-fg-subtle"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('write.agent.model.search')}
            ref={inputRef}
            value={query}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {hasResults ? (
            groups.map((group) => (
              <div key={group.key}>
                <div className="px-2 py-1 text-xs uppercase tracking-wide text-fg-subtle">
                  {group.label}
                </div>
                {group.rows.map((row) => {
                  const active =
                    selectedModel?.providerId === row.providerId &&
                    selectedModel?.modelId === row.modelId
                  return (
                    <button
                      className={cn(
                        'flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg',
                        active && 'text-fg',
                      )}
                      key={`${group.key}:${row.providerId}::${row.modelId}`}
                      onClick={() => handleSelect(row)}
                      type="button"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {row.name}
                      </span>
                      {active ? (
                        <Check
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-accent"
                        />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ))
          ) : (
            <div className="px-2 py-6 text-center text-xs text-fg-subtle">
              {t('write.agent.model.empty')}
            </div>
          )}
        </div>
      </Popover.Content>
    </Popover>
  )
}
