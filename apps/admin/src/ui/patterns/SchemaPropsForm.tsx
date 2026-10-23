import { useMemo } from 'react'

import { useI18n } from '~/i18n'
import type { PropsField } from '~/lib/dynamic-props'
import { applyFieldValue, fieldsFromSchema } from '~/lib/dynamic-props'
import { SelectField } from '~/ui/primitives/select'
import { Switch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'

export function SchemaPropsForm(props: {
  onChange: (value: Record<string, unknown>) => void
  schema: Record<string, unknown>
  value: Record<string, unknown>
}) {
  const { t } = useI18n()
  const fields = useMemo(() => fieldsFromSchema(props.schema), [props.schema])

  if (fields.length === 0) {
    return <p className="text-xs text-fg-muted">{t('dynamicProps.noFields')}</p>
  }

  const update = (field: PropsField, input: boolean | string) =>
    props.onChange(applyFieldValue(props.value, field, input))

  return (
    <div className="grid gap-3">
      {fields.map((field) => (
        <div className="grid gap-1" key={field.key}>
          <FieldControl
            field={field}
            onInput={(input) => update(field, input)}
            value={props.value[field.key]}
          />
          {field.description ? (
            <p className="text-xs text-fg-muted">{field.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function FieldControl(props: {
  field: PropsField
  onInput: (input: boolean | string) => void
  value: unknown
}) {
  const { field } = props
  const placeholder =
    field.defaultValue === undefined ? undefined : String(field.defaultValue)

  if (field.kind === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-3 text-sm font-medium text-fg">
        <span>
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </span>
        <Switch
          aria-label={field.label}
          checked={Boolean(props.value ?? field.defaultValue)}
          onCheckedChange={props.onInput}
        />
      </label>
    )
  }

  if (field.kind === 'enum') {
    return (
      <div className="grid gap-1.5 text-sm">
        <span className="font-medium text-fg">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </span>
        <SelectField
          aria-label={field.label}
          onValueChange={props.onInput}
          options={field.options.map((option) => ({
            label: option,
            value: option,
          }))}
          value={String(props.value ?? field.defaultValue ?? '')}
        />
      </div>
    )
  }

  return (
    <TextInput
      inputMode={field.kind === 'number' ? 'decimal' : undefined}
      label={field.label}
      name={field.key}
      onChange={props.onInput}
      placeholder={placeholder}
      required={field.required}
      type={field.kind === 'number' ? 'number' : 'text'}
      value={props.value === undefined ? '' : String(props.value)}
    />
  )
}
