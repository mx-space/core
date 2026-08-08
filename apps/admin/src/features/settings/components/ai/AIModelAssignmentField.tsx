import { useI18n } from '~/i18n'
import { SelectField } from '~/ui/primitives/select'
import { TextInput } from '~/ui/primitives/text-field'

import type {
  AIModelAssignment,
  AIProviderCapability,
  AIProviderConfig,
  AIProviderModel,
} from '../../types/settings'
import { formatAIProviderLabel } from '../../utils/settings'

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
  const modelListId = `assignment-models-${props.label}`
  const providerId = props.value?.providerId ?? ''
  const providerModels = providerId ? (props.models[providerId] ?? []) : []
  const capability = props.capability ?? 'text'
  const providers = props.providers.filter((provider) =>
    capability === 'text'
      ? (provider.capabilities?.text ?? true)
      : Boolean(provider.capabilities?.[capability]),
  )

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
      <div className="grid items-center gap-2 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <SelectField<string>
          aria-label={t('settings.ai.assignment.providerAriaLabel', {
            label: props.label,
          })}
          onValueChange={(nextProviderId) =>
            props.onChange(
              nextProviderId
                ? { providerId: nextProviderId, model: undefined }
                : null,
            )
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
        <TextInput
          disabled={!providerId}
          list={modelListId}
          onChange={(model) =>
            props.onChange(providerId ? { providerId, model } : null)
          }
          placeholder={
            props.modelPlaceholder ??
            t('settings.ai.assignment.modelPlaceholder')
          }
          value={props.value?.model ?? ''}
        />
        <datalist id={modelListId}>
          {providerModels.map((model) => (
            <option
              key={model.id}
              label={model.name || model.id}
              value={model.id}
            />
          ))}
        </datalist>
      </div>
    </div>
  )
}
