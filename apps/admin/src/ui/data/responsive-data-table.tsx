import { Fragment } from 'react'
import type { ReactNode } from 'react'

import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '~/hooks/use-media-query'
import { useI18n } from '~/i18n'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

export interface ResponsiveDataTableColumn<Row> {
  key: string
  header: ReactNode
  render: (row: Row) => ReactNode
  hideOnMobile?: boolean
}

export interface ResponsiveDataTableProps<Row> {
  rows: Row[]
  columns: ResponsiveDataTableColumn<Row>[]
  rowKey: (row: Row) => string | number
  mobileCard?: (
    row: Row,
    columns: ResponsiveDataTableColumn<Row>[],
  ) => ReactNode
  empty?: ReactNode
  className?: string
}

export function ResponsiveDataTable<Row>(props: ResponsiveDataTableProps<Row>) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY)
  const { t } = useI18n()

  if (props.rows.length === 0) {
    const fallback = (
      <div className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {t('common.noData')}
      </div>
    )
    return <div className={props.className}>{props.empty ?? fallback}</div>
  }

  if (isDesktop) {
    return (
      <div className={props.className}>
        <Scroll innerClassName="min-w-max" orientation="horizontal">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                {props.columns.map((column) => (
                  <th
                    className="border-b border-neutral-200 px-4 py-3 font-medium dark:border-neutral-800"
                    key={column.key}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => (
                <tr
                  className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
                  key={props.rowKey(row)}
                >
                  {props.columns.map((column) => (
                    <td
                      className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-300"
                      key={column.key}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', props.className)}>
      {props.rows.map((row) => (
        <Fragment key={props.rowKey(row)}>
          {props.mobileCard ? (
            props.mobileCard(row, props.columns)
          ) : (
            <DefaultRowCard columns={props.columns} row={row} />
          )}
        </Fragment>
      ))}
    </div>
  )
}

export interface DefaultRowCardProps<Row> {
  columns: ResponsiveDataTableColumn<Row>[]
  row: Row
}

export function DefaultRowCard<Row>(props: DefaultRowCardProps<Row>) {
  const visible = props.columns.filter((column) => !column.hideOnMobile)
  // first non-hideOnMobile column is rendered as title
  const [firstColumn, ...remainingColumns] = visible

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      {firstColumn ? (
        <div className="mb-2 text-sm font-medium text-neutral-950 dark:text-neutral-50">
          {firstColumn.render(props.row)}
        </div>
      ) : null}
      {remainingColumns.length > 0 ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
          {remainingColumns.map((column) => (
            <Fragment key={column.key}>
              <dt className="text-neutral-400 dark:text-neutral-500">
                {column.header}
              </dt>
              <dd className="text-neutral-600 dark:text-neutral-300">
                {column.render(props.row)}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
