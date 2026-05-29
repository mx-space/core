import { FileText, Loader2 } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { SelectField } from '~/ui/primitives/select'

import { importTypeOptions } from '../../constants'
import { ImportType } from '../../types/markdown'

interface ImportTopBarProps {
  hasData: boolean
  importType: ImportType
  importing: boolean
  onClear: () => void
  onImportTypeChange: (next: ImportType) => void
  onSubmit: () => void
  parsedCount: number
  totalChars: number
}

export function ImportTopBar(props: ImportTopBarProps) {
  const { t } = useI18n()

  const submitDisabled = !props.hasData || props.importing

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-neutral-200 px-4 dark:border-neutral-800">
      <label
        className="shrink-0 text-xs font-medium uppercase tracking-wide text-neutral-500"
        htmlFor="markdown-import-type"
      >
        {t('markdown.import.toLabel')}
      </label>
      <div className="w-28 shrink-0">
        <SelectField<ImportType>
          id="markdown-import-type"
          onValueChange={props.onImportTypeChange}
          options={importTypeOptions.map((opt) => ({
            label: t(opt.labelKey),
            value: opt.value,
          }))}
          triggerClassName="h-8"
          value={props.importType}
        />
      </div>

      <div className="flex-1" />

      {props.hasData ? (
        <span className="hidden text-xs tabular-nums text-neutral-500 sm:inline dark:text-neutral-400">
          {t('markdown.import.parsedCount', { count: props.parsedCount })} ·{' '}
          {props.totalChars.toLocaleString()}
        </span>
      ) : null}

      {props.hasData ? (
        <Button
          className="h-8 shrink-0 px-3 text-xs"
          onClick={props.onClear}
          type="button"
          variant="subtle"
        >
          {t('markdown.import.clear')}
        </Button>
      ) : null}

      <Button
        className="h-8 shrink-0 px-3 text-xs"
        disabled={submitDisabled}
        onClick={props.onSubmit}
        type="button"
      >
        {props.importing ? (
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        ) : (
          <FileText aria-hidden="true" className="size-3.5" />
        )}
        {props.hasData
          ? t('markdown.import.submitButton', { count: props.parsedCount })
          : t('markdown.import.submitButton', { count: 0 })}
      </Button>
    </div>
  )
}
