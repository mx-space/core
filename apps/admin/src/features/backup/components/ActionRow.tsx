import type { Download } from 'lucide-react'

export function ActionRow(props: {
  description: string
  icon: typeof Download
  label: string
  onClick: () => void
  onMouseLeave?: () => void
  tone: 'amber' | 'blue' | 'red'
}) {
  const Icon = props.icon
  const toneClass = {
    amber:
      'bg-amber-50 text-amber-500 dark:bg-amber-950/50 dark:text-amber-400',
    blue: 'bg-blue-50 text-blue-500 dark:bg-blue-950/50 dark:text-blue-400',
    red: 'bg-red-50 text-red-500 dark:bg-red-950/50 dark:text-red-400',
  }[props.tone]

  return (
    <button
      className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
      onClick={props.onClick}
      onMouseLeave={props.onMouseLeave}
      type="button"
    >
      <div
        className={`flex size-10 items-center justify-center rounded ${toneClass}`}
      >
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <div>
        <div
          className={
            props.tone === 'red'
              ? 'text-sm font-medium text-red-600 dark:text-red-400'
              : 'text-sm font-medium text-neutral-900 dark:text-neutral-100'
          }
        >
          {props.label}
        </div>
        <div className="text-xs text-neutral-400">{props.description}</div>
      </div>
    </button>
  )
}
