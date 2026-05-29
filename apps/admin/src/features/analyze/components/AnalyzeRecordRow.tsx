import type { AnalyzeRecord } from '~/api/analyze'

import { relativeTimeFromNow } from '~/utils/time'

import { IpInfoButton } from './IpInfoButton'

export function AnalyzeRecordRow(props: { record: AnalyzeRecord }) {
  const record = props.record
  const browser = record.ua?.browser
  const os = record.ua?.os

  return (
    <tr className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
      <td className="max-w-[24rem] truncate px-4 py-3 text-xs text-neutral-700 dark:text-neutral-300">
        {record.path || '-'}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-neutral-500 dark:text-neutral-400">
        {record.ip ? <IpInfoButton ip={record.ip} /> : '-'}
      </td>
      <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
        {browser?.name ?? '-'} {browser?.major ?? ''}
      </td>
      <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
        {os?.name ?? '-'} {os?.version ?? ''}
      </td>
      <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
        {record.timestamp ? relativeTimeFromNow(record.timestamp) : '-'}
      </td>
    </tr>
  )
}
