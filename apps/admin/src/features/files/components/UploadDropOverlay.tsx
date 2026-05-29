import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

interface UploadDropOverlayProps {
  hint?: string
  onFiles: (files: File[]) => void
  enabled: boolean
  children: ReactNode
  label: string
}

export function UploadDropZoneShell(props: UploadDropOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepthRef = useRef(0)

  useEffect(() => {
    if (!props.enabled) return
    const el = rootRef.current
    if (!el) return

    const onEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes('Files')) return
      event.preventDefault()
      dragDepthRef.current += 1
      setDragging(true)
    }
    const onOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes('Files')) return
      event.preventDefault()
    }
    const onLeave = (event: DragEvent) => {
      event.preventDefault()
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setDragging(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files?.length) return
      event.preventDefault()
      dragDepthRef.current = 0
      setDragging(false)
      props.onFiles(Array.from(event.dataTransfer.files))
    }

    el.addEventListener('dragenter', onEnter)
    el.addEventListener('dragover', onOver)
    el.addEventListener('dragleave', onLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragenter', onEnter)
      el.removeEventListener('dragover', onOver)
      el.removeEventListener('dragleave', onLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [props.enabled, props])

  return (
    <div className="relative flex h-full min-h-0 flex-col" ref={rootRef}>
      {props.children}
      {dragging && props.enabled ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-30 m-2 flex flex-col items-center justify-center gap-3',
            'rounded border-2 border-dashed border-neutral-950 bg-neutral-50/95 text-neutral-950',
            'dark:border-neutral-50 dark:bg-neutral-900/95 dark:text-neutral-50',
          )}
        >
          <Upload aria-hidden="true" className="size-7" />
          <p className="text-sm font-medium">{props.label}</p>
          {props.hint ? (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {props.hint}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
