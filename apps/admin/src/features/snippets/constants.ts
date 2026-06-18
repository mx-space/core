import type { CreateSnippetData } from '~/api/snippets'
import { SnippetType } from '~/models/snippet'
import { adminQueryKeys } from '~/query/keys'

export const snippetsQueryKey = adminQueryKeys.snippets.root
export const logPageSize = 20

export const snippetTypes: SnippetType[] = [
  SnippetType.JSON,
  SnippetType.JSON5,
  SnippetType.YAML,
  SnippetType.Text,
  SnippetType.Skill,
  SnippetType.Function,
]

export const emptySnippet: CreateSnippetData = {
  path: 'root/new.json',
  raw: '{}',
  type: SnippetType.JSON,
}
