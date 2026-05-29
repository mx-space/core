import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { ReaderModel } from '~/api/readers'
import type { ReactNode } from 'react'

import { useI18n } from '~/i18n'

function KeyValueRow(props: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
        {props.label}
      </span>
      <span className="min-w-0 truncate text-right text-sm text-neutral-800 dark:text-neutral-200">
        {props.children}
      </span>
    </div>
  )
}

export function ReaderIdentityBlock(props: { reader: ReaderModel }) {
  const { t } = useI18n()
  const { reader } = props
  const [copied, setCopied] = useState(false)

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(reader.id)
      setCopied(true)
      toast.success(t('readers.detail.copied'))
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be unavailable; nothing actionable to surface
    }
  }

  const dash = <span className="text-neutral-400">—</span>

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {t('readers.detail.section.identity')}
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('readers.detail.field.id')}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 truncate text-sm text-neutral-800 dark:text-neutral-200">
              {reader.id}
            </code>
            <button
              aria-label={t('readers.detail.copyId')}
              className="shrink-0 text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
              onClick={copyId}
              title={t('readers.detail.copyId')}
              type="button"
            >
              {copied ? (
                <Check aria-hidden="true" className="size-4 text-emerald-500" />
              ) : (
                <Copy aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('readers.detail.field.username')}
          </div>
          <div className="mt-1 truncate text-sm text-neutral-800 dark:text-neutral-200">
            {reader.username || dash}
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 p-3 sm:col-span-2 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('readers.detail.field.displayName')}
          </div>
          <div className="mt-1 truncate text-sm text-neutral-800 dark:text-neutral-200">
            {reader.displayUsername || reader.name || dash}
          </div>
        </div>
      </div>

      <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 px-3 dark:divide-neutral-800 dark:border-neutral-800">
        <KeyValueRow label={t('readers.detail.field.email')}>
          {reader.email || dash}
        </KeyValueRow>
        <KeyValueRow label={t('readers.detail.field.handle')}>
          {reader.handle ? `@${reader.handle}` : dash}
        </KeyValueRow>
        <KeyValueRow label={t('readers.detail.field.role')}>
          {reader.role === 'owner'
            ? t('readers.role.owner')
            : t('readers.role.reader')}
        </KeyValueRow>
      </div>
    </section>
  )
}
