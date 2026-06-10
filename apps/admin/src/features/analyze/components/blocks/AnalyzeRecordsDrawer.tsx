import { useQuery } from '@tanstack/react-query'
import { Table2 } from 'lucide-react'
import { useState } from 'react'

import { getAnalyzeList } from '~/api/analyze'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { Drawer } from '~/ui/feedback/drawer'
import { Scroll } from '~/ui/primitives/scroll'

import { pageSize } from '../../constants'
import { AnalyzeSkeleton, EmptyBlock, ErrorBlock } from '../AnalyzePrimitives'
import { AnalyzeRecordRow } from '../AnalyzeRecordRow'

export function AnalyzeRecordsDrawer(props: {
  onClose: () => void
  open: boolean
}) {
  const { t } = useI18n()
  const [page, setPage] = useState(1)

  const recordsQuery = useQuery({
    enabled: props.open,
    placeholderData: (previous) => previous,
    queryFn: () => getAnalyzeList({ page, size: pageSize }),
    queryKey: adminQueryKeys.analyze.records({ page, size: pageSize }),
  })

  const records = recordsQuery.data?.data ?? []
  const pagination = recordsQuery.data?.pagination
  const totalPages = pagination?.totalPages ?? 1

  return (
    <Drawer
      bodyClassName="min-h-0"
      footer={
        pagination && totalPages > 1 ? (
          <CompactPagination
            onPageChange={setPage}
            onPageSizeChange={() => undefined}
            page={page}
            pageCount={totalPages}
            pageSize={pageSize}
            pageSizes={[pageSize]}
          />
        ) : undefined
      }
      icon={Table2}
      onClose={props.onClose}
      open={props.open}
      title={t('analyze.records.title')}
      widthClassName="w-[min(92vw,46rem)]"
    >
      {recordsQuery.isLoading && records.length === 0 ? (
        <AnalyzeSkeleton />
      ) : recordsQuery.isError ? (
        <ErrorBlock
          label={t('analyze.records.error')}
          onRetry={() => void recordsQuery.refetch()}
        />
      ) : records.length ? (
        <Scroll className="min-h-0 flex-1">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-surface-card text-xs uppercase text-fg-muted">
              <tr>
                <th className="border-b border-border px-4 py-3 font-medium">
                  {t('analyze.records.header.path')}
                </th>
                <th className="border-b border-border px-4 py-3 font-medium">
                  {t('analyze.records.header.ip')}
                </th>
                <th className="border-b border-border px-4 py-3 font-medium">
                  {t('analyze.records.header.browser')}
                </th>
                <th className="border-b border-border px-4 py-3 font-medium">
                  {t('analyze.records.header.os')}
                </th>
                <th className="border-b border-border px-4 py-3 font-medium">
                  {t('analyze.records.header.time')}
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <AnalyzeRecordRow key={record.id} record={record} />
              ))}
            </tbody>
          </table>
        </Scroll>
      ) : (
        <EmptyBlock label={t('analyze.records.empty')} />
      )}
    </Drawer>
  )
}
