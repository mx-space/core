import { useState } from 'react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

interface GeneratePromptBodyProps {
  promptForLang: boolean
  submitting: boolean
  generateLabel: string
  langLabel: string
  inlineEmpty?: string
  onSubmit: (input: { lang?: string }) => Promise<void> | void
  onCancel: () => void
}

export function GeneratePromptBody(props: GeneratePromptBodyProps) {
  const { t } = useI18n()
  const [lang, setLang] = useState('zh')

  const handleSubmit = () => {
    if (props.promptForLang) {
      const trimmed = lang.trim().toLowerCase()
      if (!trimmed) return
      void props.onSubmit({ lang: trimmed })
    } else {
      void props.onSubmit({})
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {props.promptForLang ? (
          <TextInput
            autoFocus
            label={props.langLabel}
            onChange={setLang}
            placeholder="zh"
            value={lang}
          />
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {props.inlineEmpty ?? props.generateLabel}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <Button onClick={props.onCancel} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button
          disabled={props.submitting}
          onClick={handleSubmit}
          type="button"
          variant="primary"
        >
          {props.generateLabel}
        </Button>
      </div>
    </div>
  )
}
