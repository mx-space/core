import type { AnalyzeRecord } from '~/api/analyze'
import { relativeTimeFromNow } from '~/utils/time'

import { IpInfoButton } from './IpInfoButton'

export function AnalyzeRecordRow(props: { record: AnalyzeRecord }) {
  const record = props.record
  const browser = record.ua?.browser
  const os = record.ua?.os

  return (
    <tr className="border-b border-border last:border-0">
      <td className="max-w-[24rem] truncate px-4 py-3 text-xs text-fg-muted">
        {record.path || '-'}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-fg-muted">
        {record.ip ? <IpInfoButton ip={record.ip} /> : '-'}
      </td>
      <td className="px-4 py-3 text-xs text-fg-muted">
        {browser?.name ?? '-'} {browser?.major ?? ''}
      </td>
      <td className="px-4 py-3 text-xs text-fg-muted">
        {os?.name ?? '-'} {os?.version ?? ''}
      </td>
      <td className="px-4 py-3 text-xs text-fg-muted">
        {record.timestamp ? relativeTimeFromNow(record.timestamp) : '-'}
      </td>
    </tr>
  )
}
