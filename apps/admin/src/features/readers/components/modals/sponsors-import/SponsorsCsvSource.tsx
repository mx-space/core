import { useMutation } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import type { SponsorCsvPreviewRow } from '~/api/readers'
import { previewSponsorsCsv } from '~/api/readers'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { TextArea } from '~/ui/primitives/text-field'

import { SPONSORS_CSV_PROMPT } from './sponsors-csv-prompt'
import type { SponsorEntry, SponsorSourceState } from './types'

const toEntry = (row: SponsorCsvPreviewRow): SponsorEntry => ({
  key: `csv:${row.line}`,
  title: row.githubId ?? row.email ?? row.handle ?? `#${row.line}`,
  subtitle: row.note,
  avatarUrl: null,
  badge: null,
  months: row.months,
  reader: row.reader,
})

export function SponsorsCsvSource(props: {
  children: (state: SponsorSourceState) => ReactNode
}) {
  const { t } = useI18n()
  const [csv, setCsv] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const preview = useMutation({
    mutationFn: (text: string) => previewSponsorsCsv(text),
  })

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(SPONSORS_CSV_PROMPT)
    toast.success(t('readers.sponsors.import.csv.promptCopied'))
  }

  const error = preview.isError
    ? preview.error instanceof Error && preview.error.message
      ? preview.error.message
      : t('readers.sponsors.import.loadFailed')
    : null

  return (
    <>
      <div className="flex flex-col gap-2 px-5 py-3">
        <TextArea
          controlClassName="min-h-28 font-mono text-xs"
          onChange={setCsv}
          placeholder={t('readers.sponsors.import.csv.placeholder')}
          spellCheck={false}
          value={csv}
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            type="button"
            variant="subtle"
          >
            {t('readers.sponsors.import.csv.chooseFile')}
          </Button>
          <Button onClick={copyPrompt} type="button" variant="subtle">
            {t('readers.sponsors.import.csv.copyPrompt')}
          </Button>
          <span className="flex-1 truncate text-xs text-neutral-500">
            {t('readers.sponsors.import.csv.hint')}
          </span>
          <Button
            disabled={csv.trim() === '' || preview.isPending}
            onClick={() => preview.mutate(csv)}
            type="button"
          >
            {t('readers.sponsors.import.csv.preview')}
          </Button>
        </div>
        <input
          accept=".csv,text/csv"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            const text = await file.text()
            setCsv(text)
            preview.mutate(text)
          }}
          ref={fileInputRef}
          type="file"
        />
      </div>
      {props.children({
        entries: (preview.data ?? []).map(toEntry),
        loading: preview.isPending,
        error,
        emptyText: t('readers.sponsors.import.csv.empty'),
      })}
    </>
  )
}
