import type { ConfigFormField } from '~/api/options'

import { Button } from '~/ui/primitives/button'
import { SelectField } from '~/ui/primitives/select'
import { TextArea, TextInput } from '~/ui/primitives/text-field'

import { stringValue } from '../../utils/settings'
import { TagsEditor } from '../TagsEditor'

export function renderConfigControl(props: {
  field: ConfigFormField
  onAction: (actionId: string) => void
  onChange: (value: unknown) => void
  value: unknown
}) {
  const { field } = props
  const placeholder = field.ui.placeholder

  switch (field.ui.component) {
    case 'password':
      return (
        <TextInput
          onChange={props.onChange as (value: string) => void}
          placeholder={placeholder}
          type="password"
          value={stringValue(props.value)}
        />
      )
    case 'textarea':
      return (
        <TextArea
          controlClassName="min-h-24"
          onChange={props.onChange as (value: string) => void}
          placeholder={placeholder}
          value={stringValue(props.value)}
        />
      )
    case 'number':
      return (
        <TextInput
          inputMode="decimal"
          onChange={(value) =>
            props.onChange(value.trim() ? Number(value) : undefined)
          }
          placeholder={placeholder}
          type="number"
          value={
            typeof props.value === 'number'
              ? String(props.value)
              : stringValue(props.value)
          }
        />
      )
    case 'select':
      return (
        <SelectField<number | string>
          aria-label={field.title}
          onValueChange={props.onChange}
          options={field.ui.options ?? []}
          value={
            typeof props.value === 'number' || typeof props.value === 'string'
              ? props.value
              : (field.ui.options?.[0]?.value ?? '')
          }
        />
      )
    case 'tags':
      return (
        <TagsEditor
          onChange={props.onChange}
          value={Array.isArray(props.value) ? props.value.map(String) : []}
        />
      )
    case 'action':
      return (
        <div>
          <Button
            onClick={() => {
              if (field.ui.actionId) props.onAction(field.ui.actionId)
            }}
            type="button"
            variant="subtle"
          >
            {field.ui.actionLabel || field.title}
          </Button>
        </div>
      )
    case 'input':
    default:
      return (
        <TextInput
          onChange={props.onChange as (value: string) => void}
          placeholder={placeholder}
          value={stringValue(props.value)}
        />
      )
  }
}
