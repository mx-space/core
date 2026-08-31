import { postJson } from './http'

export type MigrationMemberKind = 'branch' | 'source' | 'translation'

export interface MigrationMemberPrecondition {
  hash: string
  id: string
  kind: MigrationMemberKind
  headRevisionId?: string
}

export interface MarkdownMigrationIssue {
  code: string
  details?: Record<string, unknown>
  feature: string
  lang?: string
  member: MigrationMemberKind
  memberId: string
  message: string
  range: {
    end: { column: number; line: number; offset: number }
    start: { column: number; line: number; offset: number }
  }
  severity: 'blocking'
}

export interface SerializedMigrationEditorState {
  root: {
    children: unknown[]
    [key: string]: unknown
  }
}

type MigrationConversionResult =
  | {
      content: SerializedMigrationEditorState
      converterVersion: string
      profile: 'yohaku-v1'
      sourceHash: string
      status: 'convertible'
      text: string
    }
  | {
      converterVersion: string
      issues: Omit<MarkdownMigrationIssue, 'lang' | 'member' | 'memberId'>[]
      profile: 'yohaku-v1'
      sourceHash: string
      status: 'blocked'
    }

export interface MarkdownMigrationDryRunResponse {
  converterVersion: string
  issues: MarkdownMigrationIssue[]
  preconditions: MigrationMemberPrecondition[]
  profile: 'yohaku-v1'
  source: MigrationConversionResult
  sourceHash: string
  status: 'blocked' | 'convertible'
  translations: Array<{
    alignment: {
      alignedBlockCount: number
      sourceBlockCount: number
      translationBlockCount: number
    }
    id: string
    lang: string
    result: MigrationConversionResult | Record<string, unknown>
  }>
}

export interface MarkdownToLexicalMigrationDescriptor {
  converterVersion: string
  preconditions: MigrationMemberPrecondition[]
  profile: 'yohaku-v1'
  sourceHash: string
  sourceMarkdown: string
}

export function dryRunMarkdownToLexical(data: {
  branchId?: string
  profile: 'yohaku-v1'
  refId: string
  refType: 'note' | 'page' | 'post'
  sourceText: string
}) {
  return postJson<MarkdownMigrationDryRunResponse, typeof data>(
    '/content-migrations/markdown-to-lexical/dry-run',
    data,
  )
}

export function migrationDescriptorFromDryRun(
  sourceMarkdown: string,
  result: MarkdownMigrationDryRunResponse,
): MarkdownToLexicalMigrationDescriptor {
  return {
    converterVersion: result.converterVersion,
    preconditions: result.preconditions,
    profile: result.profile,
    sourceHash: result.sourceHash,
    sourceMarkdown,
  }
}
