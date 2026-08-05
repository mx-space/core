import { ImageIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { EmptyState } from '~/ui/patterns/EmptyState'

export function FileListEmpty(props: {
  action?: ReactNode
  label: string
  hint?: string
}) {
  return (
    <div className="flex min-h-[24rem] items-center justify-center px-4">
      <EmptyState
        action={props.action}
        description={props.hint}
        icon={ImageIcon}
        title={props.label}
      />
    </div>
  )
}
