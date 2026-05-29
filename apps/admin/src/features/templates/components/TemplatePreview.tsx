import { AlertCircle, Eye } from 'lucide-react'

import { useI18n } from '~/i18n'

interface TemplatePreviewProps {
  error: string
  html: string
}

export function TemplatePreview(props: TemplatePreviewProps) {
  const { t } = useI18n()

  return (
    <section className="flex h-full min-h-0 flex-col bg-neutral-50 dark:bg-neutral-900">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 px-3 dark:border-neutral-800">
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase text-neutral-500">
          <Eye aria-hidden="true" className="size-4" />
          {t('templates.preview.title')}
        </span>
        {props.error ? (
          <span className="inline-flex items-center gap-1 text-xs text-red-600">
            <AlertCircle aria-hidden="true" className="size-3.5" />
            {t('templates.previewFailed')}
          </span>
        ) : null}
      </div>
      {props.error ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <pre className="whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-200">
            {props.error}
          </pre>
        </div>
      ) : (
        <iframe
          className="min-h-0 w-full flex-1 bg-white"
          sandbox=""
          srcDoc={props.html}
          title={t('templates.preview.title')}
        />
      )}
    </section>
  )
}
