import type { CreateSnippetData } from '~/api/snippets'

import { SnippetType } from '~/models/snippet'

export const snippetsQueryKey = ['snippets']
export const logPageSize = 20

export const snippetTypes: SnippetType[] = [
  SnippetType.JSON,
  SnippetType.JSON5,
  SnippetType.YAML,
  SnippetType.Text,
  SnippetType.Function,
]

export const emptySnippet: CreateSnippetData = {
  name: '',
  raw: '{}',
  reference: 'root',
  type: SnippetType.JSON,
}
