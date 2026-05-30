import { useState } from 'react'

import type { AISummary } from '~/api/ai'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { CodeMirrorEditor } from '~/vendor/codemirror'

import { formatDateString } from '../../utils/ai'
import type { EditDrawerBodyProps } from './types'

export function SummaryEditBody(props: EditDrawerBodyProps<AISummary>) {
  const { t } = useI18n()
  const [summary, setSummary] = useState(props.item.summary)

  const submit = () => {
    if (!summary.trim()) return
    void props.onSubmit({ ...props.item, summary })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section>
          <p className="mb-2 text-sm font-medium text-fg">
            {t('ai.summary.editLabel.content')}
          </p>
          <div className="rounded border border-border">
            <CodeMirrorEditor
              autoFocus
              embedded
              onChange={setSummary}
              renderMode="plain"
              text={summary}
            />
          </div>
        </section>

        <MetaList
          rows={[
            {
              label: t('ai.translation.langLabel'),
              value: props.item.lang.toUpperCase(),
            },
            {
              label: t('ai.task.createdAt'),
              value: formatDateString(props.item.createdAt),
            },
          ]}
        />
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button onClick={props.onCancel} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button
          disabled={props.submitting || !summary.trim()}
          onClick={submit}
          type="button"
          variant="primary"
        >
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}

function MetaList(props: { rows: Array<{ label: string; value: string }> }) {
  const { t } = useI18n()
  return (
    <section>
      <p className="mb-2 text-sm font-medium text-fg">
        {t('ai.summary.editLabel.meta')}
      </p>
      <dl className="grid grid-cols-2 gap-y-1.5 text-xs text-fg-muted">
        {props.rows.map((row) => (
          <div className="contents" key={row.label}>
            <dt className="text-fg-muted">{row.label}</dt>
            <dd className="text-fg">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
