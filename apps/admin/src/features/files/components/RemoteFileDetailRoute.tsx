import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useParams } from 'react-router'

import type { RemoteFile } from '~/api/files'
import { findInListCache } from '~/api/list-cache'
import { useDocumentTitle } from '~/hooks/use-document-title'
import { useI18n } from '~/i18n'
import { relativeTimeFromNow } from '~/utils/time'

import { filesQueryKey } from '../constants'
import { adaptRemoteFile } from '../utils/adapters'
import { formatBytes } from '../utils/format'
import { FileDetailEmpty } from './FileDetailEmpty'
import { FileDetailPane } from './FileDetailPane'
import { useRemoteFilesRouteContext } from './remote-files-route-context'
import { MetadataGrid } from './sections/MetadataGrid'

const LIST_PREFIX = [...filesQueryKey, 'remote'] as const

function extractRemoteFiles(value: unknown): RemoteFile[] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const data = (value as { data?: unknown }).data
  return Array.isArray(data) ? (data as RemoteFile[]) : undefined
}

export function RemoteFileDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const ctx = useRemoteFilesRouteContext()

  const raw = useMemo(() => {
    if (!id) return undefined
    return findInListCache<RemoteFile>(queryClient, LIST_PREFIX, id, {
      extractItems: extractRemoteFiles,
    })
  }, [id, queryClient])

  useDocumentTitle(raw?.fileName)

  if (!id || !raw) return <FileDetailEmpty />

  const item = adaptRemoteFile(raw, t)
  const unknown = t('files.detail.value.unknown')

  const sections = [
    {
      key: 'status',
      title: t('files.detail.section.status'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'status',
              label: t('files.detail.field.status'),
              value: item.status?.label ?? unknown,
            },
          ]}
        />
      ),
    },
    {
      key: 'file',
      title: t('files.detail.section.file'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'url',
              label: t('files.detail.field.url'),
              mono: true,
              value: raw.fileUrl,
            },
            {
              key: 'objectKey',
              label: t('files.detail.field.objectKey'),
              mono: true,
              value: raw.objectKey,
            },
            {
              key: 'size',
              label: t('files.detail.field.size'),
              value: formatBytes(raw.byteSize),
            },
            {
              key: 'mime',
              label: t('files.detail.field.mime'),
              value: raw.mimeType ?? unknown,
            },
            {
              key: 'created',
              label: t('files.detail.field.created'),
              value: relativeTimeFromNow(raw.createdAt),
            },
          ]}
        />
      ),
    },
  ]

  return (
    <section className="h-full min-h-0">
      <FileDetailPane
        deleteDisabled={ctx.deleteDisabled}
        isMobile
        name={item.name}
        onBack={ctx.onBack}
        onDelete={() => ctx.onDelete(item)}
        onOpenPreview={() =>
          ctx.onOpenPreview({ name: item.name, url: item.url })
        }
        sections={sections}
        url={item.url}
      />
    </section>
  )
}

export default RemoteFileDetailRoute
