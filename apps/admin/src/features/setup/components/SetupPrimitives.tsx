import { ChevronLeft } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

export function UrlInput(props: {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <TextInput
      autoComplete="url"
      label={props.label}
      onChange={props.onChange}
      placeholder={props.placeholder}
      type="url"
      value={props.value}
    />
  )
}

export function StepActions(props: {
  canSubmit: boolean
  onPrev: () => void
  submitting: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="mt-6 flex justify-between">
      <Button onClick={props.onPrev} type="button" variant="secondary">
        <ChevronLeft aria-hidden="true" className="size-4" />
        {t('common.back')}
      </Button>
      <Button disabled={!props.canSubmit || props.submitting} type="submit">
        {t('setup.step.next')}
      </Button>
    </div>
  )
}
