import { FileText } from 'lucide-react'

import type { IPAggregate } from '~/api/analyze'
import { useI18n } from '~/i18n'
import { Panel } from '~/ui/primitives/panel'

import { AnalyzeSkeleton, EmptyBlock } from '../AnalyzePrimitives'
import { BarList } from '../BarList'

export function AnalyzePathsPanel(props: {
  aggregate: IPAggregate | undefined
  isLoading: boolean
}) {
  const { t } = useI18n()
  const paths = props.aggregate?.paths ?? []

  return (
    <Panel
      description={t('analyze.path.description')}
      title={
        <span className="inline-flex items-center gap-2">
          <FileText aria-hidden="true" className="size-4" />
          {t('analyze.path.title')}
        </span>
      }
    >
      {props.isLoading ? (
        <AnalyzeSkeleton />
      ) : paths.length ? (
        <BarList
          className="p-4"
          items={paths.slice(0, 10).map((path) => ({
            key: path.path,
            label: path.path,
            title: path.path,
            value: path.count,
          }))}
        />
      ) : (
        <EmptyBlock label={t('analyze.path.empty')} />
      )}
    </Panel>
  )
}
