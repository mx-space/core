import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, Trash2, Upload } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import type { BackupFile } from '~/api/backups'
import {
  createBackup,
  deleteBackup,
  downloadBackup,
  getBackups,
  rollbackBackup,
  uploadAndRestoreBackup,
} from '~/api/backups'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { saveBlob } from '../utils/backup-file'
import { BackupRouteContext } from './backup-route-context'
import { BackupDetailEmptyState } from './BackupDetailEmptyState'
import { BackupListEmptyState } from './BackupListEmptyState'
import { BackupListItem } from './BackupListItem'
import { BackupListSkeleton } from './BackupListSkeleton'

export function BackupRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ filename?: string }>()
  const detailFilename = params.filename ?? null
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const backupsQuery = useQuery({
    queryFn: getBackups,
    queryKey: ['backups', 'list'],
  })

  const backups = useMemo(
    () =>
      [...(backupsQuery.data ?? [])].sort((a, b) =>
        b.filename.localeCompare(a.filename),
      ),
    [backupsQuery.data],
  )
  const allSelected = backups.length > 0 && selectedKeys.size === backups.length

  const invalidateBackups = async () => {
    await queryClient.invalidateQueries({ queryKey: ['backups'] })
  }

  const closeDetail = useCallback(() => {
    navigate('/maintenance/backup')
  }, [navigate])

  const createMutation = useMutation({
    mutationFn: createBackup,
    onError: () => {
      toast.error(t('backup.toast.createFailed'))
    },
    onSuccess: async (blob) => {
      toast.success(t('backup.toast.createSuccess'))
      saveBlob(blob, 'backup.zip')
      await invalidateBackups()
    },
  })

  const uploadMutation = useMutation({
    mutationFn: uploadAndRestoreBackup,
    onError: () => {
      toast.error(t('backup.toast.uploadFailed'))
    },
    onSuccess: () => {
      toast.success(t('backup.toast.uploadSuccess'))
      setTimeout(() => {
        location.reload()
      }, 1000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBackup,
    onError: () => {
      toast.error(t('backup.toast.deleteFailed'))
    },
    onSuccess: async (_, filename) => {
      toast.success(t('backup.toast.deleteSuccess'))
      setSelectedKeys((current) => {
        const next = new Set(current)
        next.delete(filename)
        return next
      })
      if (detailFilename === filename) {
        closeDetail()
      }
      await invalidateBackups()
    },
  })

  const rollbackMutation = useMutation({
    mutationFn: rollbackBackup,
    onError: () => {
      toast.error(t('backup.toast.rollbackFailed'))
    },
    onSuccess: () => {
      toast.success(t('backup.toast.rollbackSuccess'))
      setTimeout(() => {
        location.reload()
      }, 1000)
    },
  })

  const downloadMutation = useMutation({
    mutationFn: async (filename: string) => ({
      blob: await downloadBackup(filename),
      filename,
    }),
    onError: () => {
      toast.error(t('backup.toast.downloadFailed'))
    },
    onSuccess: ({ blob, filename }) => {
      toast.success(t('backup.toast.downloadSuccess'))
      saveBlob(blob, `${filename}.zip`)
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async () => {
      const filenames = Array.from(selectedKeys)
      const results = await Promise.allSettled(
        filenames.map((filename) => deleteBackup(filename)),
      )

      return {
        failedCount: results.filter((result) => result.status === 'rejected')
          .length,
        filenames,
        successfulFilenames: filenames.filter(
          (_, index) => results[index].status === 'fulfilled',
        ),
        successCount: results.filter((result) => result.status === 'fulfilled')
          .length,
      }
    },
    onSuccess: async ({ failedCount, successCount, successfulFilenames }) => {
      setSelectedKeys((current) => {
        const next = new Set(current)
        successfulFilenames.forEach((filename) => next.delete(filename))
        return next
      })
      if (detailFilename && successfulFilenames.includes(detailFilename)) {
        closeDetail()
      }
      if (failedCount > 0) {
        toast.warning(
          t('backup.toast.batchPartial', {
            failed: failedCount,
            success: successCount,
          }),
        )
      } else {
        toast.success(t('backup.toast.batchSuccess', { count: successCount }))
      }
      await invalidateBackups()
    },
  })

  const toggleSelect = (filename: string, checked: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (checked) next.add(filename)
      else next.delete(filename)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedKeys(() =>
      allSelected ? new Set() : new Set(backups.map((item) => item.filename)),
    )
  }

  const handleUploadChange = (file: File | undefined) => {
    if (!file) return
    uploadMutation.mutate(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const ctxValue = useMemo(
    () => ({
      onBack: closeDetail,
      onDelete: (item: BackupFile) => deleteMutation.mutate(item.filename),
      onDownload: (item: BackupFile) => downloadMutation.mutate(item.filename),
      onRollback: (item: BackupFile) => rollbackMutation.mutate(item.filename),
    }),
    [closeDetail, deleteMutation, downloadMutation, rollbackMutation],
  )

  return (
    <BackupRouteContext.Provider value={ctxValue}>
      <MasterDetailShell
        emptyDetail={<BackupDetailEmptyState />}
        list={
          <section className="flex h-full min-h-0 flex-col">
            <div
              className={cn(
                'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex items-center gap-3">
                <MobileHeaderAffordance />
                <Checkbox
                  aria-label={t('backup.list.selectAllAria')}
                  checked={allSelected}
                  indeterminate={selectedKeys.size > 0 && !allSelected}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {selectedKeys.size > 0
                    ? t('backup.list.selected', { count: selectedKeys.size })
                    : t('backup.list.selectAll')}
                </span>
              </div>
              <span className="text-xs text-neutral-400">
                {t('backup.list.countLabel', { count: backups.length })}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <Button
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
                type="button"
              >
                <Database aria-hidden="true" className="size-4" />
                {t('backup.actions.createNow')}
              </Button>
              <Button
                disabled={uploadMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
                type="button"
                variant="subtle"
              >
                <Upload aria-hidden="true" className="size-4" />
                {t('backup.actions.uploadRestore')}
              </Button>
              <Button
                className="text-red-600 dark:text-red-400"
                disabled={
                  selectedKeys.size === 0 || batchDeleteMutation.isPending
                }
                onClick={() => {
                  if (
                    window.confirm(
                      t('backup.actions.confirmBatchDelete', {
                        count: selectedKeys.size,
                      }),
                    )
                  ) {
                    batchDeleteMutation.mutate()
                  }
                }}
                type="button"
                variant="subtle"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {t('backup.actions.batchDelete')}
              </Button>
              <input
                accept=".zip"
                className="hidden"
                onChange={(event) =>
                  handleUploadChange(event.target.files?.[0])
                }
                ref={fileInputRef}
                type="file"
              />
            </div>

            <Scroll className="flex-1">
              {backupsQuery.isLoading && backups.length === 0 ? (
                <BackupListSkeleton />
              ) : backups.length === 0 ? (
                <BackupListEmptyState
                  onCreate={() => createMutation.mutate()}
                  onRestore={() => fileInputRef.current?.click()}
                />
              ) : (
                backups.map((item) => (
                  <BackupListItem
                    checked={selectedKeys.has(item.filename)}
                    item={item}
                    key={item.filename}
                    onSelect={() => {
                      navigate(
                        `/maintenance/backup/${encodeURIComponent(item.filename)}`,
                      )
                    }}
                    onToggleCheck={toggleSelect}
                    selected={detailFilename === item.filename}
                  />
                ))
              )}
            </Scroll>
          </section>
        }
      />
    </BackupRouteContext.Provider>
  )
}
