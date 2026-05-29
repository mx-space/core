import {
  ArrowLeft,
  Calendar,
  Download,
  HardDrive,
  History,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

import type { BackupFile } from '~/api/backups'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Panel } from '~/ui/primitives/panel'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { formatBackupDate } from '../utils/backup-file'
import { ActionRow } from './ActionRow'
import { InfoCard } from './InfoCard'

export function BackupDetail(props: {
  item: BackupFile
  onBack: () => void
  onDelete: () => void
  onDownload: () => void
  onRollback: () => void
}) {
  const { t } = useI18n()
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [rollbackConfirming, setRollbackConfirming] = useState(false)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
          <button
            className="inline-flex size-8 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 lg:hidden dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
            onClick={props.onBack}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </button>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {t('backup.detail.title')}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            className="h-8 px-2"
            onClick={props.onDownload}
            type="button"
            variant="subtle"
          >
            <Download aria-hidden="true" className="size-3.5" />
            {t('backup.detail.download')}
          </Button>
          <Button
            className="h-8 px-2"
            onClick={() => {
              if (rollbackConfirming) {
                props.onRollback()
                setRollbackConfirming(false)
              } else {
                setRollbackConfirming(true)
              }
            }}
            onMouseLeave={() => setRollbackConfirming(false)}
            type="button"
            variant="subtle"
          >
            <History aria-hidden="true" className="size-3.5" />
            {rollbackConfirming
              ? t('backup.detail.confirmRollback')
              : t('backup.detail.rollback')}
          </Button>
          <Button
            className="h-8 px-2 text-red-600 dark:text-red-400"
            onClick={() => {
              if (deleteConfirming) {
                props.onDelete()
                setDeleteConfirming(false)
              } else {
                setDeleteConfirming(true)
              }
            }}
            onMouseLeave={() => setDeleteConfirming(false)}
            type="button"
            variant="subtle"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            {deleteConfirming
              ? t('backup.detail.confirmDelete')
              : t('common.delete')}
          </Button>
        </div>
      </div>

      <Scroll className="flex-1" innerClassName="p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-4 flex size-20 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50">
              <HardDrive
                aria-hidden="true"
                className="size-10 text-blue-500 dark:text-blue-400"
              />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {formatBackupDate(props.item.filename)}
            </h3>
            <p className="mt-1 font-mono text-xs text-neutral-400">
              {props.item.filename}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoCard
              icon={HardDrive}
              label={t('backup.detail.size')}
              value={props.item.size}
            />
            <InfoCard
              icon={Calendar}
              label={t('backup.detail.createdAt')}
              value={formatBackupDate(props.item.filename)}
            />
          </div>

          <Panel title={t('backup.detail.actionsTitle')}>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              <ActionRow
                description={t('backup.actions.row.downloadDescription')}
                icon={Download}
                label={t('backup.actions.row.downloadLabel')}
                onClick={props.onDownload}
                tone="blue"
              />
              <ActionRow
                description={t('backup.actions.row.rollbackDescription')}
                icon={History}
                label={
                  rollbackConfirming
                    ? t('backup.actions.row.rollbackLabelConfirm')
                    : t('backup.actions.row.rollbackLabel')
                }
                onClick={() => {
                  if (rollbackConfirming) {
                    props.onRollback()
                    setRollbackConfirming(false)
                  } else {
                    setRollbackConfirming(true)
                  }
                }}
                onMouseLeave={() => setRollbackConfirming(false)}
                tone="amber"
              />
              <ActionRow
                description={t('backup.actions.row.deleteDescription')}
                icon={Trash2}
                label={
                  deleteConfirming
                    ? t('backup.actions.row.deleteLabelConfirm')
                    : t('backup.actions.row.deleteLabel')
                }
                onClick={() => {
                  if (deleteConfirming) {
                    props.onDelete()
                    setDeleteConfirming(false)
                  } else {
                    setDeleteConfirming(true)
                  }
                }}
                onMouseLeave={() => setDeleteConfirming(false)}
                tone="red"
              />
            </div>
          </Panel>
        </div>
      </Scroll>
    </div>
  )
}
