export function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text.trim()) return {}
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function samplePropsFromSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const { properties } = schema
  if (!properties || typeof properties !== 'object') return {}
  const sample: Record<string, unknown> = {}
  for (const [key, definition] of Object.entries(properties)) {
    if (definition && typeof definition === 'object' && 'default' in definition)
      sample[key] = definition.default
  }
  return sample
}

interface PropsFieldBase {
  defaultValue?: unknown
  description?: string
  key: string
  label: string
  required: boolean
}

type FieldShape =
  | { kind: 'boolean' }
  | { kind: 'enum'; options: string[] }
  | { integer: boolean; kind: 'number' }
  | { kind: 'string' }

export type PropsField = PropsFieldBase & FieldShape

function fieldShape(definition: Record<string, unknown>): FieldShape | null {
  const { enum: options, type } = definition
  if (
    type === 'string' &&
    Array.isArray(options) &&
    options.every((option) => typeof option === 'string')
  )
    return { kind: 'enum', options }
  if (type === 'string') return { kind: 'string' }
  if (type === 'number' || type === 'integer')
    return { integer: type === 'integer', kind: 'number' }
  if (type === 'boolean') return { kind: 'boolean' }
  return null
}

export function fieldsFromSchema(
  schema: Record<string, unknown>,
): PropsField[] {
  const { properties, required } = schema
  if (!properties || typeof properties !== 'object') return []
  const requiredKeys = new Set(Array.isArray(required) ? required : [])
  const fields: PropsField[] = []
  for (const [key, raw] of Object.entries(properties)) {
    if (!raw || typeof raw !== 'object') continue
    const definition = raw as Record<string, unknown>
    const shape = fieldShape(definition)
    if (!shape) continue
    fields.push({
      key,
      ...shape,
      label: typeof definition.title === 'string' ? definition.title : key,
      ...(typeof definition.description === 'string'
        ? { description: definition.description }
        : {}),
      required: requiredKeys.has(key),
      ...('default' in definition ? { defaultValue: definition.default } : {}),
    })
  }
  return fields
}

export function applyFieldValue(
  props: Record<string, unknown>,
  field: PropsField,
  input: boolean | string,
): Record<string, unknown> {
  if (field.kind !== 'number') return { ...props, [field.key]: input }
  if (input === '') {
    const { [field.key]: _removed, ...rest } = props
    return rest
  }
  const value = Number(input)
  if (!Number.isFinite(value)) return props
  return { ...props, [field.key]: field.integer ? Math.trunc(value) : value }
}
