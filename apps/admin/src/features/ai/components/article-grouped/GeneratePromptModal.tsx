import type { FormEvent } from 'react'
import { useState } from 'react'

import { SmallBadge } from '~/features/tasks/components/TaskPrimitives'
import { useI18n } from '~/i18n'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { TextInput } from '~/ui/primitives/text-field'

import { parseLangInput } from '../../utils/ai'

const MAX_LANGS = 8

export interface GeneratePromptModalProps {
  title: string
  promptForLang: boolean
  langLabel: string
  inlineEmpty?: string
  defaultLangs?: string[]
}

export interface GeneratePromptResult {
  langs: string[]
  force: boolean
}

function GeneratePromptModal(props: GeneratePromptModalProps) {
  const { t } = useI18n()
  const modal = useModal<GeneratePromptResult>()
  const [langInput, setLangInput] = useState(
    props.defaultLangs?.join(', ') ?? '',
  )
  const [force, setForce] = useState(false)

  const langs = parseLangInput(langInput)
  const tooMany = langs.length > MAX_LANGS

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault()
    if (tooMany) return
    modal.close({
      force,
      langs: props.promptForLang ? langs : [],
    })
  }

  return (
    <form className="flex w-full flex-col" onSubmit={handleSubmit}>
      <ModalHeader title={props.title} />
      <div className="space-y-4 px-5 py-4">
        {props.promptForLang ? (
          <div className="grid gap-1.5 text-sm">
            <TextInput
              autoFocus
              label={props.langLabel}
              onChange={setLangInput}
              placeholder="zh, en, ja"
              value={langInput}
            />
            <p className="text-xs text-fg-muted">
              {t('ai.generate.langsHint')}
            </p>
            {langs.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {langs.map((lang) => (
                  <SmallBadge key={lang}>{lang}</SmallBadge>
                ))}
                <span className="text-xs text-fg-muted">
                  {t('ai.generate.langsCount', { count: langs.length })}
                </span>
              </div>
            ) : null}
            {tooMany ? (
              <span className="text-xs text-red-500">
                {t('ai.generate.langsTooMany', { max: MAX_LANGS })}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            {props.inlineEmpty ?? props.title}
          </p>
        )}
        <div className="grid gap-1">
          <Checkbox
            checked={force}
            label={t('ai.generate.forceLabel')}
            onCheckedChange={setForce}
          />
          <p className="text-xs text-fg-muted">{t('ai.generate.forceHint')}</p>
        </div>
      </div>
      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button disabled={tooMany} type="submit" variant="primary">
          {props.title}
        </Button>
      </ModalFooter>
    </form>
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
