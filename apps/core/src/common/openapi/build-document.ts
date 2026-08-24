import { z } from 'zod'

import { snakeKey } from '~/common/response/case-transform'

import type {
  JsonSchema,
  OpenApiDocument,
  OpenApiRoute,
  SchemaRef,
} from './openapi.types'

const ERROR_COMPONENT = 'ErrorEnvelope'
const META_COMPONENT = 'ResponseMeta'

const toJsonSchema = (
  schema: z.ZodType,
  io: 'input' | 'output',
): JsonSchema => {
  const { $schema, ...json } = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    unrepresentable: 'any',
    io,
    // Schemas carrying a registered `id` are lifted into `$defs` and referenced,
    // which `hoistDefs` then turns into shared OpenAPI components.
    metadata: z.globalRegistry,
    override: (ctx) => {
      const def = ctx.zodSchema._zod.def as { type?: string }
      if (def.type === 'date') {
        ctx.jsonSchema.type = 'string'
        ctx.jsonSchema.format = 'date-time'
      }
      if (def.type === 'bigint') {
        ctx.jsonSchema.type = 'string'
      }
    },
  })
  return normalizeSchema(json).json as JsonSchema
}

const SCHEMA_BRANCHES = ['anyOf', 'oneOf', 'allOf'] as const

const isNullSchema = (node: unknown) =>
  typeof node === 'object' &&
  node !== null &&
  (node as JsonSchema).type === 'null'

const isPlainString = (node: unknown) => {
  if (typeof node !== 'object' || node === null) return false
  const schema = node as JsonSchema
  return (
    schema.type === 'string' &&
    Object.keys(schema).every((key) => key === 'type' || key === 'format')
  )
}

/**
 * `z.date().or(z.string())` is a serialization tolerance, not two wire shapes —
 * both branches land as strings. Collapsing them keeps swift-openapi-generator
 * from emitting an `anyOf` payload wrapper the call sites would have to unwrap.
 */
const mergeStringBranches = (members: unknown[]) => {
  if (members.length < 2 || !members.every(isPlainString)) return members
  const formats = new Set(
    members
      .map((member) => (member as JsonSchema).format)
      .filter((format): format is string => typeof format === 'string'),
  )
  const merged: JsonSchema = { type: 'string' }
  if (formats.size === 1) merged.format = [...formats][0]
  return [merged]
}

interface NormalizedSchema {
  json: unknown
  nullable: boolean
}

/**
 * swift-openapi-generator cannot represent `anyOf: [X, { type: 'null' }]` and
 * silently drops the whole property, so nullability is folded into optionality
 * (the field leaves `required`) before the document is emitted.
 */
const normalizeSchema = (node: unknown): NormalizedSchema => {
  if (Array.isArray(node)) {
    return {
      json: node.map((item) => normalizeSchema(item).json),
      nullable: false,
    }
  }
  if (node === null || typeof node !== 'object') {
    return { json: node, nullable: false }
  }

  const source = node as JsonSchema
  let result: JsonSchema = { ...source }
  let nullable = false

  for (const branch of SCHEMA_BRANCHES) {
    const members = source[branch]
    if (!Array.isArray(members)) continue

    const normalized = members.map((member) => normalizeSchema(member).json)
    const kept = normalized.filter((member) => !isNullSchema(member))
    if (kept.length !== normalized.length) nullable = true

    const collapsed = branch === 'allOf' ? kept : mergeStringBranches(kept)
    if (collapsed.length === 1 && branch !== 'allOf') {
      const { [branch]: _dropped, ...rest } = result
      result = { ...rest, ...(collapsed[0] as JsonSchema) }
    } else if (collapsed.length === 0) {
      const { [branch]: _dropped, ...rest } = result
      result = rest
    } else {
      result[branch] = collapsed
    }
  }

  const properties = result.properties as Record<string, unknown> | undefined
  if (properties) {
    const required = new Set((result.required ?? []) as string[])
    result.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => {
        const child = normalizeSchema(value)
        if (child.nullable) required.delete(key)
        return [key, child.json]
      }),
    )
    if (result.required) result.required = [...required]
  }
  if (result.items) result.items = normalizeSchema(result.items).json
  if (typeof result.additionalProperties === 'object') {
    result.additionalProperties = normalizeSchema(
      result.additionalProperties,
    ).json
  }
  if (result.$defs) {
    result.$defs = Object.fromEntries(
      Object.entries(result.$defs as Record<string, unknown>).map(
        ([key, value]) => [key, normalizeSchema(value).json],
      ),
    )
  }

  return { json: result, nullable }
}

/**
 * `ResponseInterceptor` snake-cases the whole `data` subtree on the way out,
 * so the generated contract must describe the wire, not the TS property names.
 */
const snakeCaseSchema = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(snakeCaseSchema)
  if (node === null || typeof node !== 'object') return node

  const source = node as JsonSchema
  const result: JsonSchema = { ...source }

  const properties = source.properties as Record<string, unknown> | undefined
  if (properties) {
    result.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        snakeKey(key),
        snakeCaseSchema(value),
      ]),
    )
  }
  if (Array.isArray(source.required)) {
    result.required = (source.required as string[]).map(snakeKey)
  }
  if (source.items) result.items = snakeCaseSchema(source.items)
  if (typeof source.additionalProperties === 'object') {
    result.additionalProperties = snakeCaseSchema(source.additionalProperties)
  }
  for (const branch of SCHEMA_BRANCHES) {
    if (Array.isArray(source[branch])) {
      result[branch] = (source[branch] as unknown[]).map(snakeCaseSchema)
    }
  }
  if (source.$defs) {
    result.$defs = Object.fromEntries(
      Object.entries(source.$defs as Record<string, unknown>).map(
        ([key, value]) => [key, snakeCaseSchema(value)],
      ),
    )
  }

  return result
}

const DEFS_PREFIX = '#/$defs/'
const COMPONENTS_PREFIX = '#/components/schemas/'

const rewriteRefs = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(rewriteRefs)
  if (node === null || typeof node !== 'object') return node

  const source = node as JsonSchema
  const result: JsonSchema = {}
  for (const [key, value] of Object.entries(source)) {
    result[key] =
      key === '$ref' &&
      typeof value === 'string' &&
      value.startsWith(DEFS_PREFIX)
        ? `${COMPONENTS_PREFIX}${value.slice(DEFS_PREFIX.length)}`
        : rewriteRefs(value)
  }
  return result
}

interface HoistedSchema {
  json: JsonSchema
  defs: Record<string, JsonSchema>
}

/** Lifts `$defs` produced by registered schema ids into shared components. */
const hoistDefs = (json: JsonSchema): HoistedSchema => {
  const { $defs, ...rest } = json
  const defs = Object.fromEntries(
    Object.entries(($defs ?? {}) as Record<string, JsonSchema>).map(
      ([name, value]) => [name, rewriteRefs(value) as JsonSchema],
    ),
  )
  return { json: rewriteRefs(rest) as JsonSchema, defs }
}

const templatePath = (path: string) =>
  path.replaceAll(/:(\w+)/g, (_, name: string) => `{${snakeKey(name)}}`)

const toParameters = (
  schema: z.ZodType | undefined,
  location: 'path' | 'query',
) => {
  if (!schema) return []
  const json = toJsonSchema(schema, 'input')
  const properties = (json.properties ?? {}) as Record<string, JsonSchema>
  const required = new Set((json.required ?? []) as string[])

  return Object.entries(properties).map(([name, propertySchema]) => ({
    name: snakeKey(name),
    in: location,
    required: location === 'path' ? true : required.has(name),
    schema: propertySchema,
  }))
}

const isUnconstrainedObject = (json: JsonSchema) => {
  const properties = json.properties as Record<string, unknown> | undefined
  return json.type === 'object' && Object.keys(properties ?? {}).length === 0
}

export interface BuildResult {
  document: OpenApiDocument
  /** Operations whose response schema carries no field information. */
  untypedOperations: string[]
}

export const buildOpenApiDocument = (
  routes: readonly OpenApiRoute[],
  apiVersion: number,
): BuildResult => {
  const schemas: Record<string, JsonSchema> = {
    [META_COMPONENT]: { type: 'object', additionalProperties: true },
    [ERROR_COMPONENT]: {
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }
  const untypedOperations: string[] = []

  const register = (ref: SchemaRef, io: 'input' | 'output') => {
    if (!ref.json && !ref.schema) {
      throw new Error(`schema ref "${ref.name}" has neither schema nor json`)
    }
    const converted = ref.json ?? toJsonSchema(ref.schema!, io)
    const cased =
      io === 'output' ? (snakeCaseSchema(converted) as JsonSchema) : converted
    const { json: root, defs } = hoistDefs(cased)

    for (const [name, value] of Object.entries(defs)) put(name, value)

    // A schema that is itself registered converts to a bare `$ref`; reuse the
    // hoisted component rather than emitting an alias that points at it.
    const aliased =
      typeof root.$ref === 'string' && Object.keys(root).length === 1
        ? (root.$ref as string).slice(COMPONENTS_PREFIX.length)
        : null
    if (aliased && schemas[aliased]) {
      return { $ref: `${COMPONENTS_PREFIX}${aliased}`, json: schemas[aliased] }
    }

    put(ref.name, root)
    return { $ref: `${COMPONENTS_PREFIX}${ref.name}`, json: root }
  }

  function put(name: string, json: JsonSchema) {
    const existing = schemas[name]
    if (existing && JSON.stringify(existing) !== JSON.stringify(json)) {
      throw new Error(
        `component name "${name}" is reused for two different schemas`,
      )
    }
    schemas[name] = json
  }

  const paths: OpenApiDocument['paths'] = {}
  const seenOperationIds = new Set<string>()

  for (const route of routes) {
    if (seenOperationIds.has(route.operationId)) {
      throw new Error(`duplicate operationId "${route.operationId}"`)
    }
    seenOperationIds.add(route.operationId)

    const operation: Record<string, unknown> = {
      operationId: route.operationId,
      summary: route.summary,
      tags: [route.tag],
      parameters: [
        ...toParameters(route.params, 'path'),
        ...toParameters(route.query, 'query'),
      ],
    }

    if (route.auth) operation.security = [{ bearerAuth: [] }]

    if (route.body) {
      const { $ref } = register(route.body, 'input')
      operation.requestBody = {
        required: true,
        content: {
          [route.bodyContentType ?? 'application/json']: { schema: { $ref } },
        },
      }
    }

    const errorRef = route.errorResponse
      ? register(route.errorResponse, 'output').$ref
      : `#/components/schemas/${ERROR_COMPONENT}`
    const errorResponse = {
      description: 'Error',
      content: { 'application/json': { schema: { $ref: errorRef } } },
    }
    const responses: Record<string, unknown> = {
      '4XX': errorResponse,
      '5XX': errorResponse,
    }

    if (route.response) {
      const { $ref, json } = register(route.response, 'output')
      if (isUnconstrainedObject(json)) untypedOperations.push(route.operationId)

      const payload = route.responseIsArray
        ? { type: 'array', items: { $ref } }
        : { $ref }
      const raw = route.envelope === false
      responses[String(route.successStatus ?? 200)] = {
        description: 'OK',
        content: {
          'application/json': {
            schema: raw
              ? payload
              : {
                  type: 'object',
                  required: ['data'],
                  properties: {
                    data: payload,
                    meta: { $ref: `#/components/schemas/${META_COMPONENT}` },
                  },
                },
          },
        },
      }
    } else {
      responses['204'] = { description: 'No Content' }
    }

    operation.responses = responses

    const key = templatePath(route.path)
    paths[key] ??= {}
    paths[key][route.method] = operation
  }

  const tags = [...new Set(routes.map((route) => route.tag))]
    .sort()
    .map((name) => ({ name }))

  return {
    document: {
      openapi: '3.1.0',
      info: {
        title: 'Mix Space Core API',
        version: `v${apiVersion}`,
        description:
          'Endpoints consumed by the Space iOS client. Generated from Zod schemas — do not edit by hand.',
      },
      servers: [
        {
          url: `/api/v${apiVersion}`,
          description: 'Self-hosted instance, relative to the configured host',
        },
      ],
      tags,
      paths,
      components: {
        schemas,
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
    },
    untypedOperations,
  }
}
