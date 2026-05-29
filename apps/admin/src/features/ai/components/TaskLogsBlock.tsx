import { RefreshCw } from 'lucide-react'
import type { AITaskLog } from '~/api/ai'

import { useI18n } from '~/i18n'
import { Scroll } from '~/ui/primitives/scroll'

import { TaskLogRow } from './TaskLogRow'

interface TaskLogsBlockProps {
  logs: AITaskLog[] | undefined
  polling: boolean
}

export function TaskLogsBlock(props: TaskLogsBlockProps) {
  const { t } = useI18n()
  const logs = props.logs ?? []

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between text-xs">
        <h3 className="font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {t('ai.tasks.logs.title')}
        </h3>
        {props.polling ? (
          <span className="inline-flex items-center gap-1 text-neutral-400 dark:text-neutral-500">
            <RefreshCw aria-hidden="true" className="size-3 animate-spin" />
            <span>{t('ai.tasks.logs.auto')}</span>
          </span>
        ) : null}
      </div>
      {logs.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          {t('ai.tasks.logs.emptyDetail')}
        </p>
      ) : (
        <Scroll
          className="overflow-hidden rounded border border-neutral-200 dark:border-neutral-800"
          viewportClassName="max-h-[22rem]"
        >
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
            {logs.map((log, index) => (
              <TaskLogRow key={`${log.timestamp}-${index}`} log={log} />
            ))}
          </div>
        </Scroll>
      )}
    </section>
  )
}
