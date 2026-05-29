import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: string
}

export function MetricCard(props: MetricCardProps) {
  const Icon = props.icon

  return (
    <div className="rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <Icon
        aria-hidden="true"
        className="mb-4 size-4 text-[var(--color-primary)]"
      />
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        {props.label}
      </div>
      <div className="mt-1 text-sm font-medium">{props.value}</div>
    </div>
  )
}
