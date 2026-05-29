import { postJson, requestBlob } from './http'

export interface MarkdownImportData {
  content?: string
  data?: unknown[]
  type?: 'note' | 'page' | 'post'
}

export interface MarkdownExportParams {
  id?: string
  show_title?: boolean
  slug?: boolean
  type?: 'note' | 'page' | 'post'
  with_meta_json?: boolean
  yaml?: boolean
}

export function importMarkdown(data: MarkdownImportData) {
  return postJson<{ id: string }, MarkdownImportData>('/markdown/import', data)
}

export async function exportMarkdown(params?: MarkdownExportParams) {
  const searchParams = new URLSearchParams()

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value))
    }
  }

  const query = searchParams.toString()
  return requestBlob(`/markdown/export${query ? `?${query}` : ''}`)
}
