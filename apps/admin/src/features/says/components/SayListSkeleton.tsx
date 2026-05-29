export function SayListSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse">
      {[1, 2, 3, 4, 5].map((index) => (
        <div
          className="flex gap-3 border-b border-neutral-200 px-4 py-4 last:border-b-0 dark:border-neutral-800"
          key={index}
        >
          <div className="size-5 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="flex-1">
            <div className="h-5 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="mt-2 h-5 w-3/4 rounded bg-neutral-100 dark:bg-neutral-800" />
            <div className="mt-3 flex gap-4">
              <div className="h-4 w-20 rounded bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-4 w-24 rounded bg-neutral-100 dark:bg-neutral-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
