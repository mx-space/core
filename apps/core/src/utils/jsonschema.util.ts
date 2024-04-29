// @ts-ignore
import { defaultMetadataStorage } from 'class-transformer/cjs/storage.js'
import { ValidationTypes, getMetadataStorage } from 'class-validator'
import { targetConstructorToSchema } from 'class-validator-jsonschema'
import type { ISchemaConverters } from 'class-validator-jsonschema/build/defaultConverters'
import type { IOptions } from 'class-validator-jsonschema/build/options'
import type { ValidationMetadata } from 'class-validator/types/metadata/ValidationMetadata'

export { JSONSchema as IsSchema } from 'class-validator-jsonschema'

/**
 * Build json-schema from `class-validator` & `class-tranformer` metadata.
 *
 * @see https://github.com/epiphone/class-validator-jsonschema
 */
export function classToJsonSchema(clz: any) {
  const options: Partial<Options> = { ...defaultOptions, definitions: {} }
  const schema = targetConstructorToSchema(clz, options) as any

  schema.definitions = options.definitions

  return schema
}

function nestedClassToJsonSchema(clz: any, options: Partial<Options>) {
  return targetConstructorToSchema(clz, options) as any
}

const additionalConverters: ISchemaConverters = {
  /**
   * Explicitly inline nested schemas instead of using refs
   *
   * @see https://github.com/epiphone/class-validator-jsonschema/blob/766c02dd0de188ebeb697f3296982997249bffc9/src/defaultConverters.ts#L25
   */
  [ValidationTypes.NESTED_VALIDATION]: (
    meta: ValidationMetadata,
    options: Options,
  ) => {
    if (typeof meta.target === 'function') {
      const typeMeta = options.classTransformerMetadataStorage
        ? options.classTransformerMetadataStorage.findTypeMetadata(
            meta.target,
            meta.propertyName,
          )
        : null

      const childType = typeMeta
        ? typeMeta.typeFunction()
        : getPropType(meta.target.prototype, meta.propertyName)

      const schema = targetToSchema(childType, options)

      if (schema.$ref && !options.definitions[childType.name]) {
        options.definitions[childType.name] = nestedClassToJsonSchema(
          childType,
          options,
        )
      }

      return schema
    }
  },
}

type Options = IOptions & {
  definitions: Record<string, any>
}

const defaultOptions: Partial<Options> = {
  classTransformerMetadataStorage: defaultMetadataStorage,
  classValidatorMetadataStorage: getMetadataStorage(),
  additionalConverters,
  doNotExcludeDecorator: true,
}

function getPropType(target: object, property: string) {
  return Reflect.getMetadata('design:type', target, property)
}

function targetToSchema(type: any, options: IOptions): any | void {
  if (typeof type === 'function') {
    if (
      type.prototype === String.prototype ||
      type.prototype === Symbol.prototype
    ) {
      return { type: 'string' }
    } else if (type.prototype === Number.prototype) {
      return { type: 'number' }
    } else if (type.prototype === Boolean.prototype) {
      return { type: 'boolean' }
    }

    return { $ref: options.refPointerPrefix + type.name }
  }
}
