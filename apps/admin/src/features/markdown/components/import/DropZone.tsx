import { Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

interface DropZoneProps {
  disabled?: boolean
  mode: 'compact' | 'large'
  onFiles: (files: File[]) => void
  parsing?: boolean
}

export function DropZone(props: DropZoneProps) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const isLarge = props.mode === 'large'
  const disabled = props.disabled || props.parsing

  const openPicker = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length > 0) props.onFiles(files)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    setDragActive(true)
  }

  const onDragLeave = () => setDragActive(false)

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    if (disabled) return
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) props.onFiles(files)
  }

  const baseClass = cn(
    'group relative flex cursor-pointer items-center transition-colors',
    'border-2 border-dashed border-neutral-300 bg-neutral-50/60 text-neutral-600',
    'dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400',
    !disabled && 'hover:border-neutral-400 dark:hover:border-neutral-600',
    dragActive &&
      'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30',
    disabled && 'cursor-not-allowed opacity-70',
    isLarge
      ? 'h-full w-full flex-col justify-center rounded px-6 py-8 text-center'
      : 'h-12 justify-center gap-2 rounded px-3 text-xs',
  )

  return (
    <div
      aria-busy={props.parsing}
      className={baseClass}
      onClick={openPicker}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      {props.parsing ? (
        <>
          <Loader2
            aria-hidden="true"
            className={cn(
              'animate-spin text-neutral-400',
              isLarge ? 'mb-3 size-9' : 'size-4',
            )}
          />
          <span className={cn(isLarge ? 'text-sm font-medium' : 'text-xs')}>
            {t('markdown.import.parsing')}
          </span>
        </>
      ) : isLarge ? (
        <>
          <Upload
            aria-hidden="true"
            className="mb-3 size-9 text-neutral-400 transition-colors group-hover:text-neutral-500"
          />
          <p className="mb-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('markdown.import.empty')}
          </p>
          <p className="text-xs text-neutral-500">
            {t('markdown.import.dropSecondary')}
          </p>
        </>
      ) : (
        <>
          <Upload aria-hidden="true" className="size-4 text-neutral-400" />
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {t('markdown.import.append')}
          </span>
          <span className="text-neutral-500">·</span>
          <span>{t('markdown.import.appendHint')}</span>
        </>
      )}
      <input
        accept=".md,.markdown"
        className="hidden"
        multiple
        onChange={onInputChange}
        ref={inputRef}
        type="file"
      />
    </div>
  )
}
