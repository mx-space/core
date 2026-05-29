import { FileIcon, ImageIcon, Smile, User } from 'lucide-react'
import type { CommentUploadStatus, FileType } from '~/api/files'
import type { TranslationKey } from '~/i18n/types'
import type { LucideIcon } from 'lucide-react'

export const filesQueryKey = ['files'] as const

export interface FileTypeOption {
  acceptImage: boolean
  icon: LucideIcon
  labelKey: TranslationKey
  value: FileType
}

export const fileTypeOptions: FileTypeOption[] = [
  {
    acceptImage: true,
    icon: Smile,
    labelKey: 'files.fileType.icon',
    value: 'icon',
  },
  {
    acceptImage: true,
    icon: User,
    labelKey: 'files.fileType.avatar',
    value: 'avatar',
  },
  {
    acceptImage: true,
    icon: ImageIcon,
    labelKey: 'files.fileType.image',
    value: 'image',
  },
  {
    acceptImage: false,
    icon: FileIcon,
    labelKey: 'files.fileType.file',
    value: 'file',
  },
]

export const commentStatusOptions: Array<{
  labelKey: TranslationKey
  value: CommentUploadStatus
}> = [
  { labelKey: 'files.commentStatus.all', value: '' },
  { labelKey: 'files.commentStatus.active', value: 'active' },
  { labelKey: 'files.commentStatus.pending', value: 'pending' },
  { labelKey: 'files.commentStatus.detached', value: 'detached' },
]

export const FILES_PAGE_SIZE = 24
