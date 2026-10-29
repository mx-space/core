import { X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

import { FieldShell } from '../SettingsPrimitives'
import { parseTargetLanguageDraft } from './target-language'

export function AITextListField(props: {
  disabled?: boolean
  label: string
  onChange: (value: string[]) => void
  value: string[]
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')

  const add = () => {
    if (!draft.trim() || props.disabled) return
    const parsed = parseTargetLanguageDraft(draft, props.value)
    if ('error' in parsed) {
      toast.warning(
        parsed.error === 'exists'
          ? t('settings.ai.test.languageExists', { language: parsed.lang })
          : t('settings.ai.test.invalidLanguageCode'),
      )
      return
    }
    props.onChange([...props.value, parsed.lang])
    setDraft('')
  }

  return (
    <FieldShell label={props.label}>
      <div className="space-y-2">
        <div className="flex gap-2">
          <TextInput
            className="min-w-0 flex-1"
            disabled={props.disabled}
            maxLength={16}
            onChange={setDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            placeholder={t('settings.ai.test.placeholder')}
            value={draft}
          />
          <Button
            className="shrink-0 whitespace-nowrap"
            disabled={props.disabled || !draft.trim()}
            onClick={add}
            type="button"
            variant="subtle"
          >
            {t('common.add')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {props.value.map((item) => (
            <button
              className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-900 dark:text-neutral-300"
              disabled={props.disabled}
              key={item}
              onClick={() =>
                props.onChange(props.value.filter((value) => value !== item))
              }
              type="button"
            >
              {item}
              <X aria-hidden="true" className="ml-1 inline size-3" />
            </button>
          ))}
        </div>
      </div>
    </FieldShell>
  )
}
