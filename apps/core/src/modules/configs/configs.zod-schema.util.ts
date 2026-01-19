import { z } from 'zod'

/**
 * UI Options for JSON Schema form rendering
 */
export interface UIOptions {
  type?: 'password' | 'textarea' | 'select' | 'hidden'
  halfGrid?: boolean
  hide?: boolean
  connect?: boolean
  values?: Array<{ label: string; value: string }>
}

/**
 * Schema metadata for JSON Schema generation
 */
export interface SchemaMetadata {
  title?: string
  description?: string
  'ui:options'?: UIOptions
}

// Symbol to store metadata on Zod schemas
const SCHEMA_META = Symbol('schemaMeta')

/**
 * Extend a Zod schema with JSON Schema metadata
 */
export function withMeta<T extends z.ZodTypeAny>(
  schema: T,
  meta: SchemaMetadata,
): T {
  const extended = schema as T & { [SCHEMA_META]?: SchemaMetadata }
  extended[SCHEMA_META] = { ...extended[SCHEMA_META], ...meta }
  return extended
}

/**
 * Get metadata from a Zod schema
 */
export function getMeta(schema: z.ZodTypeAny): SchemaMetadata | undefined {
  return (schema as any)[SCHEMA_META]
}

/**
 * Helper functions for common field types
 */
export const field = {
  plain: <T extends z.ZodTypeAny>(
    schema: T,
    title: string,
    options?: Omit<SchemaMetadata, 'title'>,
  ) => withMeta(schema, { title, ...options }),

  halfGrid: <T extends z.ZodTypeAny>(
    schema: T,
    title: string,
    options?: Omit<SchemaMetadata, 'title' | 'ui:options'>,
  ) =>
    withMeta(schema, {
      title,
      ...options,
      'ui:options': { halfGrid: true },
    }),

  password: <T extends z.ZodTypeAny>(
    schema: T,
    title: string,
    options?: Omit<SchemaMetadata, 'title'>,
  ) =>
    withMeta(schema, {
      title,
      ...options,
      'ui:options': { type: 'password', ...options?.['ui:options'] },
    }),

  passwordHalfGrid: <T extends z.ZodTypeAny>(
    schema: T,
    title: string,
    options?: Omit<SchemaMetadata, 'title'>,
  ) =>
    withMeta(schema, {
      title,
      ...options,
      'ui:options': {
        type: 'password',
        halfGrid: true,
        ...options?.['ui:options'],
      },
    }),

  toggle: <T extends z.ZodTypeAny>(
    schema: T,
    title: string,
    options?: Omit<SchemaMetadata, 'title'>,
  ) => withMeta(schema, { title, ...options }),

  array: <T extends z.ZodTypeAny>(
    schema: T,
    title: string,
    options?: Omit<SchemaMetadata, 'title'>,
  ) => withMeta(schema, { title, ...options }),

  number: <T extends z.ZodTypeAny>(
    schema: T,
    title: string,
    options?: Omit<SchemaMetadata, 'title'>,
  ) => withMeta(schema, { title, ...options }),

  textarea: <T extends z.ZodTypeAny>(
    schema: T,
    title: string,
    options?: Omit<SchemaMetadata, 'title'>,
  ) =>
    withMeta(schema, {
      title,
      ...options,
      'ui:options': { type: 'textarea', ...options?.['ui:options'] },
    }),

  select: <T extends z.ZodTypeAny>(
    schema: T,
    title: string,
    values: Array<{ label: string; value: string }>,
    options?: Omit<SchemaMetadata, 'title'>,
  ) =>
    withMeta(schema, {
      title,
      ...options,
      'ui:options': { type: 'select', values, ...options?.['ui:options'] },
    }),

  hidden: <T extends z.ZodTypeAny>(schema: T, title?: string) =>
    withMeta(schema, {
      title,
      'ui:options': { type: 'hidden' },
    }),
}

/**
 * Mark a section/object schema with title
 */
export function section<T extends z.ZodRawShape>(
  title: string,
  shape: T,
  options?: Omit<SchemaMetadata, 'title'>,
): z.ZodObject<T> {
  const schema = z.object(shape)
  return withMeta(schema, { title, ...options })
}
