import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  isIdentifier,
  isNumericLiteral,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPropertyAssignment,
  isReturnStatement,
  isShorthandPropertyAssignment,
  isSpreadAssignment,
  isStringLiteral,
  ScriptKind,
} from 'tsrs/ast'
import type {
  Expression,
  Node,
  ObjectLiteralElementLike,
  PropertyName,
} from 'tsrs/ast'
import { API } from 'tsrs/sync'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const modulesDir = join(repoRoot, 'apps/core/src/modules')

const walk = (dir: string, files: string[] = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(file, files)
    } else if (entry.isFile() && entry.name.endsWith('controller.ts')) {
      files.push(file)
    }
  }
  return files
}

const nameOf = (name: PropertyName) => {
  if (isIdentifier(name) || isStringLiteral(name) || isNumericLiteral(name)) {
    return name.text
  }
}

const propertyName = (property: ObjectLiteralElementLike) => {
  if (isShorthandPropertyAssignment(property)) return nameOf(property.name)
  if (!isPropertyAssignment(property)) return undefined

  return nameOf(property.name)
}

const unwrapExpression = (expression: Expression): Expression => {
  let current = expression
  while (isParenthesizedExpression(current)) current = current.expression
  return current
}

const violations: string[] = []

const api = new API({ cwd: repoRoot })

try {
  for (const file of walk(modulesDir)) {
    const sourceText = readFileSync(file, 'utf8')
    const source = api.createSourceFile(file, sourceText, {
      scriptKind: ScriptKind.TS,
    }).sourceFile

    const visit = (node: Node) => {
      if (!isReturnStatement(node) || !node.expression) {
        node.forEachChild(visit)
        return
      }

      const expression = unwrapExpression(node.expression)
      if (!isObjectLiteralExpression(expression)) {
        node.forEachChild(visit)
        return
      }

      if (expression.properties.some(isSpreadAssignment)) {
        node.forEachChild(visit)
        return
      }

      const names = expression.properties.map(propertyName)
      const hasDataKey = names.includes('data')

      if (hasDataKey) {
        const { line, character } = source.getLineAndCharacterOfPosition(
          expression.getStart(source),
        )
        violations.push(
          `${relative(repoRoot, file)}:${line + 1}:${character + 1} return raw data directly, or use withMeta(data, meta) for response metadata. A literal containing a 'data' key will be double-wrapped by ResponseInterceptor.`,
        )
      }

      node.forEachChild(visit)
    }

    visit(source)
  }
} finally {
  api.close()
}

if (violations.length > 0) {
  console.error('Controller response envelope returns are not allowed:')
  for (const violation of violations) console.error(`  ${violation}`)
  process.exit(1)
}
