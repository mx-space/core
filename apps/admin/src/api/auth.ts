import type { TokenModel } from '~/models/token'

import { translate } from '~/i18n/translate'
import { authClient } from '~/utils/authjs/auth'

import { getJson, postJson, requestJson } from './http'

export interface CreateTokenData {
  expired?: Date | string
  name: string
}

export interface PasskeyItem {
  createdAt: string
  credentialID: string
  id: string
  name?: string
  publicKey?: string
}

export interface LoggedStatus {
  isGuest?: boolean
  ok: boolean | number
}

export function checkLogged() {
  return getJson<LoggedStatus>('/owner/check_logged')
}

export function getTokens() {
  return getJson<TokenModel[]>('/auth/token')
}

export function getToken(id: string) {
  return getJson<TokenModel>('/auth/token', { id })
}

export function createToken(data: CreateTokenData) {
  return postJson<TokenModel, CreateTokenData>('/auth/token', data)
}

export function deleteToken(id: string) {
  return requestJson<void>(`/auth/token?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function authAsOwner() {
  return requestJson<void>('/auth/as-owner', {
    method: 'PATCH',
  })
}

export async function listPasskeys() {
  const result = await authClient.passkey.listUserPasskeys()
  if (result.error)
    throw new Error(result.error.message || translate('api.error.passkeyFetch'))

  return (result.data ?? []).map((passkey: any) => ({
    createdAt: String(passkey.createdAt ?? new Date().toISOString()),
    credentialID: String(passkey.credentialID ?? passkey.id),
    id: String(passkey.id),
    name: passkey.name ? String(passkey.name) : undefined,
    publicKey: passkey.publicKey ? String(passkey.publicKey) : undefined,
  })) as PasskeyItem[]
}

export async function deletePasskey(id: string) {
  const result = await authClient.passkey.deletePasskey({ id })
  if (result.error)
    throw new Error(
      result.error.message || translate('api.error.passkeyDelete'),
    )
}
