import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { UploadItem } from '../hooks/useFileUploader'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

interface UploadProgressDockProps {
  items: UploadItem[]
}

export function UploadProgressDock(props: UploadProgressDockProps) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState(false)

  if (props.items.length === 0) return null

  const uploadingCount = props.items.filter(
    (item) => item.status === 'uploading',
  ).length
  const errorCount = props.items.filter(
    (item) => item.status === 'error',
  ).length

  return (
    <div className="shrink-0 border-t border-neutral-200 bg-neutral-50/60 text-xs dark:border-neutral-800 dark:bg-neutral-900/40">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-neutral-600 transition-colors hover:bg-neutral-100/60 dark:text-neutral-300 dark:hover:bg-neutral-800/40"
        onClick={() => setCollapsed((value) => !value)}
        type="button"
      >
        <span className="inline-flex items-center gap-2">
          {uploadingCount > 0 ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : null}
          {uploadingCount > 0
            ? t('files.upload.dock.uploading', { count: uploadingCount })
            : errorCount > 0
              ? t('files.upload.dock.errors', { count: errorCount })
              : t('files.upload.dock.done')}
        </span>
        {collapsed ? (
          <ChevronUp aria-hidden="true" className="size-3.5" />
        ) : (
          <ChevronDown aria-hidden="true" className="size-3.5" />
        )}
      </button>
      {!collapsed ? (
        <ul className="max-h-48 overflow-y-auto px-4 pb-3">
          {props.items.map((item) => (
            <li className="grid gap-1 py-1.5" key={item.id}>
              <div className="flex items-center justify-between gap-3 text-neutral-600 dark:text-neutral-300">
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="shrink-0 tabular-nums">
                  {item.status === 'done'
                    ? t('files.upload.done')
                    : item.status === 'error'
                      ? (item.error ?? t('files.toast.uploadFailed'))
                      : `${item.progress}%`}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={cn(
                    'h-full transition-all',
                    item.status === 'error'
                      ? 'bg-red-500'
                      : 'bg-neutral-950 dark:bg-neutral-50',
                  )}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
