import { useState } from 'react'
import type { AIInsights } from '~/api/ai'
import type { EditDrawerBodyProps } from './types'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { CodeMirrorEditor } from '~/vendor/codemirror'

import { formatDateString } from '../../utils/ai'

export function InsightsEditBody(props: EditDrawerBodyProps<AIInsights>) {
  const { t } = useI18n()
  const [content, setContent] = useState(props.item.content)

  const submit = () => {
    if (!content.trim()) return
    void props.onSubmit({ ...props.item, content })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section>
          <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('ai.insights.editLabel.content')}
          </p>
          <div className="rounded border border-neutral-200 dark:border-neutral-800">
            <CodeMirrorEditor
              autoFocus
              embedded
              onChange={setContent}
              renderMode="plain"
              text={content}
            />
          </div>
        </section>

        <section>
          <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('ai.insights.editLabel.meta')}
          </p>
          <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
            <Row
              label={t('ai.translation.langLabel')}
              value={props.item.lang.toUpperCase()}
            />
            <Row
              label={t('ai.task.createdAt')}
              value={formatDateString(props.item.createdAt)}
            />
            {props.item.isTranslation ? (
              <Row
                label={t('ai.taskType.insightsTranslation')}
                value={props.item.sourceLang?.toUpperCase() ?? '-'}
              />
            ) : null}
          </dl>
        </section>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <Button onClick={props.onCancel} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button
          disabled={props.submitting || !content.trim()}
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

function Row(props: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="text-neutral-500 dark:text-neutral-400">{props.label}</dt>
      <dd className="text-neutral-700 dark:text-neutral-200">{props.value}</dd>
    </div>
  )
}
