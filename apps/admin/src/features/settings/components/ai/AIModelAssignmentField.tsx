import { ChevronDown } from 'lucide-react'
import { useCallback, useMemo } from 'react'

import { useI18n } from '~/i18n'
import { Combobox } from '~/ui/primitives/combobox'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'

import type {
  AIModelAssignment,
  AIProviderCapability,
  AIProviderConfig,
  AIProviderModel,
  AIReasoningEffort,
} from '../../types/settings'
import { formatAIModelPricing } from '../../utils/aiModelPricing'
import { formatAIProviderLabel } from '../../utils/settings'

const REASONING_EFFORTS: AIReasoningEffort[] = ['none', 'low', 'medium', 'high']

export function AIModelAssignmentField(props: {
  capability?: AIProviderCapability
  description?: string
  label: string
  modelPlaceholder?: string
  models: Record<string, AIProviderModel[]>
  onChange: (value: AIModelAssignment | null) => void
  providers: AIProviderConfig[]
  value?: AIModelAssignment | null
}) {
  const { t } = useI18n()
  const providerId = props.value?.providerId ?? ''
  const modelValue = props.value?.model ?? ''
  const providerModels = providerId ? (props.models[providerId] ?? []) : []
  const capability = props.capability ?? 'text'
  const showReasoning = capability === 'text'
  const providers = props.providers.filter((provider) =>
    capability === 'text'
      ? (provider.capabilities?.text ?? true)
      : Boolean(provider.capabilities?.[capability]),
  )
  const modelIds = useMemo(
    () => providerModels.map((model) => model.id),
    [providerModels],
  )
  const modelById = useMemo(
    () => new Map(providerModels.map((model) => [model.id, model])),
    [providerModels],
  )
  const filterModel = useCallback(
    (itemValue: unknown, query: string) => {
      if (typeof itemValue !== 'string') return false
      const normalizedQuery = query.trim().toLocaleLowerCase()
      const model = modelById.get(itemValue)
      return [itemValue, model?.name].some((value) =>
        value?.toLocaleLowerCase().includes(normalizedQuery),
      )
    },
    [modelById],
  )
  const reasoningEffort = props.value?.reasoningEffort ?? 'none'

  const patch = (next: Partial<AIModelAssignment>) => {
    const providerIdNext =
      next.providerId !== undefined ? next.providerId : providerId
    if (!providerIdNext) {
      props.onChange(null)
      return
    }
    props.onChange({
      providerId: providerIdNext,
      model: 'model' in next ? next.model : props.value?.model,
      reasoningEffort:
        'reasoningEffort' in next
          ? next.reasoningEffort
          : props.value?.reasoningEffort,
    })
  }

  return (
    <div className="grid items-center gap-2 text-sm md:grid-cols-[12rem_minmax(0,1fr)]">
      <div>
        <div className="font-medium text-neutral-700 dark:text-neutral-300">
          {props.label}
        </div>
        {props.description ? (
          <p className="mt-1 text-xs text-neutral-500">{props.description}</p>
        ) : null}
      </div>
      <div
        className={
          showReasoning
            ? 'grid items-center gap-2 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,8.5rem)]'
            : 'grid items-center gap-2 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]'
        }
      >
        <SelectField<string>
          aria-label={t('settings.ai.assignment.providerAriaLabel', {
            label: props.label,
          })}
          onValueChange={(nextProviderId) =>
            nextProviderId
              ? patch({
                  providerId: nextProviderId,
                  model: undefined,
                })
              : props.onChange(null)
          }
          options={[
            { label: t('settings.ai.assignment.providerNone'), value: '' },
            ...providers.map((provider) => ({
              label: formatAIProviderLabel(provider),
              value: provider.id,
            })),
          ]}
          value={providerId}
        />
        <Combobox
          autoComplete="list"
          disabled={!providerId}
          filter={filterModel}
          inputValue={modelValue}
          items={modelIds}
          onInputValueChange={(next) => patch({ model: next })}
          onValueChange={(next) => {
            if (typeof next === 'string') patch({ model: next })
          }}
        >
          <Combobox.Control>
            <Combobox.Input
              aria-label={t('settings.ai.assignment.modelAriaLabel', {
                label: props.label,
              })}
              placeholder={
                props.modelPlaceholder ??
                t('settings.ai.assignment.modelPlaceholder')
              }
            />
            <Combobox.Trigger
              aria-label={t('settings.ai.assignment.openModelList')}
            >
              <ChevronDown aria-hidden="true" className="size-4" />
            </Combobox.Trigger>
          </Combobox.Control>
          <Combobox.Content>
            <Combobox.Empty />
            <Scroll
              className="max-h-72"
              innerClassName="p-1"
              viewportClassName="max-h-72"
            >
              <Combobox.List>
                {(id: string) => {
                  const model = modelById.get(id)
                  const name = model?.name || id
                  const pricing = formatAIModelPricing(model?.pricing, t)
                  return (
                    <Combobox.Item key={id} value={id}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="min-w-0 flex-1 truncate">
                          <span>{name}</span>
                          {name !== id ? (
                            <span className="ml-2 text-xs text-fg-subtle">
                              {id}
                            </span>
                          ) : null}
                        </span>
                        {pricing ? (
                          <span className="shrink-0 text-xs tabular-nums text-fg-muted">
                            {pricing}
                          </span>
                        ) : null}
                      </span>
                    </Combobox.Item>
                  )
                }}
              </Combobox.List>
            </Scroll>
          </Combobox.Content>
        </Combobox>
        {showReasoning ? (
          <SelectField<AIReasoningEffort>
            aria-label={t('settings.ai.assignment.reasoningAriaLabel', {
              label: props.label,
            })}
            disabled={!providerId}
            onValueChange={(next) =>
              patch({
                reasoningEffort: next === 'none' ? undefined : next,
              })
            }
            options={REASONING_EFFORTS.map((value) => ({
              label: t(`settings.ai.assignment.reasoning.${value}`),
              value,
            }))}
            value={reasoningEffort}
          />
        ) : null}
      </div>
    </div>
  )
}
