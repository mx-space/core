import type { CrdtFields } from './draft.types'
import type { DocFields } from './draft-crdt.doc'
import { SECRET_FIELD_KEYS } from './draft-crdt.doc'

const pickKeys = (
  values: Record<string, unknown> | null | undefined,
  secret: boolean,
) => {
  if (!values) return null
  const picked = Object.entries(values).filter(
    ([key]) => SECRET_FIELD_KEYS.has(key) === secret,
  )
  return picked.length ? Object.fromEntries(picked) : null
}

export const publicFields = (fields: CrdtFields | null): DocFields => ({
  meta: pickKeys(fields?.meta, false),
  typeSpecificData: pickKeys(fields?.typeSpecificData, false),
})

export const withSecrets = (
  fields: DocFields,
  row: CrdtFields | null,
): CrdtFields => {
  const merge = (section: keyof CrdtFields) => {
    const secrets = pickKeys(row?.[section], true)
    const values = fields[section]
    return secrets ? { ...values, ...secrets } : (values ?? null)
  }
  return { meta: merge('meta'), typeSpecificData: merge('typeSpecificData') }
}
