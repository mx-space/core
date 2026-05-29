export function FileListSkeleton() {
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
      {Array.from({ length: 8 }).map((_, index) => (
        <div className="flex items-center gap-3 px-4 py-2.5" key={index}>
          <div className="size-9 shrink-0 animate-pulse rounded border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          </div>
        </div>
      ))}
    </div>
  )
}
