import { HardDrive } from 'lucide-react'

import type { BackupFile } from '~/api/backups'
import { useI18n } from '~/i18n'
import { Checkbox } from '~/ui/primitives/checkbox'

import { formatBackupDate } from '../utils/backup-file'

export function BackupListItem(props: {
  checked: boolean
  item: BackupFile
  onSelect: () => void
  onToggleCheck: (filename: string, checked: boolean) => void
  selected: boolean
}) {
  const { t } = useI18n()
  return (
    <article
      className={[
        'flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-4 py-3 transition-colors last:border-b-0 dark:border-neutral-900',
        props.selected
          ? 'bg-neutral-100 dark:bg-neutral-900'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
      ].join(' ')}
      onClick={props.onSelect}
    >
      <Checkbox
        aria-label={t('backup.list.itemAria')}
        checked={props.checked}
        className="shrink-0"
        onCheckedChange={(checked) =>
          props.onToggleCheck(props.item.filename, checked)
        }
        onClick={(event) => event.stopPropagation()}
      />
      <div className="flex size-8 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-500 dark:bg-blue-950/50 dark:text-blue-400">
        <HardDrive aria-hidden="true" className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-fg">
          {formatBackupDate(props.item.filename)}
        </div>
        <div className="mt-0.5 text-xs text-fg-subtle">{props.item.size}</div>
      </div>
    </article>
  )
}
