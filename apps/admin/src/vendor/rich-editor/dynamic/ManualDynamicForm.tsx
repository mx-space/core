import { useState } from 'react'

import { useI18n } from '~/i18n'
import { PropsEditor } from '~/ui/patterns/PropsEditor'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

const NO_SCHEMA = {}

export function ManualDynamicForm(props: {
  initialHeight: number
  onApply: (value: {
    initialHeight: number
    props: Record<string, unknown>
    url: string
  }) => void
  onBack: () => void
  onRemove: () => void
  props: Record<string, unknown>
  url: string
}) {
  const { t } = useI18n()
  const [url, setUrl] = useState(props.url)
  const [height, setHeight] = useState(String(props.initialHeight))
  const [componentProps, setComponentProps] = useState(props.props)

  const apply = () => {
    const parsedHeight = Number(height)
    props.onApply({
      initialHeight:
        Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 320,
      props: componentProps,
      url: url.trim(),
    })
  }

  return (
    <div className="grid">
      <div className="grid gap-3 p-3">
        <TextInput
          autoFocus
          controlClassName="font-mono text-xs"
          label={t('dynamicNode.url')}
          onChange={setUrl}
          placeholder="https://cdn.example.com/widget.js"
          type="url"
          value={url}
        />
        <TextInput
          label={t('dynamicNode.height')}
          min={0}
          onChange={setHeight}
          type="number"
          value={height}
        />
        <PropsEditor
          onChange={setComponentProps}
          schema={NO_SCHEMA}
          value={componentProps}
        />
        <p className="text-xs text-fg-muted">{t('dynamicNode.manualHint')}</p>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <button
          className="text-xs text-accent hover:text-accent-hover"
          onClick={props.onBack}
          type="button"
        >
          {t('dynamicNode.backToPicker')}
        </button>
        <div className="flex gap-2">
          <Button
            className="text-red-600 dark:text-red-400"
            onClick={props.onRemove}
            type="button"
            variant="subtle"
          >
            {t('dynamicNode.remove')}
          </Button>
          <Button disabled={!url.trim()} onClick={apply} type="button">
            {t('dynamicNode.apply')}
          </Button>
        </div>
      </div>
    </div>
  )
}
