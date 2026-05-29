import type { ConfigFormField } from '~/api/options'

import { getPath, shouldShowField } from '../../utils/settings'
import { ConfigFieldEditor } from './ConfigFieldEditor'

export function ConfigSectionFields(props: {
  fields: ConfigFormField[]
  formData: Record<string, unknown>
  onAction: (actionId: string) => void
  prefix: string
  updateValue: (path: string, value: unknown) => void
}) {
  return (
    <div className="space-y-5">
      {props.fields
        .filter((field) => !field.ui.hidden)
        .filter((field) => shouldShowField(field, props.formData, props.prefix))
        .map((field) => {
          const fieldPath = `${props.prefix}.${field.key}`

          if (field.fields?.length) {
            return (
              <section className="space-y-3" key={fieldPath}>
                {field.subsection ? (
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-neutral-500">
                      {field.subsection.title}
                    </h4>
                    {field.subsection.description ? (
                      <p className="mt-1 text-xs text-neutral-500">
                        {field.subsection.description}
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
              field={field}
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
