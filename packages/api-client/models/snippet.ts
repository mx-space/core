export enum SnippetType {
  JSON = 'json',
  JSON5 = 'json5',
  Function = 'function',
  Text = 'text',
  YAML = 'yaml',
}

export interface SnippetModel<T = unknown> {
  id: string
  createdAt: string
  updatedAt: string | null
  type: SnippetType
  private: boolean
  raw: string
  name: string
  reference: string
  comment?: string | null
  metatype?: string | null
  schema?: string | null
  method?: string | null
  customPath?: string | null
  /** Encrypted on list endpoints; cleared key-value object on detail endpoints. */
  secret?: string | Record<string, unknown> | null
  enable: boolean
  builtIn: boolean
  compiledCode?: string | null
  data?: T
}
