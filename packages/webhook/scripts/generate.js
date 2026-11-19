// const fs = require('fs')
// const path = require('path')
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import prettier from 'prettier'
import {
  isComputedPropertyName,
  isIdentifier,
  isInterfaceDeclaration,
  isPropertyAccessExpression,
  isPropertySignatureDeclaration,
  isStringLiteral,
  isTypeAliasDeclaration,
  ScriptKind,
} from 'tsrs/ast'
import { API } from 'tsrs/sync'

const api = new API({ cwd: process.cwd() })

function parseSourceFile(fileName) {
  const content = fs.readFileSync(fileName, 'utf8')
  return api.createSourceFile(fileName, content, {
    scriptKind: ScriptKind.TS,
  }).sourceFile
}

function generateGenericEventType(fileName) {
  const sourceFile = parseSourceFile(fileName)

  let genericEventType = '// Auto Generaged type.\nexport type GenericEvent =\n'

  sourceFile.forEachChild((node) => {
    if (
      isInterfaceDeclaration(node) &&
      node.name.text === 'EventPayloadMapping'
    ) {
      node.members.forEach((member) => {
        if (isPropertySignatureDeclaration(member) && member.type) {
          const key = member.name
          let eventType = ''
          let isLiteralType = false

          if (
            isComputedPropertyName(key) &&
            isPropertyAccessExpression(key.expression)
          ) {
            eventType = key.expression.name.text
          } else if (isIdentifier(key) && key.text) {
            // Handle string key like 'health_check'
            eventType = key.text
            isLiteralType = true
          } else if (isStringLiteral(key)) {
            // Handle string literal types like 'health-check'
            eventType = key.text
            isLiteralType = true
          }

          // if (eventType && eventType !== '*') {
          //   const payloadType = member.type.getText(sourceFile)
          //   genericEventType += `  | { type: BusinessEvents.${eventType}; payload: ${payloadType} }\n`
          // }
          if (eventType) {
            const payloadType = member.type.getText(sourceFile)
            if (isLiteralType) {
              // For string literals, use the literal value directly
              genericEventType += `  | { type: '${eventType}'; payload: ${payloadType} }\n`
            } else {
              // For regular event types
              genericEventType += `  | { type: BusinessEvents.${eventType}; payload: ${payloadType} }\n`
            }
          }
        }
      })
    }
  })

  return genericEventType
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const fileName = path.resolve(__dirname, '../src/types.ts')
const newGenericEventType = generateGenericEventType(fileName)

function replaceGenericEventType(fileName, newGenericEventType) {
  const fileContent = fs.readFileSync(fileName, 'utf8')
  const sourceFile = api.createSourceFile(fileName, fileContent, {
    scriptKind: ScriptKind.TS,
  }).sourceFile
  let startPos = -1
  let endPos = -1
  sourceFile.forEachChild((node) => {
    if (isTypeAliasDeclaration(node) && node.name.text === 'GenericEvent') {
      startPos = node.pos
      endPos = node.end
    }
  })
  if (startPos === -1 || endPos === -1) {
    throw new Error('GenericEvent type not found in the file.')
  }

  // Replace the specified part of the file content with the new type string
  return `${fileContent.slice(0, startPos)}\n\n${
    // Add a new line before the new type
    newGenericEventType
  }${fileContent.slice(endPos)}\n`
}
// const newFileContent = replaceGenericEventType(fileName, newGenericEventType)
const newFileContent = replaceGenericEventType(fileName, newGenericEventType)

async function main() {
  const outputPath = path.resolve(__dirname, '../src/types.ts')
  const formatted = await prettier.format(newFileContent, {
    parser: 'typescript',
    semi: false,
    tabWidth: 2,
    printWidth: 80,
    singleQuote: true,
    trailingComma: 'all',
  })

  if (process.argv.includes('--check')) {
    if (fs.readFileSync(outputPath, 'utf8') !== formatted) {
      console.error(
        '[generate] GenericEvent is stale. Run `node scripts/generate.js`.',
      )
      process.exitCode = 1
      return
    }
    console.log(`✓ GenericEvent is current: ${outputPath}`)
    return
  }

  fs.writeFileSync(outputPath, formatted)
}

main().finally(() => api.close())
