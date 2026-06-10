import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { ServerlessLogEntry } from '~/api/serverless'
import { getInvocationLogDetail, getInvocationLogs } from '~/api/serverless'
import { useI18n } from '~/i18n'
import type { SnippetModel } from '~/models/snippet'
import { adminQueryKeys } from '~/query/keys'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import { logPageSize } from '../constants'
import type { StatusFilter } from '../types/snippets'
import {
  formatLogArgs,
  getErrorMessage,
  logLevelColor,
} from '../utils/snippets'
import { InlineLoading, SidePanel } from './SnippetPrimitives'

export function FunctionLogsDrawer(props: {
  onClose: () => void
  open: boolean
  snippet: SnippetModel | null
}) {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!props.open) {
      setPage(1)
      setStatusFilter('all')
      setExpandedId(null)
    }
  }, [props.open])

  useEffect(() => {
    setPage(1)
    setExpandedId(null)
  }, [statusFilter])

  const logsQuery = useQuery({
    enabled: props.open && Boolean(props.snippet?.id),
    queryFn: () =>
      getInvocationLogs(String(props.snippet?.id), {
        page,
        size: logPageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    queryKey: adminQueryKeys.serverless.logs({
      page,
      size: logPageSize,
      snippetId: props.snippet?.id ?? '',
      status: statusFilter,
    }),
  })
  const logs = logsQuery.data?.data ?? []
  const pagination = logsQuery.data?.pagination

  return (
    <SidePanel
      onClose={props.onClose}
      open={props.open}
      title={
        props.snippet?.name
          ? t('snippets.dialog.logs.titleWithName', {
              name: props.snippet.name,
            })
          : t('snippets.dialog.logs.title')
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="grid grid-cols-3 gap-1 rounded-sm bg-neutral-100 p-1 dark:bg-neutral-900">
          {[
            { label: t('snippets.dialog.logs.filter.all'), value: 'all' },
            {
              label: t('snippets.dialog.logs.filter.success'),
              value: 'success',
            },
            { label: t('snippets.dialog.logs.filter.error'), value: 'error' },
          ].map((item) => (
            <button
              className={cn(
                'rounded-xs px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === item.value
                  ? 'shadow-xs bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
              )}
              key={item.value}
              onClick={() => setStatusFilter(item.value as StatusFilter)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <Scroll className="flex-1">
          {logsQuery.isLoading ? (
            <div className="flex justify-center py-20">
              <InlineLoading label={t('snippets.dialog.logs.loading')} />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex min-h-60 items-center justify-center text-sm text-neutral-500">
              {t('snippets.dialog.logs.empty')}
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <LogItem
                  expanded={expandedId === log.id}
                  key={log.id}
                  log={log}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === log.id ? null : log.id,
                    )
                  }
                />
              ))}
            </div>
          )}
        </Scroll>

        {pagination && pagination.totalPage > 1 ? (
          <div className="flex shrink-0 justify-center border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <CompactPagination
              onPageChange={setPage}
              onPageSizeChange={() => undefined}
              page={page}
              pageCount={pagination.totalPage}
              pageSize={logPageSize}
              pageSizes={[logPageSize]}
            />
          </div>
        ) : null}
      </div>
    </SidePanel>
  )
}

function LogItem(props: {
  expanded: boolean
  log: ServerlessLogEntry
  onToggle: () => void
}) {
  return (
    <div className="overflow-hidden rounded border border-neutral-200 dark:border-neutral-800">
      <button
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
        onClick={props.onToggle}
        type="button"
      >
        {props.expanded ? (
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-neutral-400"
          />
        ) : (
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 shrink-0 text-neutral-400"
          />
        )}
        <span
          className={cn(
            'inline-block size-2 shrink-0 rounded-full',
            props.log.status === 'success' ? 'bg-green-500' : 'bg-red-500',
          )}
        />
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
            props.log.status === 'success'
              ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
          )}
        >
          {props.log.method}
        </span>
        <span className="shrink-0 text-xs text-neutral-500">
          {props.log.executionTime}ms
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-neutral-500">
          {props.log.ip}
        </span>
        <span className="shrink-0 text-xs text-neutral-400">
          {relativeTimeFromNow(props.log.createdAt)}
        </span>
      </button>
      {props.expanded ? <LogDetail id={props.log.id} /> : null}
    </div>
  )
}

function LogDetail(props: { id: string }) {
  const { t } = useI18n()
  const query = useQuery({
    queryFn: () => getInvocationLogDetail(props.id),
    queryKey: adminQueryKeys.serverless.logDetail(props.id),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      {query.isLoading ? (
        <InlineLoading label={t('snippets.dialog.logs.detailLoading')} />
      ) : query.isError ? (
        <p className="text-xs text-red-600">
          {getErrorMessage(query.error, t('snippets.dialog.logs.detailFailed'))}
        </p>
      ) : query.data ? (
        <div className="space-y-3">
          {query.data.logs && query.data.logs.length > 0 ? (
            <div>
              <h4 className="mb-1.5 text-xs font-medium text-neutral-500">
                Console
              </h4>
              <div className="rounded bg-neutral-100 p-3 font-mono text-xs text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                {query.data.logs.map((entry, index) => (
                  <div
                    className={cn(
                      'whitespace-pre-wrap break-all',
                      logLevelColor(entry.level),
                    )}
                    key={index}
                  >
                    <span className="mr-2 select-none text-neutral-500">
                      [{entry.level}]
                    </span>
                    {formatLogArgs(entry.args)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {query.data.error ? (
            <div>
              <h4 className="mb-1.5 text-xs font-medium text-red-600">Error</h4>
              <div className="rounded bg-red-100 p-3 font-mono text-xs text-red-900 dark:bg-red-950/90 dark:text-red-100">
                <div className="font-semibold">
                  {query.data.error.name}: {query.data.error.message}
                </div>
                {query.data.error.stack ? (
                  <pre className="mt-2 whitespace-pre-wrap break-all dark:text-red-200">
                    {query.data.error.stack}
                  </pre>
                ) : null}
              </div>
            </div>
          ) : null}
          {(!query.data.logs || query.data.logs.length === 0) &&
          !query.data.error ? (
            <p className="text-xs text-neutral-400">
              {t('snippets.dialog.logs.noOutput')}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-neutral-400">
          {t('snippets.dialog.logs.detailFailed')}
        </p>
      )}
    </div>
  )
}
