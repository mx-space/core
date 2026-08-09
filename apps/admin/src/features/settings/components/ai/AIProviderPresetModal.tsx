import { CloudCog } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useI18n } from '~/i18n'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

import {
  type AIProviderPreset,
  type AIProviderPresetTemplateValues,
  interpolatePresetTemplate,
} from '../../config/aiProviderPresets'

function AIProviderPresetModal(props: { preset: AIProviderPreset }) {
  const { t } = useI18n()
  const modal = useModal<AIProviderPresetTemplateValues>()
  const [values, setValues] = useState<AIProviderPresetTemplateValues>({})
  const endpoint = interpolatePresetTemplate(props.preset.endpoint, values)

  const submit = () => {
    const missingRequiredField = props.preset.templateFields?.some(
      (field) => field.required && !values[field.key]?.trim(),
    )
    if (missingRequiredField) {
      toast.warning(t('settings.ai.preset.modal.requiredField'))
      return
    }
    modal.close(values)
  }

  return (
    <form
      className="flex w-[min(92vw,30rem)] flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <ModalHeader
        icon={CloudCog}
        subtitle={t('settings.ai.preset.modal.description')}
        title={t('settings.ai.preset.modal.title')}
      />
      <div className="space-y-4 px-5 py-5">
        {props.preset.templateFields?.map((field) => (
          <div className="space-y-1.5" key={field.key}>
            <TextInput
              autoFocus
              label={t('settings.ai.field.projectId')}
              onChange={(projectId) =>
                setValues((current) => ({ ...current, projectId }))
              }
              placeholder={t('settings.ai.preset.modal.projectIdPlaceholder')}
              required={field.required}
              spellCheck={false}
              value={values.projectId ?? ''}
            />
            <p className="text-xs leading-5 text-fg-muted">
              {t('settings.ai.preset.modal.projectIdHelp')}
            </p>
          </div>
        ))}
        <div className="rounded-md border border-border bg-surface-inset px-3 py-2.5">
          <div className="mb-1 text-xs font-medium text-fg-muted">
            {t('settings.ai.preset.modal.endpointPreview')}
          </div>
          <div className="break-all font-mono text-xs leading-5 text-fg">
            {endpoint}
          </div>
        </div>
      </div>
      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button type="submit">{t('settings.ai.preset.modal.add')}</Button>
      </ModalFooter>
    </form>
  )
}

export function presentAIProviderPresetModal(preset: AIProviderPreset) {
  return present<{ preset: AIProviderPreset }, AIProviderPresetTemplateValues>(
    AIProviderPresetModal,
    { preset },
  )
}
