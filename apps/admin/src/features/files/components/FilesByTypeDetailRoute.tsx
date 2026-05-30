import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useParams } from 'react-router'

import type { FileItem } from '~/api/files'
import { findInListCache } from '~/api/list-cache'
import { useDocumentTitle } from '~/hooks/use-document-title'
import { useI18n } from '~/i18n'
import { relativeTimeFromNow } from '~/utils/time'

import { filesQueryKey } from '../constants'
import { adaptFileItem } from '../utils/adapters'
import { formatBytes } from '../utils/format'
import { mimeFromName } from '../utils/isImageMime'
import { FileDetailEmpty } from './FileDetailEmpty'
import { FileDetailPane } from './FileDetailPane'
import { useFilesByTypeRouteContext } from './files-by-type-route-context'
import { MetadataGrid } from './sections/MetadataGrid'
import { PaletteSwatches } from './sections/PaletteSwatches'

const LIST_PREFIX = [...filesQueryKey, 'by-type'] as const

function extractFiles(value: unknown): FileItem[] | undefined {
  if (Array.isArray(value)) return value as FileItem[]
  return undefined
}

export function FilesByTypeDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const ctx = useFilesByTypeRouteContext()

  const raw = useMemo(() => {
    if (!id) return undefined
    return findInListCache<FileItem>(
      queryClient,
      [...LIST_PREFIX, ctx.fileType],
      id,
      { idField: 'name', extractItems: extractFiles },
    )
  }, [ctx.fileType, id, queryClient])

  useDocumentTitle(raw?.name ?? id)

  if (!id || !raw) return <FileDetailEmpty />

  const item = adaptFileItem(raw)
  const sections = buildSections({
    item,
    naturalSize: ctx.naturalSize,
    t,
    typeLabel: ctx.typeLabel,
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
        onDimensions={ctx.onDimensions}
        onOpenPreview={() =>
          ctx.onOpenPreview({ name: item.name, url: item.url })
        }
        sections={sections}
        url={item.url}
      />
    </section>
  )
}

export default FilesByTypeDetailRoute

type Translator = ReturnType<typeof useI18n>['t']

function buildSections(args: {
  item: ReturnType<typeof adaptFileItem>
  naturalSize: null | { width: number; height: number }
  t: Translator
  typeLabel: string
}) {
  const { item, naturalSize, t, typeLabel } = args
  const created = item.raw.created ? new Date(item.raw.created) : null
  const mime = mimeFromName(item.name)
  const unknown = t('files.detail.value.unknown')

  return [
    {
      key: 'basics',
      title: t('files.detail.section.basics'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'url',
              label: t('files.detail.field.url'),
              mono: true,
              value: item.url,
            },
            {
              key: 'type',
              label: t('files.detail.field.type'),
              value: typeLabel,
            },
            {
              key: 'created',
              label: t('files.detail.field.created'),
              value: created
                ? `${relativeTimeFromNow(created)} (${created.toLocaleString()})`
                : unknown,
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
              key: 'mime',
              label: t('files.detail.field.mime'),
              value: mime ?? unknown,
            },
            {
              key: 'size',
              label: t('files.detail.field.size'),
              value: formatBytes(undefined),
            },
            {
              key: 'dimensions',
              label: t('files.detail.field.dimensions'),
              value: naturalSize
                ? `${naturalSize.width} × ${naturalSize.height}`
                : unknown,
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
              value: <PaletteSwatches palette={item.palette} />,
            },
            {
              key: 'thumbhash',
              label: t('files.detail.field.thumbhash'),
              mono: true,
              value: item.thumbhash ?? unknown,
            },
          ]}
        />
      ),
    },
  ]
}
