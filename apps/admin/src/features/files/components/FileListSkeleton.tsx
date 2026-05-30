export function FileListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, index) => (
        <div className="flex items-center gap-3 px-4 py-2.5" key={index}>
          <div className="size-9 shrink-0 animate-pulse rounded border border-border bg-surface-inset" />
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-surface-inset" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-surface-inset" />
          </div>
        </div>
      ))}
    </div>
  )
}
