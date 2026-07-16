/**
 * Extract model types from core module `.types.ts` / `.enum.ts` / `.constant.ts`
 * files and generate `packages/webhook/src/models.generated.ts`.
 *
 * Replaces the old TypeGoose-based extraction script that was removed during
 * the PostgreSQL / Drizzle ORM migration.
 *
 * Usage:  bun scripts/extract-models.ts
 */

import fs from 'node:fs'
import path from 'node:path'

import prettier from 'prettier'
import ts from 'typescript'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const coreRoot = path.resolve(__dirname, '../../../apps/core/src')

// ---------------------------------------------------------------------------
// Source manifest
// ---------------------------------------------------------------------------
interface SourceEntry {
  derivedTypes?: Record<string, string>
  file: string
  enums?: string[]
  interfaces?: string[]
  resolvedTypes?: string[]
  types?: string[]
  typeAliases?: string[]
}

const sources: SourceEntry[] = [
  // ── Enums ────────────────────────────────────────────────────────────
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
    file: 'modules/comment/comment.enum.ts',
    enums: ['CommentState', 'CommentAnchorMode'],
  },
  {
    file: 'modules/category/category.enum.ts',
    enums: ['CategoryType'],
  },
  {
    file: 'modules/link/link.enum.ts',
    enums: ['LinkType', 'LinkState'],
  },
  {
    file: 'modules/recently/recently.schema.ts',
    enums: ['RecentlyTypeEnum'],
  },

  // ── Base / shared interfaces ─────────────────────────────────────────
  {
    file: 'shared/types/legacy-model.type.ts',
    interfaces: [
      'ImageModel',
      'CountModel',
      'BaseModel',
      'BaseCommentIndexModel',
      'WriteBaseModel',
    ],
  },
  {
    file: 'modules/note/note.types.ts',
    interfaces: ['Coordinate'],
  },

  // ── Domain model interfaces ──────────────────────────────────────────
  {
    file: 'modules/comment/comment.types.ts',
    interfaces: ['CommentAnchorModel', 'CommentRow'],
    typeAliases: ['CommentModel', 'CommentRefType'],
  },
  {
    file: 'modules/category/category.types.ts',
    interfaces: ['CategoryModel'],
  },
  {
    file: 'modules/topic/topic.types.ts',
    interfaces: ['TopicModel'],
  },
  {
    file: 'modules/link/link.types.ts',
    interfaces: ['LinkModel'],
  },
  {
    file: 'modules/note/note.types.ts',
    interfaces: ['NoteRow'],
    typeAliases: ['NoteModel'],
    derivedTypes: {
      NormalizedNote:
        "Omit<NoteModel, 'password' | 'topic'> & { topic: TopicModel }",
    },
  },
  {
    file: 'modules/page/page.types.ts',
    interfaces: ['PageRow'],
    typeAliases: ['PageModel'],
  },
  {
    file: 'modules/post/post.types.ts',
    interfaces: ['PostRow', 'PostRelatedSummary'],
    typeAliases: ['PostModel'],
    derivedTypes: {
      NormalizedPost:
        "Omit<PostModel, 'category'> & { category: CategoryModel }",
    },
  },
  {
    file: 'modules/recently/recently.types.ts',
    interfaces: ['RecentlyRow'],
    typeAliases: ['RecentlyModel', 'RefType', 'RecentlyRefType'],
  },
  {
    file: 'modules/say/say.types.ts',
    // SayModel does not exist on server; extract SayRow and rename
    interfaces: ['SayRow'],
  },
  {
    file: 'modules/reader/reader.types.ts',
    interfaces: ['ReaderModel'],
  },
  {
    file: 'modules/companion/companion.types.ts',
    resolvedTypes: ['PublicLiveDeskStateV2'],
  },
]

// ---------------------------------------------------------------------------
// Symbol remapping — rename extracted symbols for the webhook package
// ---------------------------------------------------------------------------
const symbolRemap: Record<string, string> = {
  SayRow: 'SayModel',
}

// ---------------------------------------------------------------------------
// Type-text transformations
// ---------------------------------------------------------------------------
function transformTypeText(text: string): string {
  let result = text

  // Remove EntityId branding → plain string
  result = result.replaceAll(/\bEntityId\b/g, 'string')

  // Remove import type annotations that don't exist in webhook package
  result = result.replaceAll(/\bimport\s*\([^)]*\)\s*/g, '')

  return result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSource(filePath: string): ts.SourceFile {
  const content = fs.readFileSync(filePath, 'utf-8')
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)
}

const resolveCoreCompilerOptions = (): ts.CompilerOptions => {
  const configPath = path.resolve(coreRoot, '../tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, '\n'),
    )
  }

  return ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  ).options
}

const coreCompilerOptions = resolveCoreCompilerOptions()

function loadSource(
  filePath: string,
  resolveTypes: boolean,
): { checker?: ts.TypeChecker; sourceFile: ts.SourceFile } {
  if (!resolveTypes) {
    return { sourceFile: parseSource(filePath) }
  }

  const program = ts.createProgram({
    rootNames: [filePath],
    options: coreCompilerOptions,
  })
  const sourceFile = program.getSourceFile(filePath)
  if (!sourceFile) {
    throw new Error(`[extract-models] Cannot load source: ${filePath}`)
  }

  return { checker: program.getTypeChecker(), sourceFile }
}

/** Collect top-level `const x = 'value'` bindings (for enum initializers). */
function collectConstValues(sourceFile: ts.SourceFile): Record<string, string> {
  const values: Record<string, string> = {}
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

/** Extract an enum declaration. */
function extractEnum(
  sourceFile: ts.SourceFile,
  node: ts.EnumDeclaration,
  constValues: Record<string, string>,
): string {
  const name = node.name.text
  const members: string[] = []

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

/** Extract an interface declaration. */
function extractInterface(
  sourceFile: ts.SourceFile,
  node: ts.InterfaceDeclaration,
): string {
  const name = node.name.text

  let heritage = ''
  if (node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        const types = clause.types.map((t) =>
          transformTypeText(t.expression.getText(sourceFile)),
        )
        heritage = ` extends ${types.join(', ')}`
      }
    }
  }

  const properties: string[] = []
  for (const member of node.members) {
    if (!ts.isPropertySignature(member)) continue

    const propName = member.name.getText(sourceFile)
    const optional = member.questionToken ? '?' : ''

    let typeText = 'any'
    if (member.type) {
      typeText = transformTypeText(member.type.getText(sourceFile))
    }

    properties.push(`  ${propName}${optional}: ${typeText}`)
  }

  const exportName = symbolRemap[name] || name
  return `export interface ${exportName}${heritage} {\n${properties.join('\n')}\n}`
}

/** Extract a type alias declaration. */
function extractTypeAlias(
  sourceFile: ts.SourceFile,
  node: ts.TypeAliasDeclaration,
): string {
  const originalName = node.name.text
  const targetName = symbolRemap[originalName] || originalName

  let text = node.getText(sourceFile)
  text = transformTypeText(text)
  if (!text.startsWith('export')) {
    text = `export ${text}`
  }

  // Replace the type name in the declaration
  if (targetName !== originalName) {
    text = text.replace(
      new RegExp(`(export\\s+type\\s+)${originalName}\\b`),
      `$1${targetName}`,
    )
  }

  return text
}

/** Resolve an inferred type alias into a self-contained structural type. */
function extractResolvedTypeAlias(
  checker: ts.TypeChecker,
  node: ts.TypeAliasDeclaration,
): string {
  const type = checker.getTypeAtLocation(node)
  const typeText = checker.typeToString(
    type,
    node,
    ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias,
  )

  return `export type ${node.name.text} = ${transformTypeText(typeText)}`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const output: string[] = [
    '// Auto-generated from core module type definitions.',
    '// Do not edit manually — run `bun scripts/extract-models.ts` to regenerate.',
    '',
  ]

  for (const source of sources) {
    const filePath = path.join(coreRoot, source.file)

    if (!fs.existsSync(filePath)) {
      console.warn(`[extract-models] SKIP — file not found: ${filePath}`)
      continue
    }

    const { checker, sourceFile } = loadSource(
      filePath,
      Boolean(source.resolvedTypes?.length),
    )
    const constValues = collectConstValues(sourceFile)

    const wanted = new Set([
      ...(source.enums ?? []),
      ...(source.interfaces ?? []),
      ...(source.resolvedTypes ?? []),
      ...(source.types ?? []),
      ...(source.typeAliases ?? []),
    ])

    let found = false

    ts.forEachChild(sourceFile, (node) => {
      if (
        ts.isEnumDeclaration(node) &&
        source.enums?.includes(node.name.text)
      ) {
        output.push(extractEnum(sourceFile, node, constValues))
        output.push('')
        found = true
      }

      if (
        ts.isInterfaceDeclaration(node) &&
        source.interfaces?.includes(node.name.text)
      ) {
        output.push(extractInterface(sourceFile, node))
        output.push('')
        found = true
      }

      if (
        ts.isTypeAliasDeclaration(node) &&
        source.resolvedTypes?.includes(node.name.text)
      ) {
        if (!checker) {
          throw new Error(
            `[extract-models] Missing type checker for ${node.name.text}`,
          )
        }
        output.push(extractResolvedTypeAlias(checker, node))
        output.push('')
        found = true
      }

      if (
        ts.isTypeAliasDeclaration(node) &&
        (source.types?.includes(node.name.text) ||
          source.typeAliases?.includes(node.name.text))
      ) {
        output.push(extractTypeAlias(sourceFile, node))
        output.push('')
        found = true
      }
    })

    for (const [name, typeText] of Object.entries(source.derivedTypes ?? {})) {
      output.push(`export type ${name} = ${typeText}`)
      output.push('')
    }

    if (!found && wanted.size > 0) {
      console.warn(
        `[extract-models] WARN — no matching symbols in ${source.file}: ${[...wanted].join(', ')}`,
      )
    }
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
  if (process.argv.includes('--check')) {
    const current = fs.readFileSync(outputPath, 'utf-8')
    if (current !== formatted) {
      console.error(
        '[extract-models] Generated models are stale. Run `bun scripts/extract-models.ts`.',
      )
      process.exitCode = 1
      return
    }
    console.log(`✓ Generated models are current: ${outputPath}`)
    return
  }

  fs.writeFileSync(outputPath, formatted)
  console.log(`✓ Generated ${outputPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
