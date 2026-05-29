import type { PaginateResult } from '~/models/base'
import type { NoteModel } from '~/models/note'
import type { TopicModel } from '~/models/topic'

import { deleteJson, getJson, patchJson, postJson, putJson } from './http'

export interface GetTopicsParams {
  page?: number
  size?: number
}

export interface CreateTopicData {
  description?: string
  icon?: string
  introduce: string
  name: string
  slug: string
}

export type UpdateTopicData = Partial<CreateTopicData>

export function getTopics(params: GetTopicsParams = {}) {
  return getJson<PaginateResult<TopicModel>>('/topics', {
    page: params.page,
    size: params.size,
  })
}

export function getTopic(id: string) {
  return getJson<TopicModel>(`/topics/${id}`)
}

export function createTopic(data: CreateTopicData) {
  return postJson<TopicModel, CreateTopicData>('/topics', data)
}

export function updateTopic(id: string, data: UpdateTopicData) {
  return putJson<TopicModel, UpdateTopicData>(`/topics/${id}`, data)
}

export function patchTopic(id: string, data: Partial<TopicModel>) {
  return patchJson<TopicModel, Partial<TopicModel>>(`/topics/${id}`, data)
}

export function deleteTopic(id: string) {
  return deleteJson<void>(`/topics/${id}`)
}

export function getNotesByTopic(
  topicId: string,
  params: { page?: number; size?: number } = {},
) {
  return getJson<PaginateResult<Partial<NoteModel>>>(
    `/notes/topics/${topicId}`,
    {
      page: params.page,
      size: params.size,
    },
  )
}
