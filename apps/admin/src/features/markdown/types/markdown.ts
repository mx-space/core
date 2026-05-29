export enum ImportType {
  Note = 'note',
  Post = 'post',
}

export interface ParsedItem {
  filename: string
  meta?: {
    categories?: string[]
    date?: string
    slug?: string
    tags?: string[]
    title?: string
    updated?: string
  }
  text: string
}

export type ExportOptionId =
  | 'filenameSlug'
  | 'includeYAMLHeader'
  | 'titleBigTitle'
  | 'withMetaJson'
export type ExportConfig = Record<ExportOptionId, boolean>
