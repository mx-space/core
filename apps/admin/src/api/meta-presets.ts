import type {
  CreateMetaPresetDto,
  MetaPresetField,
  MetaPresetScope,
  UpdateMetaPresetDto,
} from '~/models/meta-preset'

import { deleteJson, getJson, patchJson, postJson, putJson } from './http'

export interface MetaPresetQueryParams {
  enabledOnly?: boolean
  scope?: MetaPresetScope
}

export function getMetaPresets(params?: MetaPresetQueryParams) {
  return getJson<MetaPresetField[]>('/meta-presets', {
    enabledOnly: params?.enabledOnly,
    scope: params?.scope,
  })
}

export function getMetaPreset(id: string) {
  return getJson<MetaPresetField>(`/meta-presets/${id}`)
}

export function createMetaPreset(data: CreateMetaPresetDto) {
  return postJson<MetaPresetField, CreateMetaPresetDto>('/meta-presets', data)
}

export function updateMetaPreset(id: string, data: UpdateMetaPresetDto) {
  return patchJson<MetaPresetField, UpdateMetaPresetDto>(
    `/meta-presets/${id}`,
    data,
  )
}

export function deleteMetaPreset(id: string) {
  return deleteJson<void>(`/meta-presets/${id}`)
}

export function updateMetaPresetOrder(ids: string[]) {
  return putJson<MetaPresetField[], { ids: string[] }>('/meta-presets/order', {
    ids,
  })
}
