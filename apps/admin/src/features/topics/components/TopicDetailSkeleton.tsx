import { NoteListSkeleton } from './NoteListSkeleton'

export function TopicDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-start gap-4 rounded border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="size-14 rounded bg-neutral-100 dark:bg-neutral-900" />
        <div className="flex-1">
          <div className="h-5 w-40 rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="mt-3 h-4 w-28 rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="mt-4 h-4 w-full rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
      </div>
      <NoteListSkeleton />
    </div>
  )
}
