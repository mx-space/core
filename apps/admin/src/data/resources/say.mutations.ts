import type { SayInput } from '~/api/says'
import { createSay, updateSay } from '~/api/says'
import { createTransaction } from '~/data/resource/transaction'
import type { SayModel } from '~/models/say'

import { says } from './say'

export async function saveSay(
  mode: { kind: 'create' } | { id: string; kind: 'edit' },
  form: SayInput,
): Promise<SayModel> {
  if (mode.kind === 'edit') {
    const { id } = mode
    const tx = createTransaction()
    tx.update(says, id, (draft) => {
      draft.text = form.text
      draft.author = form.author ?? null
      draft.source = form.source ?? null
    })
    const result = await tx.commit(() => updateSay(id, form))
    says.hydrate([result])
    return result
  }

  const result = await createSay(form)
  says.upsert(result)
  return result
}

export function removeSay(id: string): Promise<void> {
  return says.delete(id)
}
