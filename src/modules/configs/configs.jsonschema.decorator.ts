import { JSONSchema } from 'class-validator-jsonschema'
import { DecoratorSchema } from 'class-validator-jsonschema/build/decorators'

export const JSONSchemaPasswordField = (
  title: string,
  schema?: DecoratorSchema,
): PropertyDecorator =>
  JSONSchema({
    title,
    'ui:options': { showPassword: true },
    ...schema,
  })

export const JSONSchemaPlainField = (
  title: string,
  schema?: DecoratorSchema,
): PropertyDecorator =>
  JSONSchema({
    title,
    // 'ui:options': {},
    ...schema,
  })

export const JSONSchemaArrayField = (
  title: string,
  schema?: DecoratorSchema,
): PropertyDecorator =>
  JSONSchema({
    title,
    // 'ui:options': {},
    ...schema,
  })

export const JSONSchemaToggleField = (
  title: string,
  schema?: DecoratorSchema,
): PropertyDecorator =>
  JSONSchema({
    title,
    // 'ui:options': {},
    ...schema,
  })

export const JSONSchemaNumberField = (
  title: string,
  schema?: DecoratorSchema,
): PropertyDecorator =>
  JSONSchema({
    title,
    // 'ui:options': {},
    ...schema,
  })
