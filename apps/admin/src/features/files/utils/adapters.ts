import type {
  CommentUploadFile,
  CommentUploadStatus,
  FileItem,
  OrphanFile,
} from '~/api/files'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { BadgeTone } from '~/ui/primitives/badge'

import { relativeTimeFromNow } from '~/utils/time'

import { formatBytes } from './format'

export interface RowStatus {
  label: string
  tone: BadgeTone
}

export interface FileRowItem<TRaw = unknown> {
  id: string
  name: string
  url: string
  thumbhash?: null | string
  palette?: { dominant?: string; swatches?: string[] } | null
  primary: string
  secondary?: string
  tertiary?: string
  status?: RowStatus
  createdAt?: string
  raw: TRaw
}

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export function adaptFileItem(item: FileItem): FileRowItem<FileItem> {
  const created = item.created
    ? relativeTimeFromNow(new Date(item.created))
    : undefined
  return {
    id: item.name,
    name: item.name,
    url: item.url,
    thumbhash: item.thumbhash,
    palette: item.palette,
    primary: item.name,
    secondary: created,
    createdAt: item.created ? new Date(item.created).toISOString() : undefined,
    raw: item,
  }
}

export function adaptOrphanFile(
  item: OrphanFile,
  t: Translator,
): FileRowItem<OrphanFile> {
  const meta = [formatBytes(item.byteSize), relativeTimeFromNow(item.createdAt)]
    .filter(Boolean)
    .join(' · ')
  const ref =
    item.refType && item.refId
      ? `${item.refType}/${item.refId}`
      : t('files.commentImages.unbound')

  return {
    id: item.id,
    name: item.fileName,
    url: item.fileUrl,
    thumbhash: item.thumbhash,
    palette: item.palette,
    primary: item.fileName,
    secondary: meta,
    tertiary: ref,
    status: item.status
      ? { label: item.status, tone: orphanStatusTone(item.status) }
      : undefined,
    createdAt: item.createdAt,
    raw: item,
  }
}

function orphanStatusTone(status: OrphanFile['status']): BadgeTone {
  switch (status) {
    case 'active':
      return 'neutral'
    case 'pending':
      return 'warning'
    case 'detached':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function adaptCommentUpload(
  item: CommentUploadFile,
  t: Translator,
  statusLabels: Record<Exclude<CommentUploadStatus, ''>, string>,
): FileRowItem<CommentUploadFile> {
  const meta = [formatBytes(item.byteSize), item.mimeType ?? undefined]
    .filter(Boolean)
    .join(' · ')
  const ref =
    item.refType && item.refId
      ? `${item.refType}/${item.refId}`
      : t('files.commentImages.unbound')

  return {
    id: item.id,
    name: item.fileName,
    url: item.fileUrl,
    thumbhash: item.thumbhash,
    palette: item.palette,
    primary: item.fileName,
    secondary: meta,
    tertiary: ref,
    status: {
      label: statusLabels[item.status],
      tone: commentStatusTone(item.status),
    },
    createdAt: item.createdAt,
    raw: item,
  }
}

function commentStatusTone(status: CommentUploadFile['status']): BadgeTone {
  switch (status) {
    case 'active':
      return 'neutral'
    case 'pending':
      return 'warning'
    case 'detached':
      return 'danger'
    default:
      return 'neutral'
  }
}
