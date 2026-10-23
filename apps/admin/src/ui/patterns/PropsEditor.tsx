import { useState } from 'react'

import { useI18n } from '~/i18n'
import {
  fieldsFromSchema,
  formatJson,
  parseJsonObject,
} from '~/lib/dynamic-props'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { TextArea } from '~/ui/primitives/text-field'

import { SchemaPropsForm } from './SchemaPropsForm'

type PropsEditorMode = 'form' | 'json'

export function PropsEditor(props: {
  onChange: (value: Record<string, unknown>) => void
  schema: Record<string, unknown>
  value: Record<string, unknown>
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState<PropsEditorMode>(() =>
    fieldsFromSchema(props.schema).length > 0 ? 'form' : 'json',
  )
  const [jsonText, setJsonText] = useState(() => formatJson(props.value))
  const [jsonInvalid, setJsonInvalid] = useState(false)

  const switchMode = (next: PropsEditorMode) => {
    if (next === 'json') {
      setJsonText(formatJson(props.value))
      setJsonInvalid(false)
    }
    setMode(next)
  }

  return (
    <div className="grid gap-3">
      <SegmentedControl<PropsEditorMode>
        className="justify-self-start"
        onValueChange={switchMode}
        options={[
          { label: t('dynamicProps.form'), value: 'form' },
          { label: 'JSON', value: 'json' },
        ]}
        value={mode}
      />
      {mode === 'form' ? (
        <SchemaPropsForm
          onChange={props.onChange}
          schema={props.schema}
          value={props.value}
        />
      ) : (
        <div className="grid gap-1.5">
          <TextArea
            controlClassName="min-h-28 font-mono text-xs leading-5"
            onChange={(text) => {
              setJsonText(text)
              const parsed = parseJsonObject(text)
              setJsonInvalid(!parsed)
              if (parsed) props.onChange(parsed)
            }}
            spellCheck={false}
            value={jsonText}
          />
          {jsonInvalid ? (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {t('dynamicProps.jsonInvalid')}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
