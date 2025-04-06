// const fs = require('fs')
// const path = require('path')
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import ts from 'typescript'

function generateGenericEventType(fileName) {
  const program = ts.createProgram([fileName], {})
  const sourceFile = program.getSourceFile(fileName)

  let genericEventType = '// Auto Generaged type.\nexport type GenericEvent =\n'

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isInterfaceDeclaration(node) &&
      node.name.text === 'EventPayloadMapping'
    ) {
      node.members.forEach((member) => {
        if (ts.isPropertySignature(member) && member.type) {
          const key = member.name
          let eventType = ''
          let isLiteralType = false

          if (
            ts.isComputedPropertyName(key) &&
            ts.isPropertyAccessExpression(key.expression)
          ) {
            eventType = key.expression.name.text
          } else if (ts.isIdentifier(key) && key.escapedText) {
            // Handle string key like 'health_check'
            eventType = key.escapedText
            isLiteralType = true
          } else if (ts.isStringLiteral(key)) {
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
  const sourceFile = ts.createSourceFile(
    fileName,
    fileContent,
    ts.ScriptTarget.Latest,
    true,
  )
  let startPos = -1
  let endPos = -1
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === 'GenericEvent') {
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
  fs.writeFileSync(
    path.resolve(__dirname, '../src/types.ts'),
    await prettier.format(newFileContent, {
      parser: 'typescript',
      semi: false,
      tabWidth: 2,
      printWidth: 80,
      singleQuote: true,
      trailingComma: 'all',
    }),
  )
}

main()
