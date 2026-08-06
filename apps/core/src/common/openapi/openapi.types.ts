import type { z } from 'zod'

export type OpenApiMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface JsonSchema {
  [key: string]: unknown
}

export interface SchemaRef {
  name: string
  schema?: z.ZodType
  /** Escape hatch for shapes Zod cannot express, such as binary uploads. */
  json?: JsonSchema
}

export interface OpenApiRoute {
  operationId: string
  method: OpenApiMethod
  path: string
  tag: string
  summary: string
  auth: boolean
  params?: z.ZodType
  query?: z.ZodType
  body?: SchemaRef
  bodyContentType?: string
  response?: SchemaRef
  responseIsArray?: boolean
  /**
   * HTTP status the handler actually answers with. Nest defaults `@Post` to
   * 201, and a client generated against a 200-only contract treats the real
   * reply as undocumented and throws.
   */
  successStatus?: number
  /** Overrides the default `AppExceptionFilter` error shape. */
  errorResponse?: SchemaRef
  /**
   * better-auth routes are served by a Nest middleware that writes the reply
   * itself, so `ResponseInterceptor` never sees them — their bodies are raw,
   * not `{ data, meta }`.
   */
  envelope?: boolean
}

export interface OpenApiDocument {
  openapi: string
  info: { title: string; version: string; description: string }
  servers: { url: string; description: string }[]
  tags: { name: string }[]
  paths: Record<string, Record<string, unknown>>
  components: {
    schemas: Record<string, JsonSchema>
    securitySchemes: Record<string, unknown>
  }
}
