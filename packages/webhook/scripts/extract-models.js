import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import prettier from 'prettier'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const coreRoot = path.resolve(__dirname, '../../../apps/core/src')

// Local import alias → canonical name in generated file
const importAliases = {
  Category: 'CategoryModel',
  Count: 'CountModel',
}

// Sources to extract, in dependency order
const sources = [
  {
    file: 'constants/business-event.constant.ts',
    enums: ['BusinessEvents', 'EventScope'],
  },
  {
    file: 'shared/types/content-format.type.ts',
    enums: ['ContentFormat'],
  },
  {
    file: 'constants/db.constant.ts',
    enums: ['CollectionRefTypes'],
  },
  {
    file: 'shared/model/image.model.ts',
    classes: ['ImageModel'],
  },
  {
    file: 'shared/model/count.model.ts',
    classes: ['CountModel'],
  },
  {
    file: 'shared/model/base.model.ts',
    classes: ['BaseModel'],
  },
  {
    file: 'shared/model/base-comment.model.ts',
    classes: ['BaseCommentIndexModel'],
  },
  {
    file: 'shared/model/write-base.model.ts',
    classes: ['WriteBaseModel'],
  },
  {
    file: 'modules/note/models/coordinate.model.ts',
    classes: ['Coordinate'],
  },
  {
    file: 'modules/comment/comment.model.ts',
    enums: ['CommentState', 'CommentAnchorMode'],
    classes: ['CommentAnchorModel', 'CommentModel'],
  },
  {
    file: 'modules/category/category.model.ts',
    enums: ['CategoryType'],
    classes: ['CategoryModel'],
  },
  {
    file: 'modules/topic/topic.model.ts',
    classes: ['TopicModel'],
  },
  {
    file: 'modules/link/link.model.ts',
    enums: ['LinkType', 'LinkState'],
    classes: ['LinkModel'],
  },
  {
    file: 'modules/note/note.model.ts',
    classes: ['NoteModel'],
  },
  {
    file: 'modules/page/page.model.ts',
    classes: ['PageModel'],
  },
  {
    file: 'modules/post/post.model.ts',
    classes: ['PostModel'],
  },
  {
    file: 'modules/recently/recently.model.ts',
    types: ['RefType'],
    classes: ['RecentlyModel'],
  },
  {
    file: 'modules/say/say.model.ts',
    classes: ['SayModel'],
  },
  {
    file: 'modules/reader/reader.model.ts',
    classes: ['ReaderModel'],
  },
  {
    file: 'modules/note/note.type.ts',
    types: ['NormalizedNote'],
  },
  {
    file: 'modules/post/post.type.ts',
    types: ['NormalizedPost'],
  },
]

function transformType(typeText) {
  let result = typeText
  result = result.replaceAll(/Ref<[^>]+>/g, 'string')
  result = result.replaceAll('Types.ObjectId', 'string')
  for (const [alias, canonical] of Object.entries(importAliases)) {
    result = result.replaceAll(new RegExp(`\\b${alias}\\b`, 'g'), canonical)
  }
  return result
}

function collectConstValues(sourceFile) {
  const values = {}
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          ts.isStringLiteral(decl.initializer)
        ) {
          values[decl.name.text] = `'${decl.initializer.text}'`
        }
      }
    }
  })
  return values
}

function extractEnum(sourceFile, node, constValues) {
  const name = node.name.text
  const members = []

  for (const member of node.members) {
    const memberName = member.name.getText(sourceFile)
    if (member.initializer) {
      let value = member.initializer.getText(sourceFile)
      if (constValues[value] !== undefined) {
        value = constValues[value]
      }
      members.push(`  ${memberName} = ${value}`)
    } else {
      members.push(`  ${memberName}`)
    }
  }

  return `export enum ${name} {\n${members.join(',\n')},\n}`
}

function extractClassAsInterface(sourceFile, node) {
  const name = node.name.text

  let heritage = ''
  if (node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        const types = clause.types.map((t) => {
          const typeName = t.expression.getText(sourceFile)
          return importAliases[typeName] || typeName
        })
        heritage = ` extends ${types.join(', ')}`
      }
    }
  }

  const properties = []
  for (const member of node.members) {
    if (!ts.isPropertyDeclaration(member)) continue
    if (member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword))
      continue

    const propName = member.name.getText(sourceFile)
    const optional = member.questionToken ? '?' : ''

    let typeText = 'any'
    if (member.type) {
      typeText = member.type.getText(sourceFile)
      typeText = transformType(typeText)
    }

    properties.push(`  ${propName}${optional}: ${typeText}`)
  }

  return `export interface ${name}${heritage} {\n${properties.join('\n')}\n}`
}

function extractTypeAlias(sourceFile, node) {
  let text = node.getText(sourceFile)
  text = transformType(text)
  if (!text.startsWith('export')) {
    text = `export ${text}`
  }
  return text
}

async function main() {
  const output = [
    '// Auto-generated from core model definitions',
    '// Do not edit manually - run `node scripts/extract-models.js` to regenerate',
    '',
  ]

  for (const source of sources) {
    const filePath = path.join(coreRoot, source.file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
    )

    const constValues = collectConstValues(sourceFile)

    ts.forEachChild(sourceFile, (node) => {
      if (
        ts.isEnumDeclaration(node) &&
        source.enums?.includes(node.name.text)
      ) {
        output.push(extractEnum(sourceFile, node, constValues))
        output.push('')
      }

      if (
        ts.isClassDeclaration(node) &&
        node.name &&
        source.classes?.includes(node.name.text)
      ) {
        output.push(extractClassAsInterface(sourceFile, node))
        output.push('')
      }

      if (
        ts.isTypeAliasDeclaration(node) &&
        source.types?.includes(node.name.text)
      ) {
        output.push(extractTypeAlias(sourceFile, node))
        output.push('')
      }
    })
  }

  const formatted = await prettier.format(output.join('\n'), {
    parser: 'typescript',
    semi: false,
    tabWidth: 2,
    printWidth: 80,
    singleQuote: true,
    trailingComma: 'all',
  })

  const outputPath = path.resolve(__dirname, '../src/models.generated.ts')
  fs.writeFileSync(outputPath, formatted)
  console.log(`Generated ${outputPath}`)
}

main()
