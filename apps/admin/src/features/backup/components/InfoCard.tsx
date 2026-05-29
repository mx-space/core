import type { HardDrive } from 'lucide-react'

export function InfoCard(props: {
  icon: typeof HardDrive
  label: string
  value: string
}) {
  const Icon = props.icon

  return (
    <div className="rounded border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-2 flex items-center gap-2 text-neutral-400">
        <Icon aria-hidden="true" className="size-4" />
        <span className="text-xs">{props.label}</span>
      </div>
      <div className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
        {props.value}
      </div>
    </div>
  )
}
