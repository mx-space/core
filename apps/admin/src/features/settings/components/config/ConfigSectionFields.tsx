import type { ConfigFormField } from '~/api/options'
import { useI18n } from '~/i18n'
import { messages } from '~/i18n/resources'
import type { TranslationKey } from '~/i18n/types'

import { getPath, shouldShowField } from '../../utils/settings'
import { ConfigFieldEditor } from './ConfigFieldEditor'

export function ConfigSectionFields(props: {
  fields: ConfigFormField[]
  formData: Record<string, unknown>
  onAction: (actionId: string) => void
  prefix: string
  updateValue: (path: string, value: unknown) => void
}) {
  const { locale, t } = useI18n()
  return (
    <div className="space-y-5">
      {props.fields
        .filter((field) => !field.ui.hidden)
        .filter((field) => shouldShowField(field, props.formData, props.prefix))
        .map((field) => {
          const fieldPath = `${props.prefix}.${field.key}`
          const titleKey =
            `settings.schema.${fieldPath}.title` as TranslationKey
          const descriptionKey =
            `settings.schema.${fieldPath}.description` as TranslationKey
          const localizedField = {
            ...field,
            description: Object.hasOwn(messages[locale], descriptionKey)
              ? t(descriptionKey)
              : field.description,
            title: Object.hasOwn(messages[locale], titleKey)
              ? t(titleKey)
              : field.title,
            ui: {
              ...field.ui,
              actionLabel: (() => {
                const actionLabelKey =
                  `settings.schema.${fieldPath}.actionLabel` as TranslationKey
                return Object.hasOwn(messages[locale], actionLabelKey)
                  ? t(actionLabelKey)
                  : field.ui.actionLabel
              })(),
              options: field.ui.options?.map((option) => {
                const optionKey =
                  `settings.schema.${fieldPath}.option.${option.value}` as TranslationKey
                return Object.hasOwn(messages[locale], optionKey)
                  ? { ...option, label: t(optionKey) }
                  : option
              }),
            },
          }

          if (field.fields?.length) {
            return (
              <section className="space-y-3" key={fieldPath}>
                {field.subsection ? (
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-neutral-500">
                      {localizedField.title}
                    </h4>
                    {localizedField.description ? (
                      <p className="mt-1 text-xs text-neutral-500">
                        {localizedField.description}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <ConfigSectionFields
                  fields={field.fields}
                  formData={props.formData}
                  onAction={props.onAction}
                  prefix={fieldPath}
                  updateValue={props.updateValue}
                />
              </section>
            )
          }

          return (
            <ConfigFieldEditor
              field={localizedField}
              key={fieldPath}
              onAction={props.onAction}
              onChange={(value) => props.updateValue(fieldPath, value)}
              value={getPath(props.formData, fieldPath)}
            />
          )
        })}
    </div>
  )
}
