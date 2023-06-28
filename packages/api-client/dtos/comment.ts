export interface CommentDto {
  author: string

  text: string

  mail: string

  url?: string

  source?: 'github' | 'google'
  avatar?: string
}
