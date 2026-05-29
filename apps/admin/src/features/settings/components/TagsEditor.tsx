import { X } from 'lucide-react'
import { useState } from 'react'

import { useI18n } from '~/i18n'
import { TextInput } from '~/ui/primitives/text-field'

export function TagsEditor(props: {
  onChange: (value: string[]) => void
  value: string[]
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')

  const add = () => {
    const value = draft.trim()
    if (!value) return
    props.onChange([...props.value, value])
    setDraft('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {props.value.map((tag) => (
          <button
            className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"
            key={tag}
            onClick={() =>
              props.onChange(props.value.filter((item) => item !== tag))
            }
            type="button"
          >
            {tag}
            <X aria-hidden="true" className="ml-1 inline size-3" />
          </button>
        ))}
      </div>
      <TextInput
        onChange={setDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          }
        }}
        placeholder={t('settings.tags.placeholder')}
        value={draft}
      />
    </div>
  )
}
