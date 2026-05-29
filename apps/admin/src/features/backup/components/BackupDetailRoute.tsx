import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import type { BackupFile } from '~/api/backups'
import { findInListCache } from '~/api/list-cache'

import { useBackupRouteContext } from './backup-route-context'
import { BackupDetail } from './BackupDetail'
import { BackupDetailEmptyState } from './BackupDetailEmptyState'

const LIST_PREFIX = ['backups', 'list'] as const

function extractBackups(value: unknown): BackupFile[] | undefined {
  if (Array.isArray(value)) return value as BackupFile[]
  return undefined
}

export function BackupDetailRoute() {
  const { filename } = useParams<{ filename: string }>()
  const queryClient = useQueryClient()
  const ctx = useBackupRouteContext()

  const item = filename
    ? findInListCache<BackupFile>(queryClient, LIST_PREFIX, filename, {
        idField: 'filename',
        extractItems: extractBackups,
      })
    : undefined

  if (!item) return <BackupDetailEmptyState />

  return (
    <section className="h-full min-h-0">
      <BackupDetail
        item={item}
        onBack={ctx.onBack}
        onDelete={() => ctx.onDelete(item)}
        onDownload={() => ctx.onDownload(item)}
        onRollback={() => ctx.onRollback(item)}
      />
    </section>
  )
}

export default BackupDetailRoute
