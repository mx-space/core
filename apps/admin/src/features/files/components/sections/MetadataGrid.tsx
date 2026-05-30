import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

export interface MetadataEntry {
  key: string
  label: ReactNode
  value: ReactNode
  mono?: boolean
}

interface MetadataGridProps {
  entries: MetadataEntry[]
}

export function MetadataGrid(props: MetadataGridProps) {
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
      {props.entries.map((entry) => (
        <div key={entry.key} className="contents">
          <dt className="text-xs uppercase tracking-wide text-fg-muted">
            {entry.label}
          </dt>
          <dd
            className={cn(
              'min-w-0 break-all text-fg',
              entry.mono && 'font-mono text-xs',
            )}
          >
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
