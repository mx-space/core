export interface AnonymousCommentDto {
  author: string

  text: string

  mail: string

  url?: string

  avatar?: string

  isWhispers?: boolean
}

export interface ReaderCommentDto {
  text: string

  isWhispers?: boolean
}

export type CommentDto = AnonymousCommentDto | ReaderCommentDto

export interface CommentUploadConfigDto {
  enable: boolean
  singleFileSizeMB: number
  commentImageMaxCount: number
  mimeWhitelist: string[]
  pendingTtlMinutes: number
}

export interface CommentUploadResultDto {
  url: string
  fileName: string
  byteSize: number
  mimeType: string
  expireAt: string
}
