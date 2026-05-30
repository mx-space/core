import { ImageIcon } from 'lucide-react'

import { EmptyState } from '~/ui/patterns/EmptyState'

export function FileListEmpty(props: { label: string; hint?: string }) {
  return (
    <div className="flex min-h-[24rem] items-center justify-center px-4">
      <EmptyState
        description={props.hint}
        icon={ImageIcon}
        title={props.label}
      />
    </div>
  )
}
