import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useParams } from 'react-router'

import type { CommentUploadFile, CommentUploadStatus } from '~/api/files'
import { findInListCache } from '~/api/list-cache'
import { useI18n } from '~/i18n'
import { relativeTimeFromNow } from '~/utils/time'

import { filesQueryKey } from '../constants'
import { adaptCommentUpload } from '../utils/adapters'
import { formatBytes } from '../utils/format'
import { useCommentImagesRouteContext } from './comment-images-route-context'
import { FileDetailEmpty } from './FileDetailEmpty'
import { FileDetailPane } from './FileDetailPane'
import { MetadataGrid } from './sections/MetadataGrid'
import { PaletteSwatches } from './sections/PaletteSwatches'

const LIST_PREFIX = [...filesQueryKey, 'comment-uploads'] as const

function extractCommentUploads(
  value: unknown,
): CommentUploadFile[] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const data = (value as { data?: unknown }).data
  return Array.isArray(data) ? (data as CommentUploadFile[]) : undefined
}

export function CommentImageDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const ctx = useCommentImagesRouteContext()

  const raw = useMemo(() => {
    if (!id) return undefined
    return findInListCache<CommentUploadFile>(queryClient, LIST_PREFIX, id, {
      extractItems: extractCommentUploads,
    })
  }, [id, queryClient])

  if (!id || !raw) return <FileDetailEmpty />

  const item = adaptCommentUpload(raw, t, ctx.statusLabels)
  const sections = buildSections({
    item,
    statusLabels: ctx.statusLabels,
    t,
  })

  return (
    <section className="h-full min-h-0">
      <FileDetailPane
        thumbhash={item.thumbhash}
        deleteDisabled={ctx.deleteDisabled}
        dominantColor={item.palette?.dominant}
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

export default CommentImageDetailRoute

type Translator = ReturnType<typeof useI18n>['t']

function buildSections(args: {
  item: ReturnType<typeof adaptCommentUpload>
  statusLabels: Record<Exclude<CommentUploadStatus, ''>, string>
  t: Translator
}) {
  const { item, statusLabels, t } = args
  const raw = item.raw
  const unknown = t('files.detail.value.unknown')
  const ref =
    raw.refType && raw.refId
      ? `${raw.refType}/${raw.refId}`
      : t('files.detail.value.unbound')

  return [
    {
      key: 'status',
      title: t('files.detail.section.status'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'status',
              label: t('files.detail.field.status'),
              value: statusLabels[raw.status],
            },
            {
              key: 'detachedAt',
              label: t('files.detail.field.detachedAt'),
              value: raw.detachedAt
                ? relativeTimeFromNow(raw.detachedAt)
                : unknown,
            },
          ]}
        />
      ),
    },
    {
      key: 'reference',
      title: t('files.detail.section.reference'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'ref',
              label: t('files.detail.field.refType'),
              value: ref,
            },
            {
              key: 'reader',
              label: t('files.detail.field.readerId'),
              value: raw.readerId ?? unknown,
            },
          ]}
        />
      ),
    },
    {
      key: 'image',
      title: t('files.detail.section.image'),
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
    {
      key: 'appearance',
      title: t('files.detail.section.appearance'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'palette',
              label: t('files.detail.field.palette'),
              value: <PaletteSwatches palette={raw.palette} />,
            },
            {
              key: 'thumbhash',
              label: t('files.detail.field.thumbhash'),
              mono: true,
              value: raw.thumbhash ?? unknown,
            },
          ]}
        />
      ),
    },
  ]
}
