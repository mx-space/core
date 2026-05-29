export function TemplateSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          className="h-4 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900"
          key={index}
        />
      ))}
    </div>
  )
}
