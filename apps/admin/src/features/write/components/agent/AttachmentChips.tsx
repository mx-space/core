import { FileText, RotateCcw, X } from 'lucide-react'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import type { ComposerAttachment } from './composer-attachments'
import type { ChatAttachment } from './types'

interface ComposerAttachmentChipProps {
  item: ComposerAttachment
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

export function ComposerAttachmentChip({
  item,
  onRemove,
  onRetry,
}: ComposerAttachmentChipProps) {
  const { t } = useI18n()
  const failed = item.status === 'error'
  const uploading = item.status === 'uploading'
  const preview = item.previewUrl ?? item.url

  const sub = failed
    ? t('write.agent.attachment.failed')
    : uploading
      ? t('write.agent.attachment.uploading', { progress: item.progress })
      : formatBytes(item.size)

  return (
    <div
      className={cn(
        'group relative flex h-10 min-w-0 max-w-[220px] items-center gap-2 rounded-sm border bg-surface-card pl-1 pr-2.5',
        item.kind === 'image' &&
          preview &&
          !failed &&
          'w-12 justify-center p-0',
        failed
          ? 'border-red-300 dark:border-red-900/60'
          : 'border-border-strong',
      )}
      data-attachment=""
      title={item.error ?? item.name}
    >
      {item.kind === 'image' && preview && !failed ? (
        <img
          alt={item.name}
          className={cn(
            'size-full rounded-[7px] object-cover',
            uploading && 'opacity-60',
          )}
          src={preview}
        />
      ) : (
        <>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xs bg-surface-inset text-fg-subtle">
            <FileText aria-hidden="true" className="size-3.5" />
          </span>
          <span className="flex min-w-0 flex-col text-sm leading-tight">
            <span className="truncate text-fg">{item.name}</span>
            <span
              className={cn(
                'tabular-nums',
                failed ? 'text-red-600 dark:text-red-400' : 'text-fg-subtle',
              )}
            >
              {sub}
            </span>
          </span>
        </>
      )}

      {uploading ? (
        <span className="absolute inset-x-1 bottom-1 h-0.5 overflow-hidden rounded-full bg-border-strong">
          <span
            className="block h-full bg-fg-muted transition-[width] duration-200"
            style={{ width: `${item.progress}%` }}
          />
        </span>
      ) : null}

      {failed ? (
        <button
          aria-label={t('write.agent.attachment.retry')}
          className="ml-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-xs text-fg-subtle hover:bg-surface-inset hover:text-fg"
          onClick={() => onRetry(item.id)}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-3" />
        </button>
      ) : null}

      <button
        aria-label={t('write.agent.attachment.remove')}
        className="absolute -right-1.5 -top-1.5 inline-flex size-[18px] items-center justify-center rounded-full bg-fg text-background opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        onClick={() => onRemove(item.id)}
        type="button"
      >
        <X aria-hidden="true" className="size-2.5" strokeWidth={3} />
      </button>
    </div>
  )
}

export function MessageAttachments({
  attachments,
}: {
  attachments: ChatAttachment[]
}) {
  return (
    <div className="flex max-w-[84%] flex-wrap justify-end gap-1.5">
      {attachments.map((attachment, index) =>
        attachment.kind === 'image' ? (
          <a
            className="block size-14 overflow-hidden rounded-sm border border-border-strong bg-surface-inset"
            href={attachment.url}
            key={`${attachment.url}-${index}`}
            rel="noreferrer"
            target="_blank"
            title={attachment.name}
          >
            <img
              alt={attachment.name}
              className="size-full object-cover"
              loading="lazy"
              src={attachment.url}
            />
          </a>
        ) : (
          <div
            className="flex h-10 min-w-0 max-w-[220px] items-center gap-2 rounded-sm border border-border-strong bg-surface-card pl-1 pr-2.5"
            key={`${attachment.name}-${index}`}
            title={attachment.name}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xs bg-surface-inset text-fg-subtle">
              <FileText aria-hidden="true" className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-col text-sm leading-tight">
              <span className="truncate text-fg">{attachment.name}</span>
              {attachment.size === undefined ? null : (
                <span className="tabular-nums text-fg-subtle">
                  {formatBytes(attachment.size)}
                </span>
              )}
            </span>
          </div>
        ),
      )}
    </div>
  )
}
