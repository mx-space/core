export type SelectedSnippetId = 'new' | string | null

export type StatusFilter = 'all' | 'error' | 'success'

export interface ImportFunctionPreview {
  htmlUrl?: string | null
  name: string
  raw: string
  reference: string
}

export interface ImportPackagePreview {
  dependencies: string[]
  functions: ImportFunctionPreview[]
}

export interface AvailableSnippetPackage {
  name: string
  url: string
}
