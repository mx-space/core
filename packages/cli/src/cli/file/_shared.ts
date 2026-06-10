import { Options } from '@effect/cli'

/** Mirrors the server's `FileTypeEnum` (apps/core modules/file/file.type.ts). */
export const FILE_TYPES = ['file', 'image', 'icon', 'avatar'] as const

export type FileType = (typeof FILE_TYPES)[number]

export const typeOption = Options.choice('type', FILE_TYPES).pipe(
  Options.withDescription('server-side storage bucket for the file'),
  Options.withDefault('file' as FileType),
)

export const silentFlag = Options.boolean('silent').pipe(
  Options.withDescription(
    'On success, emit a minimal `ok` instead of the full server response.',
  ),
)
