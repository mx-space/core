import type { Users } from 'lucide-react'

export function StatCard(props: {
  icon: typeof Users
  label: string
  tone?: 'default' | 'success' | 'warning'
  value: number | string
}) {
  const Icon = props.icon
  const tone = props.tone ?? 'default'
  const toneClasses = {
    default: 'bg-white dark:bg-neutral-950 text-neutral-400',
    success: 'bg-green-50 dark:bg-green-950/30 text-green-500',
    warning: 'bg-amber-50 dark:bg-amber-950/30 text-amber-500',
  }

  return (
    <div className="flex items-center gap-4 rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className={toneClasses[tone]}>
        <Icon aria-hidden="true" className="size-7" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">
          {typeof props.value === 'number'
            ? Intl.NumberFormat('zh-CN').format(props.value)
            : props.value}
        </div>
        <div className="text-xs text-neutral-500">{props.label}</div>
      </div>
    </div>
  )
}
