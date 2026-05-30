import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { getAnalyzeList } from '~/api/analyze'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'

import { pageSize } from '../../constants'
import { AnalyzeSkeleton, EmptyBlock } from '../AnalyzePrimitives'
import { AnalyzeRecordRow } from '../AnalyzeRecordRow'

const STORAGE_KEY = 'mx-admin:analyze-records-open'

function readInitialOpen(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeOpen(next: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function AnalyzeRecordsCollapsible() {
  const { t } = useI18n()
  const [open, setOpen] = useState(readInitialOpen)
  const [page, setPage] = useState(1)

  const recordsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getAnalyzeList({ page, size: pageSize }),
    queryKey: adminQueryKeys.analyze.records({ page, size: pageSize }),
  })

  const records = recordsQuery.data?.data ?? []
  const pagination = recordsQuery.data?.pagination
  const totalPages = pagination?.totalPages ?? 1

  return (
    <details
      className="group bg-background"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open
        setOpen(next)
        writeOpen(next)
      }}
    >
      <summary className="flex cursor-pointer select-none items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 [&::-webkit-details-marker]:hidden [&::marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 text-neutral-500 transition-transform group-open:rotate-90 dark:text-neutral-400"
        />
        <h2 className="text-sm font-medium">{t('analyze.records.title')}</h2>
      </summary>

      {recordsQuery.isLoading && records.length === 0 ? (
        <AnalyzeSkeleton />
      ) : recordsQuery.isError ? (
        <div className="flex min-h-[18rem] flex-col items-center justify-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('analyze.records.error')}
          </p>
          <Button
            className="mt-3"
            onClick={() => void recordsQuery.refetch()}
            type="button"
          >
            {t('analyze.action.retry')}
          </Button>
        </div>
      ) : records.length ? (
        <Scroll orientation="horizontal">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
              <tr>
                <th className="border-b border-neutral-200 px-4 py-3 font-medium dark:border-neutral-800">
                  {t('analyze.records.header.path')}
                </th>
                <th className="border-b border-neutral-200 px-4 py-3 font-medium dark:border-neutral-800">
                  {t('analyze.records.header.ip')}
                </th>
                <th className="border-b border-neutral-200 px-4 py-3 font-medium dark:border-neutral-800">
                  {t('analyze.records.header.browser')}
                </th>
                <th className="border-b border-neutral-200 px-4 py-3 font-medium dark:border-neutral-800">
                  {t('analyze.records.header.os')}
                </th>
                <th className="border-b border-neutral-200 px-4 py-3 font-medium dark:border-neutral-800">
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

      {pagination && totalPages > 1 ? (
        <div className="flex items-center justify-end border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <CompactPagination
            onPageChange={setPage}
            onPageSizeChange={() => undefined}
            page={page}
            pageCount={totalPages}
            pageSize={pageSize}
            pageSizes={[pageSize]}
          />
        </div>
      ) : null}
    </details>
  )
}
