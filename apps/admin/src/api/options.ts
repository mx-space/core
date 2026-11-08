import type { UserModel } from '~/models/user'

import { deleteJson, getJson, patchJson, putJson } from './http'

export interface SystemOptions {
  [key: string]: unknown
}

export interface UrlOptions {
  adminUrl: string
  serverUrl: string
  webUrl: string
  wsUrl: string
}

export interface EmailTemplateResponse {
  props: unknown
  template: string
}

export type ConfigFieldComponent =
  | 'action'
  | 'input'
  | 'number'
  | 'password'
  | 'select'
  | 'switch'
  | 'tags'
  | 'textarea'

export interface ConfigFieldUi {
  actionId?: string
  actionLabel?: string
  component: ConfigFieldComponent
  halfGrid?: boolean
  hidden?: boolean
  options?: Array<{ label: string; value: number | string }>
  placeholder?: string
  showWhen?: Record<
    string,
    boolean | number | string | Array<boolean | number | string>
  >
}

export interface ConfigFormField {
  description?: string
  fields?: ConfigFormField[]
  key: string
  required?: boolean
  subsection?: {
    description?: string
    title: string
  }
  title: string
  ui: ConfigFieldUi
}

export interface ConfigFormSection {
  description?: string
  fields: ConfigFormField[]
  hidden?: boolean
  key: string
  title: string
}

export interface ConfigFormGroup {
  description: string
  icon: string
  key: string
  sections: ConfigFormSection[]
  title: string
}

export interface ConfigFormSchema {
  defaults: Record<string, unknown>
  description?: string
  groups: ConfigFormGroup[]
  title: string
}

export interface UpdateOwnerData {
  avatar?: string
  introduce?: string
  mail?: string
  name?: string
  socialIds?: Record<string, number | string>
  url?: string
  username?: string
}

function restoreFormFieldKeys(
  value: unknown,
  fields: ConfigFormField[],
): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const source = value as Record<string, unknown>
  const keys = new Map(
    Object.keys(source).map((key) => [key.toLowerCase(), key]),
  )
  const result = { ...source }
  for (const field of fields) {
    const key = keys.get(field.key.toLowerCase())
    if (key === undefined) continue
    result[field.key] = field.fields?.length
      ? restoreFormFieldKeys(source[key], field.fields)
      : source[key]
    if (key !== field.key) delete result[key]
  }
  return result
}

export async function getAllOptions(schema?: ConfigFormSchema) {
  const options = await getJson<SystemOptions>('/options')
  if (!schema) return options
  const result = { ...options }
  for (const group of schema.groups)
    for (const section of group.sections)
      result[section.key] = restoreFormFieldKeys(
        options[section.key],
        section.fields,
      )
  return result
}

export function getFormSchema() {
  return getJson<ConfigFormSchema>('/config/form-schema')
}

export function getOption<T = unknown>(key: string) {
  return getJson<T>(`/options/${key}`)
}

export function getUrlOptions() {
  return getJson<UrlOptions>('/options/url')
}

export function patchOption(key: string, data: unknown) {
  return patchJson<void, unknown>(`/options/${key}`, data)
}

export function getEmailTemplate(type: string) {
  return getJson<EmailTemplateResponse>('/options/email/template', { type })
}

export function updateEmailTemplate(type: string, source: string) {
  return putJson<void, { source: string }>(
    `/options/email/template?type=${encodeURIComponent(type)}`,
    {
      source,
    },
  )
}

export function deleteEmailTemplate(type: string) {
  return deleteJson<void>(
    `/options/email/template?type=${encodeURIComponent(type)}`,
  )
}

export function getOwner() {
  return getJson<UserModel>('/owner')
}

export function updateOwner(data: UpdateOwnerData) {
  return patchJson<UserModel, UpdateOwnerData>('/owner', data)
}
