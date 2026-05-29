import type { TSchema } from '@earendil-works/pi-ai'
import { Type } from '@earendil-works/pi-ai'
import { Logger } from '@nestjs/common'

const logger = new Logger('JsonSchemaToTypeBox')

const UNSUPPORTED_KEYWORDS = [
  '$ref',
  'oneOf',
  'anyOf',
  'allOf',
  'const',
  'format',
  'patternProperties',
] as const

export interface ConvertOptions {
  maxDepth?: number
  toolName?: string
}

interface JsonSchema {
  type?: string
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  enum?: unknown[]
  items?: JsonSchema
  additionalProperties?: boolean | JsonSchema
  [key: string]: unknown
}

export function convert(
  schema: JsonSchema,
  options: ConvertOptions = {},
): TSchema {
  return walk(schema, 0, options.maxDepth ?? 32, options.toolName)
}

function unsupported(schema: JsonSchema): string | undefined {
  for (const key of UNSUPPORTED_KEYWORDS) if (key in schema) return key
  return undefined
}

function fallback(
  schema: JsonSchema,
  reason: string,
  toolName?: string,
): TSchema {
  logger.warn(
    `${reason}${toolName ? ` (tool=${toolName})` : ''}; falling back to Type.Unsafe`,
  )
  return Type.Unsafe<unknown>({ ...schema } as TSchema)
}

function walk(
  schema: JsonSchema,
  depth: number,
  maxDepth: number,
  toolName?: string,
): TSchema {
  if (depth > maxDepth)
    return fallback(schema, `exceeds maxDepth=${maxDepth}`, toolName)
  const bad = unsupported(schema)
  if (bad) return fallback(schema, `keyword "${bad}" not supported`, toolName)

  const desc = schema.description ? { description: schema.description } : {}
  switch (schema.type) {
    case 'object': {
      const props: Record<string, TSchema> = {}
      const required = new Set(schema.required ?? [])
      for (const [key, value] of Object.entries(schema.properties ?? {})) {
        const inner = walk(value, depth + 1, maxDepth, toolName)
        props[key] = required.has(key) ? inner : Type.Optional(inner)
      }
      const additionalProperties =
        typeof schema.additionalProperties === 'boolean'
          ? schema.additionalProperties
          : false
      return Type.Object(props, { ...desc, additionalProperties })
    }
    case 'string': {
      if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        return Type.Union(
          schema.enum.map((v) => Type.Literal(v as string)),
          desc,
        )
      }
      return Type.String(desc)
    }
    case 'integer': {
      return Type.Integer(desc)
    }
    case 'number': {
      return Type.Number(desc)
    }
    case 'boolean': {
      return Type.Boolean(desc)
    }
    case 'array': {
      const items = schema.items
        ? walk(schema.items, depth + 1, maxDepth, toolName)
        : Type.Any()
      return Type.Array(items, desc)
    }
    default: {
      return fallback(
        schema,
        `type "${String(schema.type)}" not supported`,
        toolName,
      )
    }
  }
}

export function assertHaklexToolSchemasSupported(
  schemas: Array<{ name: string; parameters: JsonSchema }>,
): void {
  for (const { name, parameters } of schemas)
    convert(parameters, { toolName: name })
}

export { UNSUPPORTED_KEYWORDS }
