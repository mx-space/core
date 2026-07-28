import type {
  MarkdownConversionIssue,
  MarkdownConversionProfile,
  MarkdownConversionResult,
  SerializedMxEditorState,
} from '@mx-space/editor'

export interface MigrationMemberPrecondition {
  kind: 'source' | 'draft' | 'translation'
  id: string
  hash: string
  version?: number
}

export interface ExistingLexicalConversionResult {
  status: 'already-lexical'
  profile: MarkdownConversionProfile
  sourceHash: string
  content: SerializedMxEditorState
}

export type MigrationMemberConversionResult =
  MarkdownConversionResult | ExistingLexicalConversionResult

export interface MigrationIssue extends MarkdownConversionIssue {
  member: 'source' | 'draft' | 'translation'
  memberId: string
  lang?: string
}

export interface MarkdownMigrationDryRunResponse {
  status: 'convertible' | 'blocked'
  profile: MarkdownConversionProfile
  converterVersion: string
  sourceHash: string
  preconditions: MigrationMemberPrecondition[]
  source: MarkdownConversionResult
  translations: Array<{
    id: string
    lang: string
    result: MigrationMemberConversionResult
    alignment: {
      sourceBlockCount: number
      translationBlockCount: number
      alignedBlockCount: number
    }
  }>
  issues: MigrationIssue[]
}
