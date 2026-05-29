import { ImageIcon } from 'lucide-react'

export function FileListEmpty(props: { label: string; hint?: string }) {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <ImageIcon aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        {props.label}
      </p>
      {props.hint ? (
        <p className="mt-1 text-xs text-neutral-400">{props.hint}</p>
      ) : null}
    </div>
  )
}
