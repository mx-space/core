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
