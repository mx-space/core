import type { ReactNode } from 'react'

import { Scroll } from '~/ui/primitives/scroll'

interface DataTableColumn<T> {
  key: keyof T
  label: string
  render?: (value: T[keyof T], row: T) => ReactNode
}

interface DataTableProps<T extends Record<string, ReactNode>> {
  columns: Array<DataTableColumn<T>>
  rows: T[]
}

export function DataTable<T extends Record<string, ReactNode>>(
  props: DataTableProps<T>,
) {
  return (
    <Scroll innerClassName="min-w-max" orientation="horizontal">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            {props.columns.map((column) => (
              <th
                className="border-b border-neutral-200 px-4 py-3 font-medium dark:border-neutral-800"
                key={String(column.key)}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr
              className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
              key={index}
            >
              {props.columns.map((column) => {
                const value = row[column.key]

                return (
                  <td
                    className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-300"
                    key={String(column.key)}
                  >
                    {column.render ? column.render(value, row) : value}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Scroll>
  )
}
