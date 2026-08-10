import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useI18n } from '~/i18n'

import { normaliseLangInput } from './coverage-cells'

export function AddLanguageControl(props: {
  onAdd: (lang: string) => void
  /** Renders the trigger as a labelled button rather than a bare icon. */
  labelled?: boolean
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const commit = () => {
    const lang = normaliseLangInput(value)
    if (!lang) {
      toast.error(t('ai.overview.addLangInvalid'))
      return
    }
    props.onAdd(lang)
    setValue('')
    setOpen(false)
  }

  if (open) {
    return (
      <input
        aria-label={t('ai.overview.addLang')}
        autoFocus
        className="w-24 rounded-sm border border-border bg-surface-card px-2 py-0.5 text-xs text-fg focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
        onBlur={() => setOpen(false)}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') setOpen(false)
        }}
        placeholder={t('ai.overview.addLangPlaceholder')}
        value={value}
      />
    )
  }

  return (
    <button
      aria-label={t('ai.overview.addLang')}
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-fg-muted transition-colors hover:bg-surface-card hover:text-fg focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
      onClick={() => setOpen(true)}
      title={t('ai.overview.addLang')}
      type="button"
    >
      <Plus aria-hidden="true" className="size-3.5" />
      {props.labelled ? t('ai.overview.addLang') : null}
    </button>
  )
}
