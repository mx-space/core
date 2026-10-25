import { deleteJson, getJson, patchJson, postJson, requestBytes } from './http'

export interface CollabInvite {
  createdAt: string
  expiresAt: string
  id: string
  maxUses: number | null
  uses: number
}

export interface CreatedCollabInvite extends CollabInvite {
  token: string
}

export interface Collaborator {
  avatar: string | null
  contributedAt: string | null
  createdAt: string
  name: string
  readerId: string
  showInByline: boolean
}

export interface CollabPerson {
  avatar: string | null
  name: string
}

export interface CollabWorkspace {
  collaborators: CollabPerson[]
  documentId: string
  draftId: string
  me: CollabPerson & { id: string }
  refType: string
}

export type AcceptedCollabInvite =
  | { documentId: string; role: 'collaborator' }
  | {
      documentId: string
      draftId: string
      refId: string | null
      refType: string
      role: 'owner'
    }

const documentPath = (documentId: string) => `/collab/documents/${documentId}`

export function listCollabInvites(documentId: string) {
  return getJson<CollabInvite[]>(`${documentPath(documentId)}/invites`)
}

export function createCollabInvite(
  documentId: string,
  data: { expiresInDays?: number; maxUses?: number | null } = {},
) {
  return postJson<CreatedCollabInvite, typeof data>(
    `${documentPath(documentId)}/invites`,
    data,
  )
}

export function revokeCollabInvite(documentId: string, inviteId: string) {
  return deleteJson<void>(`${documentPath(documentId)}/invites/${inviteId}`)
}

export function listCollaborators(documentId: string) {
  return getJson<Collaborator[]>(`${documentPath(documentId)}/collaborators`)
}

export function updateCollaborator(
  documentId: string,
  readerId: string,
  data: { showInByline: boolean },
) {
  return patchJson<void, typeof data>(
    `${documentPath(documentId)}/collaborators/${encodeURIComponent(readerId)}`,
    data,
  )
}

export function removeCollaborator(documentId: string, readerId: string) {
  return deleteJson<void>(
    `${documentPath(documentId)}/collaborators/${encodeURIComponent(readerId)}`,
  )
}

export function acceptCollabInvite(token: string) {
  return postJson<AcceptedCollabInvite, Record<string, never>>(
    `/collab/invites/${encodeURIComponent(token)}/accept`,
    {},
  )
}

export function getCollabWorkspace(documentId: string) {
  return getJson<CollabWorkspace>(documentPath(documentId))
}

const encodeBase64 = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))

export function getCollabCrdt(documentId: string, since?: Uint8Array) {
  const query = since ? `?since=${encodeURIComponent(encodeBase64(since))}` : ''
  return requestBytes(`${documentPath(documentId)}/crdt${query}`, {
    method: 'GET',
  })
}

export async function postCollabCrdt(documentId: string, bytes: Uint8Array) {
  await requestBytes(`${documentPath(documentId)}/crdt`, {
    body: bytes as Uint8Array<ArrayBuffer>,
    headers: { 'content-type': 'application/octet-stream' },
    method: 'POST',
  })
}

export const collabInviteUrlOf = (token: string) =>
  `${window.location.origin}${window.location.pathname}#/collab/join/${token}`
