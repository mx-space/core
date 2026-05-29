export function NoteListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="h-12 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900"
          key={index}
        />
      ))}
    </div>
  )
}
