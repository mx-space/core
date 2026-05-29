export function ReadersListSkeleton() {
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="flex items-center gap-3 px-4 py-3" key={index}>
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-900" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          </div>
        </div>
      ))}
    </div>
  )
}
