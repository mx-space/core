export function TopicListSkeleton() {
  return (
    <div>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800/60"
          key={index}
        >
          <div className="size-10 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          </div>
        </div>
      ))}
    </div>
  )
}
