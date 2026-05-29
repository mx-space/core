import type { Pager } from './base'

export interface SayModel {
  id: string
  createdAt: string
  text: string
  source: string | null
  author: string | null
}

export interface SayResponse {
  data: SayModel[]
  pagination: Pager
}
