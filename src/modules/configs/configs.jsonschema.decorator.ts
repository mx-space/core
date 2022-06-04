import { JSONSchema } from 'class-validator-jsonschema'
import { DecoratorSchema } from 'class-validator-jsonschema/build/decorators'

export const halfFieldOption = {
  'ui:options': { halfGrid: true },
}

export const JSONSchemaPasswordField = (
  title: string,
  schema?: DecoratorSchema,
) => {
  return JSONSchema({
    title,
    ...schema,
    'ui:options': { showPassword: true, ...schema?.['ui:options'] },
  })
}

export const JSONSchemaPlainField = (title: string, schema?: DecoratorSchema) =>
  JSONSchema({
    title,
    ...schema,
  })

export const JSONSchemaHalfGirdPlainField: typeof JSONSchemaPlainField = (
  ...rest
) => JSONSchemaPlainField.call(null, ...rest, halfFieldOption)

export const JSONSchemaArrayField = (title: string, schema?: DecoratorSchema) =>
  JSONSchema({
    title,
    // 'ui:options': {},
    ...schema,
  })

export const JSONSchemaToggleField = (
  title: string,
  schema?: DecoratorSchema,
) =>
  JSONSchema({
    title,
    // 'ui:options': {},
    ...schema,
  })

export const JSONSchemaNumberField = (
  title: string,
  schema?: DecoratorSchema,
) =>
  JSONSchema({
    title,
    // 'ui:options': {},
    ...schema,
  })
