import { parse } from '@babel/parser'
import type * as t from '@babel/types'

export interface ParsedRouteMetadata {
  titleKey?: string
  descriptionKey?: string
  iconName?: string
  iconSource?: string
  order?: number
  matchPaths?: string[]
  hidden?: boolean
  /**
   * 显式标记此 route 为 nearest URL-prefix parent route 之 React Router child。
   * 默认 (false/未设)：仅尾段皆 dynamic-param 时方自动 nest（如 `/foo/:id`）。
   * 静态名子页（如 `/enrichment/probe` 之于 `/enrichment`）须 opt-in 方为 nested。
   */
  nested?: boolean
}

export interface ParsedSectionMeta {
  titleKey: string
  order: number
}

export class MetaParseError extends Error {
  constructor(
    message: string,
    public readonly file: string,
  ) {
    super(`${file}: ${message}`)
  }
}

function parseSource(source: string, file: string) {
  try {
    return parse(source, {
      sourceType: 'module',
      sourceFilename: file,
      plugins: ['typescript', 'jsx'],
    })
  } catch (error) {
    throw new MetaParseError(
      `failed to parse source: ${(error as Error).message}`,
      file,
    )
  }
}

function isStringLiteral(
  node: t.Node | null | undefined,
): node is t.StringLiteral {
  return !!node && node.type === 'StringLiteral'
}

function isNumericLiteral(
  node: t.Node | null | undefined,
): node is t.NumericLiteral {
  return !!node && node.type === 'NumericLiteral'
}

function isBooleanLiteral(
  node: t.Node | null | undefined,
): node is t.BooleanLiteral {
  return !!node && node.type === 'BooleanLiteral'
}

function readStringArray(node: t.Node, file: string, field: string): string[] {
  if (node.type !== 'ArrayExpression') {
    throw new MetaParseError(`${field} must be an array literal`, file)
  }
  return node.elements.map((el) => {
    if (!isStringLiteral(el)) {
      throw new MetaParseError(`${field} must contain string literals`, file)
    }
    return el.value
  })
}

function findMetadataCall(
  ast: t.File,
  file: string,
): t.ObjectExpression | null {
  for (const node of ast.program.body) {
    if (node.type !== 'ExportNamedDeclaration') continue
    if (!node.declaration || node.declaration.type !== 'VariableDeclaration') {
      continue
    }
    for (const decl of node.declaration.declarations) {
      if (decl.id.type !== 'Identifier' || decl.id.name !== 'metadata') {
        continue
      }
      const init = decl.init
      if (!init) continue
      if (init.type === 'CallExpression') {
        if (
          init.callee.type !== 'Identifier' ||
          init.callee.name !== 'defineMetadata'
        ) {
          throw new MetaParseError(
            `metadata must be initialised with defineMetadata(...)`,
            file,
          )
        }
        const arg = init.arguments[0]
        if (!arg || arg.type !== 'ObjectExpression') {
          throw new MetaParseError(
            `defineMetadata() must receive an object literal`,
            file,
          )
        }
        return arg
      }
      throw new MetaParseError(
        `metadata must be initialised with defineMetadata(...)`,
        file,
      )
    }
  }
  return null
}

interface IconImport {
  name: string
  source: string
}

function collectIconImports(ast: t.File): Map<string, IconImport> {
  const imports = new Map<string, IconImport>()
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue
    const source = node.source.value
    for (const spec of node.specifiers) {
      if (spec.type !== 'ImportSpecifier') continue
      const local = spec.local.name
      const imported =
        spec.imported.type === 'Identifier'
          ? spec.imported.name
          : spec.imported.value
      imports.set(local, { name: imported, source })
    }
  }
  return imports
}

export function parsePageMetadata(
  source: string,
  file: string,
): ParsedRouteMetadata | null {
  const ast = parseSource(source, file)
  const obj = findMetadataCall(ast, file)
  if (!obj) return null
  const icons = collectIconImports(ast)
  const result: ParsedRouteMetadata = {}

  for (const prop of obj.properties) {
    if (prop.type !== 'ObjectProperty') {
      throw new MetaParseError(
        `metadata may only contain plain key-value entries`,
        file,
      )
    }
    if (prop.computed) {
      throw new MetaParseError(`metadata keys must not be computed`, file)
    }
    const keyName =
      prop.key.type === 'Identifier'
        ? prop.key.name
        : prop.key.type === 'StringLiteral'
          ? prop.key.value
          : null
    if (!keyName) {
      throw new MetaParseError(`unrecognised metadata key`, file)
    }
    const value = prop.value as t.Node
    switch (keyName) {
      case 'titleKey': {
        if (!isStringLiteral(value)) {
          throw new MetaParseError(`titleKey must be a string literal`, file)
        }
        result.titleKey = value.value
        break
      }
      case 'descriptionKey': {
        if (!isStringLiteral(value)) {
          throw new MetaParseError(
            `descriptionKey must be a string literal`,
            file,
          )
        }
        result.descriptionKey = value.value
        break
      }
      case 'icon': {
        if (value.type !== 'Identifier') {
          throw new MetaParseError(
            `icon must reference an imported identifier`,
            file,
          )
        }
        const imp = icons.get(value.name)
        if (!imp) {
          throw new MetaParseError(`icon "${value.name}" is not imported`, file)
        }
        if (imp.source !== 'lucide-react') {
          throw new MetaParseError(
            `icon must come from lucide-react (got "${imp.source}")`,
            file,
          )
        }
        result.iconName = imp.name
        result.iconSource = imp.source
        break
      }
      case 'order': {
        if (!isNumericLiteral(value)) {
          throw new MetaParseError(`order must be a number literal`, file)
        }
        result.order = value.value
        break
      }
      case 'matchPaths': {
        result.matchPaths = readStringArray(value, file, 'matchPaths')
        break
      }
      case 'hidden': {
        if (!isBooleanLiteral(value)) {
          throw new MetaParseError(`hidden must be a boolean literal`, file)
        }
        result.hidden = value.value
        break
      }
      case 'nested': {
        if (!isBooleanLiteral(value)) {
          throw new MetaParseError(`nested must be a boolean literal`, file)
        }
        result.nested = value.value
        break
      }
      default: {
        throw new MetaParseError(`unknown metadata key "${keyName}"`, file)
      }
    }
  }

  return result
}

export function parseSectionMeta(
  source: string,
  file: string,
): ParsedSectionMeta {
  const ast = parseSource(source, file)
  let obj: t.ObjectExpression | null = null
  for (const node of ast.program.body) {
    if (node.type !== 'ExportDefaultDeclaration') continue
    const decl = node.declaration
    if (decl.type === 'ObjectExpression') {
      obj = decl
      break
    }
    if (
      (decl.type === 'TSAsExpression' ||
        decl.type === 'TSSatisfiesExpression') &&
      decl.expression.type === 'ObjectExpression'
    ) {
      obj = decl.expression
      break
    }
  }
  if (!obj) {
    throw new MetaParseError(
      `meta.ts must have a default export of an object literal`,
      file,
    )
  }
  const result: Partial<ParsedSectionMeta> = {}
  for (const prop of obj.properties) {
    if (prop.type !== 'ObjectProperty' || prop.computed) {
      throw new MetaParseError(
        `meta.ts may only contain plain key-value entries`,
        file,
      )
    }
    const keyName =
      prop.key.type === 'Identifier'
        ? prop.key.name
        : prop.key.type === 'StringLiteral'
          ? prop.key.value
          : null
    const value = prop.value as t.Node
    if (keyName === 'titleKey') {
      if (!isStringLiteral(value)) {
        throw new MetaParseError(`titleKey must be a string literal`, file)
      }
      result.titleKey = value.value
    } else if (keyName === 'order') {
      if (!isNumericLiteral(value)) {
        throw new MetaParseError(`order must be a number literal`, file)
      }
      result.order = value.value
    } else if (keyName !== null) {
      // ignore unknown keys
    }
  }
  if (!result.titleKey) {
    throw new MetaParseError(`meta.ts is missing titleKey`, file)
  }
  if (result.order === undefined) {
    throw new MetaParseError(`meta.ts is missing order`, file)
  }
  return result as ParsedSectionMeta
}
