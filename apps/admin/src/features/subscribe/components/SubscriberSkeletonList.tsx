export function SubscriberSkeletonList() {
  return (
    <div className="animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((index) => (
        <div
          className="flex items-center gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 dark:border-neutral-800"
          key={index}
        >
          <div className="size-4 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-4 flex-1 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="hidden h-4 w-32 rounded bg-neutral-100 sm:block dark:bg-neutral-800" />
          <div className="h-4 w-20 rounded bg-neutral-100 dark:bg-neutral-800" />
        </div>
      ))}
    </div>
  )
}
