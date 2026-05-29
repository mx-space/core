export function BackupListSkeleton() {
  return (
    <div className="animate-pulse">
      {[1, 2, 3, 4].map((index) => (
        <div
          className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-900"
          key={index}
        >
          <div className="size-4 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="size-8 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-48 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="mt-2 h-3 w-16 rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
        </div>
      ))}
    </div>
  )
}
