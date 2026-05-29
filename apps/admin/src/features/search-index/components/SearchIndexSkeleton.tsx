export function SearchIndexSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="h-20 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900"
          key={index}
        />
      ))}
    </div>
  )
}
