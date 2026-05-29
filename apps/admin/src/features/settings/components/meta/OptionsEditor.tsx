import { Plus, Trash2 } from 'lucide-react'
import type { MetaFieldOption } from '~/models/meta-preset'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

export function OptionsEditor(props: {
  onChange: (options: MetaFieldOption[]) => void
  options: MetaFieldOption[]
}) {
  const { t } = useI18n()
  const update = (index: number, patch: Partial<MetaFieldOption>) => {
    props.onChange(
      props.options.map((option, itemIndex) =>
        itemIndex === index ? { ...option, ...patch } : option,
      ),
    )
  }

  return (
    <section className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {t('settings.meta.options.title')}
        </h3>
        <Button
          onClick={() =>
            props.onChange([...props.options, { label: '', value: '' }])
          }
          type="button"
          variant="subtle"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('settings.meta.action.addOption')}
        </Button>
      </div>
      <div className="space-y-2">
        {props.options.map((option, index) => (
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]" key={index}>
            <TextInput
              onChange={(value) => update(index, { value })}
              placeholder={t('settings.meta.options.placeholderValue')}
              value={String(option.value ?? '')}
            />
            <TextInput
              onChange={(label) => update(index, { label })}
              placeholder={t('settings.meta.options.placeholderLabel')}
              value={option.label}
            />
            <Button
              onClick={() =>
                props.onChange(
                  props.options.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              type="button"
              variant="subtle"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
