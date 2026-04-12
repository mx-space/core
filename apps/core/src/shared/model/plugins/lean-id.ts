import { normalizeObjectIdString } from '~/shared/id'

interface NormalizationSchema {
  base?: {
    models?: Record<
      string,
      {
        schema?: NormalizationSchema
      }
    >
  }
  paths: Record<string, unknown>
  virtuals?: Record<string, NormalizationVirtualType | undefined>
  path: (path: string) => NormalizationSchemaType | undefined
}

interface NormalizationSchemaType {
  instance?: string
  schema?: NormalizationSchema
  options?: Record<string, unknown>
  embeddedSchemaType?: {
    instance?: string
    options?: Record<string, unknown>
  }
  caster?: {
    instance?: string
    options?: Record<string, unknown>
  }
}

interface NormalizationVirtualType {
  options?: Record<string, unknown> & {
    justOne?: boolean
  }
}

interface TraversalEntry {
  key: string
  isArray: boolean
  schema?: NormalizationSchema
}

interface TraversalPlan {
  pathEntries: TraversalEntry[]
  virtualEntries: TraversalEntry[]
}

const traversalPlanCache = new WeakMap<NormalizationSchema, TraversalPlan>()

// Adapted from mongoose-lean-id
export function mongooseLeanId(schema: any) {
  schema.post('find', attachId)
  schema.post('findOne', attachId)
  schema.post('findOneAndUpdate', attachId)
  schema.post('findOneAndReplace', attachId)
  schema.post('findOneAndDelete', attachId)
}

export function normalizeDocumentIds(
  value: any,
  schema?: NormalizationSchema | null,
): any {
  return normalizeDocumentIdsInternal(value, false, schema)
}

function normalizeLeanDocumentIds(
  value: any,
  schema?: NormalizationSchema | null,
): any {
  return normalizeDocumentIdsInternal(value, true, schema)
}

function normalizeDocumentIdsInternal(
  value: any,
  preserveOriginalId: boolean,
  schema?: NormalizationSchema | null,
): any {
  if (value == null || isObjectId(value)) {
    return value
  }

  const resolvedSchema = schema ?? resolveSchemaFromValue(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      normalizeDocumentIdsInternal(item, preserveOriginalId, resolvedSchema)
    }
    return value
  }

  if (typeof value !== 'object') {
    return value
  }

  if ('_id' in value && value._id != null) {
    value.id = normalizeObjectIdString(value._id)
  }

  if ('_id' in value) {
    if (preserveOriginalId) {
      hidePropertyFromEnumeration(value, '_id')
    } else {
      Reflect.deleteProperty(value, '_id')
    }
  }

  if (resolvedSchema) {
    traverseKnownSchemaChildren(value, resolvedSchema, preserveOriginalId)
  }

  return value
}

function attachId(this: any, res: any) {
  if (res == null) {
    return
  }
  if (this._mongooseOptions.lean) {
    normalizeLeanDocumentIds(res, this.model?.schema)
  }
}

function hidePropertyFromEnumeration(target: Record<string, any>, key: string) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)
  if (descriptor?.enumerable === false) {
    return
  }

  if (descriptor && descriptor.configurable === false) {
    return
  }

  if (descriptor && ('get' in descriptor || 'set' in descriptor)) {
    Object.defineProperty(target, key, {
      configurable: descriptor.configurable,
      enumerable: false,
      get: descriptor.get,
      set: descriptor.set,
    })
    return
  }

  Object.defineProperty(target, key, {
    configurable: descriptor?.configurable ?? true,
    enumerable: false,
    writable: descriptor?.writable ?? true,
    value: target[key],
  })
}

function traverseKnownSchemaChildren(
  value: Record<string, any>,
  schema: NormalizationSchema,
  preserveOriginalId: boolean,
) {
  const plan = getTraversalPlan(schema)

  for (const entry of plan.pathEntries) {
    if (!(entry.key in value)) {
      continue
    }
    normalizeTraversalEntry(value[entry.key], entry, preserveOriginalId)
  }

  for (const entry of plan.virtualEntries) {
    if (!(entry.key in value)) {
      continue
    }
    normalizeTraversalEntry(value[entry.key], entry, preserveOriginalId)
  }
}

function normalizeTraversalEntry(
  value: any,
  entry: TraversalEntry,
  preserveOriginalId: boolean,
) {
  if (value == null) {
    return
  }

  if (entry.isArray) {
    if (!Array.isArray(value)) {
      return
    }

    for (const item of value) {
      normalizeDocumentIdsInternal(item, preserveOriginalId, entry.schema)
    }
    return
  }

  normalizeDocumentIdsInternal(value, preserveOriginalId, entry.schema)
}

function getTraversalPlan(schema: NormalizationSchema): TraversalPlan {
  const cachedPlan = traversalPlanCache.get(schema)
  if (cachedPlan) {
    return cachedPlan
  }

  const pathEntries = Object.keys(schema.paths)
    .filter(isTopLevelSchemaPath)
    .filter((key) => key !== '_id' && key !== '__v')
    .map((key) => buildPathTraversalEntry(schema, key))
    .filter((entry): entry is TraversalEntry => entry != null)

  const virtualEntries = Object.entries(schema.virtuals ?? {})
    .filter(([key]) => key !== 'id' && !key.includes('.'))
    .map(([key, virtualType]) =>
      buildVirtualTraversalEntry(schema, key, virtualType),
    )
    .filter((entry): entry is TraversalEntry => entry != null)

  const plan = { pathEntries, virtualEntries }
  traversalPlanCache.set(schema, plan)
  return plan
}

function buildPathTraversalEntry(
  schema: NormalizationSchema,
  key: string,
): TraversalEntry | null {
  const schemaType = schema.path(key)
  if (!schemaType) {
    return null
  }

  if (schemaType.schema) {
    return {
      key,
      isArray: schemaType.instance === 'Array',
      schema: schemaType.schema,
    }
  }

  const ref = getSchemaTypeRef(schemaType)
  if (!ref) {
    return null
  }

  return {
    key,
    isArray: schemaType.instance === 'Array',
    schema: resolveReferencedSchema(schema, ref),
  }
}

function buildVirtualTraversalEntry(
  schema: NormalizationSchema,
  key: string,
  virtualType?: NormalizationVirtualType,
): TraversalEntry | null {
  const ref = virtualType?.options?.ref
  if (!ref) {
    return null
  }

  return {
    key,
    isArray: virtualType.options?.justOne !== true,
    schema: resolveReferencedSchema(schema, ref),
  }
}

function getSchemaTypeRef(schemaType: NormalizationSchemaType) {
  return (
    schemaType.options?.ref ??
    schemaType.embeddedSchemaType?.options?.ref ??
    schemaType.caster?.options?.ref
  )
}

function resolveReferencedSchema(
  schema: NormalizationSchema,
  ref: unknown,
): NormalizationSchema | undefined {
  const refName = resolveReferenceName(ref)
  if (!refName) {
    return undefined
  }

  const modelSchema = schema.base?.models?.[refName]?.schema
  return isSchemaLike(modelSchema) ? modelSchema : undefined
}

function resolveReferenceName(ref: unknown): string | undefined {
  if (typeof ref === 'string' && ref) {
    return ref
  }

  if (typeof ref === 'function') {
    try {
      const resolved = ref()
      if (typeof resolved === 'string' && resolved) {
        return resolved
      }
      if (
        resolved &&
        typeof resolved === 'object' &&
        'modelName' in resolved &&
        typeof resolved.modelName === 'string'
      ) {
        return resolved.modelName
      }
      if (
        resolved &&
        typeof resolved === 'object' &&
        'name' in resolved &&
        typeof resolved.name === 'string'
      ) {
        return resolved.name
      }
    } catch {
      // Ignore eager ref resolution failures and fall back to function metadata.
    }

    if (ref.name) {
      return ref.name
    }
  }

  if (
    ref &&
    typeof ref === 'object' &&
    'modelName' in ref &&
    typeof ref.modelName === 'string'
  ) {
    return ref.modelName
  }

  if (
    ref &&
    typeof ref === 'object' &&
    'name' in ref &&
    typeof ref.name === 'string'
  ) {
    return ref.name
  }

  return undefined
}

function resolveSchemaFromValue(
  value: unknown,
): NormalizationSchema | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return (
    asSchemaLike((value as any).schema) ??
    asSchemaLike((value as any).$__schema) ??
    asSchemaLike((value as any).constructor?.schema)
  )
}

function asSchemaLike(value: unknown): NormalizationSchema | undefined {
  return isSchemaLike(value) ? value : undefined
}

function isSchemaLike(value: unknown): value is NormalizationSchema {
  return (
    !!value &&
    typeof value === 'object' &&
    'paths' in value &&
    typeof (value as any).path === 'function'
  )
}

function isTopLevelSchemaPath(path: string) {
  return !path.includes('.')
}

function isObjectId(v: any) {
  if (v == null) {
    return false
  }
  const proto = Object.getPrototypeOf(v)
  if (
    proto == null ||
    proto.constructor == null ||
    proto.constructor.name !== 'ObjectId'
  ) {
    return false
  }
  return v._bsontype === 'ObjectId'
}
