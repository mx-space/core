import { useState } from 'react'

import { useI18n } from '~/i18n'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

export interface GeneratePromptModalProps {
  title: string
  promptForLang: boolean
  langLabel: string
  inlineEmpty?: string
}

export interface GeneratePromptResult {
  lang?: string
}

function GeneratePromptModal(props: GeneratePromptModalProps) {
  const { t } = useI18n()
  const modal = useModal<GeneratePromptResult>()
  const [lang, setLang] = useState('zh')

  const handleSubmit = () => {
    if (props.promptForLang) {
      const trimmed = lang.trim().toLowerCase()
      if (!trimmed) return
      modal.close({ lang: trimmed })
    } else {
      modal.close({})
    }
  }

  return (
    <div className="flex w-full flex-col">
      <ModalHeader title={props.title} />
      <div className="space-y-4 px-5 py-4">
        {props.promptForLang ? (
          <TextInput
            autoFocus
            label={props.langLabel}
            onChange={setLang}
            placeholder="zh"
            value={lang}
          />
        ) : (
          <p className="text-sm text-fg-muted">
            {props.inlineEmpty ?? props.title}
          </p>
        )}
      </div>
      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSubmit} type="button" variant="primary">
          {props.title}
        </Button>
      </ModalFooter>
    </div>
  )
}

export async function presentGeneratePrompt(
  props: GeneratePromptModalProps,
): Promise<GeneratePromptResult | undefined> {
  const handle = present<GeneratePromptModalProps, GeneratePromptResult>(
    GeneratePromptModal,
    props,
    { modalProps: { popupStyle: { width: 'min(92vw, 28rem)' } } },
  )
  return await handle
}
