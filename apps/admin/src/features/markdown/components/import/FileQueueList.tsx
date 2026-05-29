import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { ParsedItem } from '../../types/markdown'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'

import { DropZone } from './DropZone'
import { FileQueueItem } from './FileQueueItem'

interface FileQueueListProps {
  editedSet: Set<string>
  failedSet: Set<string>
  items: ParsedItem[]
  onAppend: (files: File[]) => void
  onClear: () => void
  onRemove: (filename: string) => void
  onSelect: (filename: string) => void
  parsing?: boolean
  selectedFilename: null | string
}

export function FileQueueList(props: FileQueueListProps) {
  const { t } = useI18n()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.selectedFilename) return
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-filename="${CSS.escape(props.selectedFilename)}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [props.selectedFilename])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const filenames = props.items.map((it) => it.filename)
    if (filenames.length === 0) return
    const currentIndex = props.selectedFilename
      ? filenames.indexOf(props.selectedFilename)
      : -1
    const nextIndex =
      event.key === 'ArrowDown'
        ? Math.min(filenames.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1)
    event.preventDefault()
    props.onSelect(filenames[nextIndex])
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 px-3 dark:border-neutral-800">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {t('markdown.import.filesCount', { count: props.items.length })}
        </span>
        <Button
          aria-label={t('markdown.import.clear')}
          className="h-7 px-2 text-xs"
          onClick={props.onClear}
          type="button"
          variant="subtle"
        >
          {t('markdown.import.clear')}
        </Button>
      </div>

      <div className="shrink-0 border-b border-neutral-200 p-2 dark:border-neutral-800">
        <DropZone
          mode="compact"
          onFiles={props.onAppend}
          parsing={props.parsing}
        />
      </div>

      <Scroll className="flex-1">
        <div
          aria-label={t('markdown.import.filesCount', {
            count: props.items.length,
          })}
          onKeyDown={onKeyDown}
          ref={listRef}
          role="listbox"
        >
          {props.items.map((item) => (
            <div data-filename={item.filename} key={item.filename}>
              <FileQueueItem
                edited={props.editedSet.has(item.filename)}
                failed={props.failedSet.has(item.filename)}
                filename={item.filename}
                onRemove={props.onRemove}
                onSelect={props.onSelect}
                selected={props.selectedFilename === item.filename}
              />
            </div>
          ))}
        </div>
      </Scroll>
    </div>
  )
}
