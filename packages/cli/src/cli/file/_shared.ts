import { Flag } from 'effect/cli'

/** Mirrors the server's `FileTypeEnum` (apps/core modules/file/file.type.ts). */
export const FILE_TYPES = ['file', 'image', 'icon', 'avatar'] as const

export type FileType = (typeof FILE_TYPES)[number]

export const typeOption = Flag.Literals('type', FILE_TYPES).pipe(
  Flag.withDescription('server-side storage bucket for the file'),
  Flag.withDefault('file' as FileType),
)

export const silentFlag = Flag.Boolean('silent').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'On success, emit a minimal `ok` instead of the full server response.',
  ),
)
