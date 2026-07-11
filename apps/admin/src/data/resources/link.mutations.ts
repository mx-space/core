import type { LinkInput } from '~/api/links'
import {
  auditLinkWithReason,
  auditPassLink,
  createLink,
  updateLink,
} from '~/api/links'
import { createTransaction } from '~/data/resource/transaction'
import type { LinkModel } from '~/models/link'
import { LinkState } from '~/models/link'

import { links } from './link'

export async function saveLink(
  mode: { kind: 'create' } | { id: string; kind: 'edit' },
  form: LinkInput,
): Promise<LinkModel> {
  if (mode.kind === 'edit') {
    const { id } = mode
    const tx = createTransaction()
    tx.update(links, id, (draft) => {
      draft.name = form.name
      draft.url = form.url
      draft.description = form.description
      if (form.avatar !== undefined) draft.avatar = form.avatar
      if (form.type !== undefined) draft.type = form.type
      if (form.state !== undefined) draft.state = form.state
    })
    const result = await tx.commit(() => updateLink(id, form))
    links.hydrate([result])
    return result
  }

  const result = await createLink(form)
  links.upsert(result)
  return result
}

export function removeLink(id: string): Promise<void> {
  return links.delete(id)
}

export async function auditPass(id: string): Promise<LinkModel> {
  const tx = createTransaction()
  tx.update(links, id, (draft) => {
    draft.state = LinkState.Pass
  })
  const result = await tx.commit(() => auditPassLink(id))
  links.hydrate([result])
  return result
}

export function auditWithReason(
  id: string,
  reason: string,
  state: number,
): Promise<void> {
  const tx = createTransaction()
  tx.update(links, id, (draft) => {
    draft.state = state
  })
  return tx.commit(() => auditLinkWithReason(id, { reason, state }))
}
