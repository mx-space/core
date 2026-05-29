export const defaultServerlessFunction = `
export default async function handler(ctx: Context) {
  return 'pong';
}
`.trimStart()
export enum SnippetType {
  JSON = 'json',
  JSON5 = 'json5',
  Function = 'function',
  Text = 'text',
  YAML = 'yaml',
}

export enum SnippetTypeToLanguage {
  json = 'json',
  json5 = 'plaintext',
  function = 'typescript',
  text = 'markdown',
  yaml = 'yaml',
}

export class SnippetModel {
  id = ''
  createdAt = ''
  updatedAt: string | null = null

  type = SnippetType.JSON
  private = false
  raw = '{}'
  name = ''
  reference = 'root'
  comment?: string | null
  metatype?: string | null
  schema?: string | null

  // for serverless function
  enable?: boolean
  method?: string | null
  secret?: Record<string, any> | string | null

  customPath?: string | null

  builtIn = false
  compiledCode?: string | null
}
