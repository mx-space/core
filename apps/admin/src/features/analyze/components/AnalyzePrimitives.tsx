import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

export function ErrorBlock(props: { label: string; onRetry: () => void }) {
  const { t } = useI18n()

  return (
    <div className="flex min-h-[14rem] flex-col items-center justify-center px-4 text-sm text-neutral-500 dark:text-neutral-400">
      <p>{props.label}</p>
      <Button className="mt-3" onClick={props.onRetry} type="button">
        {t('analyze.action.retry')}
      </Button>
    </div>
  )
}

export function AnalyzeSkeleton() {
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="px-4 py-3" key={index}>
          <div className="h-4 w-2/5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="mt-3 h-3 w-3/5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
      ))}
    </div>
  )
}

export function EmptyBlock(props: { label: string }) {
  return (
    <div className="flex min-h-[14rem] items-center justify-center px-4 text-sm text-neutral-500 dark:text-neutral-400">
      {props.label}
    </div>
  )
}

export function ProgressBar(props: { className?: string; value: number }) {
  return (
    <div
      className={cn(
        'h-1.5 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900',
        props.className,
      )}
    >
      <div
        className="h-full rounded bg-[var(--color-primary)]"
        style={{ width: `${props.value}%` }}
      />
    </div>
  )
}
